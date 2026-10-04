import { Checkpoint, Dialog, omp, TextLabel, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { saveUserJob } from "../auth/repository";
import { getAccount, isAuthenticated, patchAccount } from "../auth/session";
import { MERIYA_CUSTOM_INTERIOR, MERIYA_WORLD } from "../org/meriya";
import { syncOrgVehicleAccess } from "../vehicles/access";
import { isBusDriverOnShift } from "./bus/active";
import {
  JOB_NONE,
  getJob,
  jobHireDialogBody,
  jobIdFromHireListItem,
  jobLabel,
} from "./catalog";

export const JOB_HIRE_DIALOG_ID = 150;

const DIALOG_STYLE_TABLIST_HEADERS = 5;
const PLAYER_STATE_ONFOOT = 1;
const CHECKPOINT_RADIUS = 1.6;
/** Зона, в которой держим красный CP биржи. */
const SHOW_RADIUS = 14;
const TICK_MS = 400;
const LABEL_HEIGHT = 0.9;
const LABEL_DRAW_DISTANCE = 18;
/** Красный чекпоинт биржи в интерьере мэрии. */
const JOB_POINT = {
  x: -808.3898,
  y: -672.9396,
  z: 4001.0859,
} as const;

const busy = new Set<number>();
/** Мы поставили CP биржи этому игроку (не чужой GPS/смена). */
const hireCpOn = new Set<number>();
/** Диалог уже открыт — не спамим EnterCheckpoint. */
const dialogOpen = new Set<number>();
/**
 * После закрытия диалога нельзя открыть снова, пока игрок не выйдет с CP.
 * Иначе disable→set на метке даёт флуд окон.
 */
const mustLeaveCp = new Set<number>();

export function bindJobHire(): void {
  new TextLabel(
    "{FFCC00}Биржа труда\n{FFFFFF}Устройство на работу",
    Color.info,
    JOB_POINT.x,
    JOB_POINT.y,
    JOB_POINT.z + LABEL_HEIGHT,
    LABEL_DRAW_DISTANCE,
    MERIYA_WORLD,
    false
  );

  setInterval(tickHirePoint, TICK_MS);

  omp.on("playerEnterCheckpoint", (player) => {
    const id = playerId(player);
    if (id === null || !hireCpOn.has(id)) {
      return;
    }
    if (dialogOpen.has(id) || mustLeaveCp.has(id)) {
      return;
    }
    if (!isAtJobPoint(player)) {
      return;
    }
    openHireDialog(player);
  });

  omp.on("dialogResponse", (player, dialogId, response, listItem) => {
    if (Number(dialogId) !== JOB_HIRE_DIALOG_ID) {
      return;
    }

    const id = playerId(player);
    if (id !== null) {
      dialogOpen.delete(id);
      // Не пересоздаём CP здесь — это вызывает мгновенный EnterCheckpoint.
      mustLeaveCp.add(id);
    }

    if (Number(response) === 0) {
      return;
    }

    void handleHireChoice(player, Number(listItem));
  });

  omp.on("playerDisconnect", (player) => {
    const id = playerId(player);
    if (id !== null) {
      busy.delete(id);
      hireCpOn.delete(id);
      dialogOpen.delete(id);
      mustLeaveCp.delete(id);
    }
  });
}

function tickHirePoint(): void {
  omp.players.forEach((player) => {
    const id = playerId(player);
    if (id === null || !isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    if (isBusDriverOnShift(player)) {
      clearHireCheckpoint(player, id);
      mustLeaveCp.delete(id);
      return;
    }

    let inside = false;
    let onCp = false;
    try {
      if (
        player.getVirtualWorld() === MERIYA_WORLD &&
        player.getInterior() === MERIYA_CUSTOM_INTERIOR &&
        player.getState() === PLAYER_STATE_ONFOOT
      ) {
        const pos = player.getPos();
        const dist = Math.hypot(
          pos.x - JOB_POINT.x,
          pos.y - JOB_POINT.y,
          pos.z - JOB_POINT.z
        );
        inside = dist <= SHOW_RADIUS;
        onCp = dist <= CHECKPOINT_RADIUS + 2.5;
      }
    } catch {
      inside = false;
      onCp = false;
    }

    if (!inside) {
      clearHireCheckpoint(player, id);
      mustLeaveCp.delete(id);
      return;
    }

    // Отошёл с красной метки — снова можно открыть биржу при входе на CP.
    if (mustLeaveCp.has(id) && !onCp) {
      mustLeaveCp.delete(id);
    }

    if (!hireCpOn.has(id) && !dialogOpen.has(id)) {
      setHireCheckpoint(player, id);
    }
  });
}

function setHireCheckpoint(player: Player, id: number): void {
  try {
    Checkpoint.set(
      player,
      JOB_POINT.x,
      JOB_POINT.y,
      JOB_POINT.z,
      CHECKPOINT_RADIUS
    );
    hireCpOn.add(id);
  } catch {
    hireCpOn.delete(id);
  }
}

function clearHireCheckpoint(player: Player, id: number): void {
  if (!hireCpOn.has(id)) {
    return;
  }
  hireCpOn.delete(id);
  try {
    Checkpoint.disable(player);
  } catch {
    // Слот пустой.
  }
}

function isAtJobPoint(player: Player): boolean {
  if (!isAuthenticated(player) || isBusDriverOnShift(player)) {
    return false;
  }

  try {
    if (
      player.getVirtualWorld() !== MERIYA_WORLD ||
      player.getInterior() !== MERIYA_CUSTOM_INTERIOR
    ) {
      return false;
    }
    const pos = player.getPos();
    return (
      Math.hypot(pos.x - JOB_POINT.x, pos.y - JOB_POINT.y, pos.z - JOB_POINT.z) <=
      CHECKPOINT_RADIUS + 2.5
    );
  } catch {
    return false;
  }
}

function openHireDialog(player: Player): void {
  const account = getAccount(player);
  if (!account) {
    return;
  }

  const id = playerId(player);
  if (id === null) {
    return;
  }

  const current = jobLabel(account.jobId ?? JOB_NONE, account.gender);
  try {
    Dialog.show(
      player,
      JOB_HIRE_DIALOG_ID,
      DIALOG_STYLE_TABLIST_HEADERS,
      `{FFCC00}Биржа труда {FFFFFF}({33CCFF}${current}{FFFFFF})`,
      jobHireDialogBody(),
      "Выбрать",
      "Закрыть"
    );
    dialogOpen.add(id);
  } catch {
    dialogOpen.delete(id);
    tell(player, Color.error, "Не удалось открыть биржу труда.");
  }
}

async function handleHireChoice(player: Player, listItem: number): Promise<void> {
  const slot = playerId(player);
  if (slot === null) {
    return;
  }

  const jobId = jobIdFromHireListItem(listItem);
  if (jobId === null) {
    return;
  }

  if (!isAtJobPoint(player)) {
    tell(player, Color.error, "Вы должны находиться у биржи труда.");
    return;
  }

  if (busy.has(slot)) {
    tell(player, Color.error, "Подождите завершения предыдущего действия.");
    return;
  }

  const account = getAccount(player);
  if (!account) {
    return;
  }

  if (isBusDriverOnShift(player)) {
    tell(player, Color.error, "Сначала завершите или прервите рабочую смену.");
    return;
  }

  const currentJobId = account.jobId ?? JOB_NONE;

  if (jobId === JOB_NONE) {
    if (currentJobId === JOB_NONE) {
      tell(player, Color.error, "Вы нигде не работаете.");
      return;
    }

    busy.add(slot);
    try {
      await saveUserJob(account.id, JOB_NONE);
      if (!isPlayerActive(player) || getAccount(player)?.id !== account.id) {
        return;
      }
      patchAccount(player, { jobId: JOB_NONE });
      syncOrgVehicleAccess(player);
      tell(player, Color.info, "Вы уволились с работы.");
    } catch {
      tell(player, Color.error, "Не удалось сохранить в базу.");
    } finally {
      busy.delete(slot);
    }
    return;
  }

  const job = getJob(jobId);
  if (!job) {
    return;
  }

  if (currentJobId === jobId) {
    tell(player, Color.error, `Вы уже работаете: ${job.title}.`);
    return;
  }

  if (currentJobId !== JOB_NONE) {
    tell(
      player,
      Color.error,
      "Сначала увольтесь с текущей работы, затем устраивайтесь на новую."
    );
    return;
  }

  const level = Math.max(1, Math.floor(account.level));
  if (level < job.minLevel) {
    tell(
      player,
      Color.error,
      `Для работы «${job.title}» нужен ${job.minLevel} уровень (у вас ${level}).`
    );
    return;
  }

  busy.add(slot);
  try {
    await saveUserJob(account.id, jobId);
    if (!isPlayerActive(player) || getAccount(player)?.id !== account.id) {
      return;
    }
    patchAccount(player, { jobId });
    syncOrgVehicleAccess(player);
    tell(player, Color.info, `Вы устроились на работу: ${job.title}.`);
  } catch {
    tell(player, Color.error, "Не удалось сохранить в базу.");
  } finally {
    busy.delete(slot);
  }
}

function tell(player: Player, color: number, text: string): void {
  try {
    if (!isPlayerActive(player)) {
      return;
    }
    player.sendClientMessage(color, text);
  } catch {
    // Слот пустой.
  }
}
