import { omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { formatMoney } from "../../shared/money";
import {
  WHISPER_RADIUS,
  arePlayersNearby,
  clipClientMessage,
} from "../../shared/nearby";
import { isPlayerActive, playerChatName, playerId, playerName } from "../../shared/player";
import {
  claimYnOffer,
  getYnOfferKind,
  releaseYnOffer,
} from "../../shared/yn-offer";
import { byGender } from "../auth/gender";
import {
  applyHealth,
  applyWallet,
  getAccount,
  isAuthenticated,
  MAX_HEALTH,
  patchAccount,
} from "../auth/session";
import { dischargeHospitalPatient } from "../hospital";
import { ORG_HOSPITAL_ID, getMembership } from "../org";
import {
  consumeHospitalMed,
  getCarriedHospitalMeds,
} from "../org/hospital-medkit";
import { queueSave } from "../persist";
import { isJailed } from "../prison/sentence";
import { HOSPITAL_WORLD } from "../spawn/point";
import { isRegisteredOrgVehicle } from "../vehicles/access";
import { registerCommand } from "./registry";

const PLAYER_STATE_DRIVER = 2;
const PLAYER_STATE_PASSENGER = 3;
const KEY_YES = 65536;
const KEY_NO = 131072;
const OFFER_TTL_MS = 60_000;
const MIN_HEAL_PRICE = 1;
const MAX_HEAL_PRICE = 5000;

type MedhelpOffer = {
  doctorId: number;
  doctorUserId: number;
  price: number;
  expiresAt: number;
};

/** Предложения лечения: slot пациента → оффер. */
const pendingOffers = new Map<number, MedhelpOffer>();

registerCommand(
  "medhelp",
  "Больница: предложить лечение рядом (нужны медикаменты со склада)",
  (player, args) => {
    tryMedhelp(player, args.trim());
  }
);

export function bindMedhelpOffers(): void {
  omp.on("playerKeyStateChange", (player, newKeys, oldKeys) => {
    const pressed = Number(newKeys) & ~Number(oldKeys);
    if ((pressed & KEY_YES) === 0 && (pressed & KEY_NO) === 0) {
      return;
    }

    const slot = playerId(player);
    if (slot === null || getYnOfferKind(slot) !== "medhelp") {
      return;
    }

    const offer = pendingOffers.get(slot);
    if (!offer) {
      releaseYnOffer(slot, "medhelp");
      return;
    }

    if (Date.now() > offer.expiresAt) {
      clearExpiredMedhelpOffer(slot);
      player.sendClientMessage(Color.error, "Предложение лечения истекло.");
      return;
    }

    if ((pressed & KEY_NO) !== 0) {
      refuseOffer(player, slot, offer);
      return;
    }

    if ((pressed & KEY_YES) !== 0) {
      acceptOffer(player, slot, offer);
    }
  });

  omp.on("playerDisconnect", (player) => {
    const slot = playerId(player);
    if (slot === null) {
      return;
    }

    if (pendingOffers.has(slot)) {
      pendingOffers.delete(slot);
      releaseYnOffer(slot, "medhelp");
    }

    for (const [targetSlot, offer] of pendingOffers) {
      if (offer.doctorId === slot) {
        pendingOffers.delete(targetSlot);
        releaseYnOffer(targetSlot, "medhelp");
        const target = omp.players.at(targetSlot);
        if (target && isPlayerActive(target)) {
          target.sendClientMessage(Color.error, "Врач вышел из игры. Лечение отменено.");
        }
      }
    }
  });
}

function tryMedhelp(player: Player, raw: string): void {
  if (!isPlayerActive(player) || !isAuthenticated(player)) {
    return;
  }

  const account = getAccount(player);
  if (!account) {
    return;
  }

  const membership = getMembership(account);
  if (!membership || membership.org.id !== ORG_HOSPITAL_ID) {
    player.sendClientMessage(Color.error, "Команда только для сотрудников больницы.");
    return;
  }

  if (isJailed(player) || account.hospitalized) {
    player.sendClientMessage(Color.error, "Сейчас нельзя лечить.");
    return;
  }

  if (getCarriedHospitalMeds(player) < 1) {
    player.sendClientMessage(
      Color.error,
      "Нет медикаментов. Возьмите набор на складе в служебном блоке больницы."
    );
    return;
  }

  if (!canHealHere(player)) {
    player.sendClientMessage(
      Color.error,
      "Лечить можно только в больнице или в транспорте больницы."
    );
    return;
  }

  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    player.sendClientMessage(
      Color.error,
      `Использование: /medhelp [id] [сумма ${MIN_HEAL_PRICE}-${MAX_HEAL_PRICE}]`
    );
    return;
  }

  const targetId = Number(parts[0]);
  const price = Math.floor(Number(parts[1]));
  if (!Number.isInteger(targetId) || targetId < 0) {
    player.sendClientMessage(Color.error, "Некорректный id игрока.");
    return;
  }

  if (
    !Number.isFinite(price) ||
    !Number.isSafeInteger(price) ||
    price < MIN_HEAL_PRICE ||
    price > MAX_HEAL_PRICE
  ) {
    player.sendClientMessage(
      Color.error,
      `Сумма должна быть от ${formatMoney(MIN_HEAL_PRICE)} до ${formatMoney(MAX_HEAL_PRICE)}.`
    );
    return;
  }

  const target = omp.players.at(targetId);
  if (!target || !isPlayerActive(target) || !isAuthenticated(target)) {
    player.sendClientMessage(Color.error, "Игрок не в сети.");
    return;
  }

  const doctorSlot = playerId(player);
  const targetSlot = playerId(target);
  if (doctorSlot === null || targetSlot === null || doctorSlot === targetSlot) {
    player.sendClientMessage(Color.error, "Нельзя лечить самого себя этой командой.");
    return;
  }

  const targetAccount = getAccount(target);
  if (!targetAccount) {
    return;
  }

  if (isJailed(target)) {
    player.sendClientMessage(Color.error, "Игрок в тюрьме.");
    return;
  }

  if (!arePlayersNearby(player, target, WHISPER_RADIUS)) {
    player.sendClientMessage(Color.error, "Подойдите ближе к пациенту.");
    return;
  }

  if (!canHealHere(target)) {
    player.sendClientMessage(
      Color.error,
      "Пациент должен быть в больнице или в транспорте больницы."
    );
    return;
  }

  let doctorInHospitalWorld = false;
  try {
    doctorInHospitalWorld = player.getVirtualWorld() === HOSPITAL_WORLD;
  } catch {
    return;
  }

  if (!doctorInHospitalWorld && !sameHospitalVehicle(player, target)) {
    player.sendClientMessage(
      Color.error,
      "Пациент должен быть в одном транспорте больницы с вами."
    );
    return;
  }

  let targetHp = targetAccount.health;
  try {
    targetHp = target.getHealth();
  } catch {
    // fallback
  }

  if (targetHp >= MAX_HEALTH - 0.5) {
    player.sendClientMessage(Color.error, "Игрок уже здоров.");
    return;
  }

  if (targetAccount.money < price) {
    player.sendClientMessage(
      Color.error,
      `У пациента недостаточно наличных. Нужно ${formatMoney(price)}.`
    );
    return;
  }

  clearExpiredMedhelpOffer(targetSlot);

  if (pendingOffers.has(targetSlot) || !claimYnOffer(targetSlot, "medhelp")) {
    player.sendClientMessage(Color.error, "У игрока уже есть активное предложение.");
    return;
  }

  pendingOffers.set(targetSlot, {
    doctorId: doctorSlot,
    doctorUserId: account.id,
    price,
    expiresAt: Date.now() + OFFER_TTL_MS,
  });

  player.sendClientMessage(
    Color.info,
    `Вы предложили лечение игроку ${playerName(target)} за ${formatMoney(price)}.`
  );
  target.sendClientMessage(
    Color.white,
    `${playerName(player)} предлагает лечение за ${formatMoney(price)}.`
  );
  target.sendClientMessage(
    Color.white,
    "Нажмите {00CC00}Y {FFFFFF}чтобы согласиться или {FF6600}N {FFFFFF}для отказа"
  );
}

function acceptOffer(patient: Player, patientSlot: number, offer: MedhelpOffer): void {
  pendingOffers.delete(patientSlot);
  releaseYnOffer(patientSlot, "medhelp");

  const patientAccount = getAccount(patient);
  if (!patientAccount || !isAuthenticated(patient)) {
    return;
  }

  const doctor = omp.players.at(offer.doctorId);
  if (!doctor || !isPlayerActive(doctor) || !isAuthenticated(doctor)) {
    patient.sendClientMessage(Color.error, "Врач вышел из игры. Лечение отменено.");
    return;
  }

  const doctorAccount = getAccount(doctor);
  if (!doctorAccount || doctorAccount.id !== offer.doctorUserId) {
    patient.sendClientMessage(Color.error, "Врач вышел из игры. Лечение отменено.");
    return;
  }

  const membership = getMembership(doctorAccount);
  if (!membership || membership.org.id !== ORG_HOSPITAL_ID) {
    patient.sendClientMessage(Color.error, "Лечение отменено.");
    doctor.sendClientMessage(Color.error, "Лечение доступно только сотрудникам больницы.");
    return;
  }

  if (isJailed(doctor) || doctorAccount.hospitalized || isJailed(patient)) {
    patient.sendClientMessage(Color.error, "Лечение отменено.");
    doctor.sendClientMessage(Color.error, "Сейчас нельзя лечить.");
    return;
  }

  if (!arePlayersNearby(doctor, patient, WHISPER_RADIUS)) {
    patient.sendClientMessage(Color.error, "Врач слишком далеко. Лечение отменено.");
    doctor.sendClientMessage(Color.error, "Пациент слишком далеко. Лечение отменено.");
    return;
  }

  if (!canHealHere(doctor) || !canHealHere(patient)) {
    patient.sendClientMessage(Color.error, "Лечение отменено.");
    doctor.sendClientMessage(
      Color.error,
      "Лечить можно только в больнице или в транспорте больницы."
    );
    return;
  }

  let doctorInHospitalWorld = false;
  try {
    doctorInHospitalWorld = doctor.getVirtualWorld() === HOSPITAL_WORLD;
  } catch {
    return;
  }

  if (!doctorInHospitalWorld && !sameHospitalVehicle(doctor, patient)) {
    patient.sendClientMessage(Color.error, "Лечение отменено.");
    doctor.sendClientMessage(
      Color.error,
      "Пациент должен быть в одном транспорте больницы с вами."
    );
    return;
  }

  let patientHp = patientAccount.health;
  try {
    patientHp = patient.getHealth();
  } catch {
    // fallback
  }

  if (patientHp >= MAX_HEALTH - 0.5) {
    patient.sendClientMessage(Color.error, "Вы уже здоровы.");
    doctor.sendClientMessage(Color.error, "Игрок уже здоров.");
    return;
  }

  if (getCarriedHospitalMeds(doctor) < 1) {
    patient.sendClientMessage(Color.error, "У врача нет медикаментов. Лечение отменено.");
    doctor.sendClientMessage(Color.error, "Нет медикаментов.");
    return;
  }

  const price = offer.price;
  if (patientAccount.money < price) {
    patient.sendClientMessage(
      Color.error,
      `Недостаточно наличных. Нужно ${formatMoney(price)}.`
    );
    doctor.sendClientMessage(
      Color.error,
      `${playerName(patient)} не смог оплатить лечение (${formatMoney(price)}).`
    );
    return;
  }

  const livePatient = getAccount(patient);
  const liveDoctor = getAccount(doctor);
  if (
    !livePatient ||
    !liveDoctor ||
    livePatient.id !== patientAccount.id ||
    liveDoctor.id !== doctorAccount.id ||
    livePatient.money < price
  ) {
    patient.sendClientMessage(Color.error, "Не удалось провести оплату.");
    return;
  }

  const patientMoney = livePatient.money - price;
  const doctorMoney = liveDoctor.money + price;
  patchAccount(patient, { money: patientMoney });
  patchAccount(doctor, { money: doctorMoney });

  if (!consumeHospitalMed(doctor)) {
    patchAccount(patient, { money: livePatient.money });
    patchAccount(doctor, { money: liveDoctor.money });
    const rollbackPatient = getAccount(patient);
    const rollbackDoctor = getAccount(doctor);
    if (rollbackPatient) {
      applyWallet(patient, rollbackPatient);
    }
    if (rollbackDoctor) {
      applyWallet(doctor, rollbackDoctor);
    }
    patient.sendClientMessage(Color.error, "У врача нет медикаментов. Лечение отменено.");
    doctor.sendClientMessage(Color.error, "Нет медикаментов.");
    return;
  }

  patchAccount(patient, { health: MAX_HEALTH });
  applyHealth(patient, MAX_HEALTH);
  // Иначе hospitalized остаётся true — пациент с 100 HP не выйдет на улицу.
  dischargeHospitalPatient(patient);

  const patientWallet = getAccount(patient);
  const doctorWallet = getAccount(doctor);
  if (patientWallet) {
    applyWallet(patient, patientWallet);
  }
  if (doctorWallet) {
    applyWallet(doctor, doctorWallet);
  }
  queueSave(patient);
  queueSave(doctor);

  const left = getCarriedHospitalMeds(doctor);
  const verb = byGender(doctorAccount.gender, "вылечил", "вылечила");
  doctor.sendClientMessage(
    Color.info,
    `Пациент ${playerName(patient)} вылечен. +${formatMoney(price)}. Медикаментов: ${left}.`
  );
  patient.sendClientMessage(
    Color.info,
    `${playerName(doctor)} ${verb} вас. Оплачено ${formatMoney(price)}.`
  );

  broadcastHospitalMed(membership.rank.title, doctor, patient, doctorAccount, price);
}

function refuseOffer(patient: Player, patientSlot: number, offer: MedhelpOffer): void {
  pendingOffers.delete(patientSlot);
  releaseYnOffer(patientSlot, "medhelp");
  patient.sendClientMessage(Color.gray, "Вы отказались от лечения.");

  const doctor = omp.players.at(offer.doctorId);
  if (doctor && isPlayerActive(doctor)) {
    doctor.sendClientMessage(
      Color.gray,
      `${playerName(patient)} отказался от лечения.`
    );
  }
}

function clearExpiredMedhelpOffer(slot: number): void {
  const offer = pendingOffers.get(slot);
  if (!offer) {
    if (getYnOfferKind(slot) === "medhelp") {
      releaseYnOffer(slot, "medhelp");
    }
    return;
  }

  if (Date.now() <= offer.expiresAt) {
    return;
  }

  pendingOffers.delete(slot);
  releaseYnOffer(slot, "medhelp");
}

function broadcastHospitalMed(
  rankTitle: string,
  doctor: Player,
  patient: Player,
  doctorAccount: { gender: "male" | "female" },
  price: number
): void {
  const verb = byGender(doctorAccount.gender, "вылечил", "вылечила");
  const line = clipClientMessage(
    `(MED) ${rankTitle} ${playerChatName(doctor)} ${verb} игрока ${playerChatName(patient)}. Стоимость: ${formatMoney(price)}.`
  );

  omp.players.forEach((other) => {
    if (!isPlayerActive(other)) {
      return;
    }

    try {
      if (other.isNPC()) {
        return;
      }
    } catch {
      return;
    }

    const otherAccount = getAccount(other);
    const otherOrg = otherAccount ? getMembership(otherAccount) : null;
    if (!otherOrg || otherOrg.org.id !== ORG_HOSPITAL_ID) {
      return;
    }

    try {
      other.sendClientMessage(Color.radio, line);
    } catch {
      // Слот пустой.
    }
  });
}

function canHealHere(player: Player): boolean {
  try {
    if (player.getVirtualWorld() === HOSPITAL_WORLD) {
      return true;
    }

    const state = player.getState();
    if (state !== PLAYER_STATE_DRIVER && state !== PLAYER_STATE_PASSENGER) {
      return false;
    }

    const vehicle = omp.vehicles.at(player.getVehicleID()) ?? null;
    if (!vehicle) {
      return false;
    }

    return isRegisteredOrgVehicle(vehicle, ORG_HOSPITAL_ID);
  } catch {
    return false;
  }
}

function sameHospitalVehicle(a: Player, b: Player): boolean {
  try {
    const stateA = a.getState();
    const stateB = b.getState();
    if (
      (stateA !== PLAYER_STATE_DRIVER && stateA !== PLAYER_STATE_PASSENGER) ||
      (stateB !== PLAYER_STATE_DRIVER && stateB !== PLAYER_STATE_PASSENGER)
    ) {
      return false;
    }

    const idA = a.getVehicleID();
    const idB = b.getVehicleID();
    if (idA !== idB) {
      return false;
    }

    const vehicle = omp.vehicles.at(idA) ?? null;
    return vehicle !== null && isRegisteredOrgVehicle(vehicle, ORG_HOSPITAL_ID);
  } catch {
    return false;
  }
}
