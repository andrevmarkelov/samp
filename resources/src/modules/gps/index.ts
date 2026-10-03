import { Checkpoint, Dialog, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { isAuthenticated } from "../auth/session";
import { listBusinesses } from "../businesses/repository";
import { BusinessType } from "../businesses/types";
import { isLoaderOnShift } from "../loader";
import { isMinerOnShift } from "../miner";
import { isAutoschoolExamOnRoute } from "../autoschool/session";
import { isHospitalMedDeliveryActive } from "../vehicles/hospital";
import { isArmyAmmoCarrying } from "../vehicles/army-ammo-delivery";
import type { GameModule } from "../types";

export const GPS_DIALOG_ID = 7;

const DIALOG_STYLE_LIST = 2;
const GPS_ICON_SLOT = 2;
const GPS_ICON_TYPE = 0;
const GPS_ICON_COLOR = 0xff0000ff;
const MAPICON_GLOBAL = 1;
const ARRIVE_RADIUS = 8;
const CHECKPOINT_RADIUS = 4;
const TICK_MS = 200;
/** Категории в корневом меню. */
const C_CAT = "{FFFFFF}";
/** «Найти ближайший…». */
const C_NEAR = "{33CCFF}";

type GpsTarget = {
  key: string;
  label: string;
  x: number;
  y: number;
  z: number;
};

type NearestBizItem = {
  key: string;
  label: string;
  typeIds: readonly number[];
};

type GpsCategory = {
  key: string;
  label: string;
  targets: readonly GpsTarget[];
};

const TARGETS = {
  hall: { key: "hall", label: "Мэрия", x: 1481.1039, y: -1767.4878, z: 18.7958 },
  hospital: {
    key: "hospital",
    label: "Городская больница",
    x: 1177.869,
    y: -1323.4761,
    z: 14.092,
  },
  mine: {
    key: "mine",
    label: "Шахта",
    x: 1023.8627,
    y: -368.1405,
    z: 73.8935,
  },
  loader: {
    key: "loader",
    label: "Склад (грузчик)",
    x: 2236.532,
    y: -2212.7854,
    z: 13.5469,
  },
  station: {
    key: "station",
    label: "ЖД ЛС",
    x: 1814.2401,
    y: -1889.4424,
    z: 13.4141,
  },
  prison: {
    key: "prison",
    label: "Тюрьма",
    x: 1810.8636,
    y: -1576.4412,
    z: 13.5167,
  },
  police: {
    key: "police",
    label: "Областная полиция",
    x: 635.6895,
    y: -571.6663,
    z: 16.3359,
  },
  lspd: {
    key: "lspd",
    label: "LSPD",
    x: 1543.1873,
    y: -1675.8076,
    z: 13.556,
  },
  fbi: {
    key: "fbi",
    label: "FBI",
    x: 617.4481,
    y: -1458.5858,
    z: 14.4322,
  },
  autoschool: {
    key: "autoschool",
    label: "Автошкола",
    x: 738.8304,
    y: -1412.7374,
    z: 13.5284,
  },
  bank: {
    key: "bank",
    label: "Банк",
    x: 1458.5426,
    y: -1024.3342,
    z: 23.8281,
  },
  lcn: {
    key: "lcn",
    label: "LCN",
    x: 1288.8087,
    y: -2056.6206,
    z: 58.6303,
  },
  yakuza: {
    key: "yakuza",
    label: "Yakuza",
    x: 664.9431,
    y: -1315.2083,
    z: 13.4496,
  },
  russian_mafia: {
    key: "russian_mafia",
    label: "Русская мафия",
    x: 962.1949,
    y: -946.551,
    z: 40.2929,
  },
  grove: {
    key: "grove",
    label: "Grove Street",
    x: 2506.6667,
    y: -1684.4637,
    z: 13.5469,
  },
  ballas: {
    key: "ballas",
    label: "Ballas",
    x: 2023.1401,
    y: -1129.0132,
    z: 24.8482,
  },
  vagos: {
    key: "vagos",
    label: "Vagos",
    x: 2745.1252,
    y: -1177.5881,
    z: 69.4024,
  },
  rifa: {
    key: "rifa",
    label: "Rifa",
    x: 2776.4692,
    y: -1924.9092,
    z: 13.5394,
  },
  aztecas: {
    key: "aztecas",
    label: "Aztecas",
    x: 2185.4087,
    y: -1807.8779,
    z: 13.3734,
  },
} as const satisfies Record<string, GpsTarget>;

const CATEGORIES: readonly GpsCategory[] = [
  {
    key: "public",
    label: "Общественные места",
    targets: [TARGETS.station, TARGETS.bank],
  },
  {
    key: "gov",
    label: "Государственные организации",
    targets: [
      TARGETS.hall,
      TARGETS.hospital,
      TARGETS.prison,
      TARGETS.police,
      TARGETS.lspd,
      TARGETS.fbi,
      TARGETS.autoschool,
    ],
  },
  {
    key: "crime",
    label: "Банды и мафии",
    targets: [
      TARGETS.lcn,
      TARGETS.yakuza,
      TARGETS.russian_mafia,
      TARGETS.grove,
      TARGETS.ballas,
      TARGETS.vagos,
      TARGETS.rifa,
      TARGETS.aztecas,
    ],
  },
  {
    key: "jobs",
    label: "По работе",
    targets: [TARGETS.mine, TARGETS.loader],
  },
];

/** Только типы бизнесов, которые реально есть в системе. */
const NEAREST_BIZ: readonly NearestBizItem[] = [
  {
    key: "nearest_gas",
    label: "Найти ближайшую АЗС",
    typeIds: [BusinessType.GAS],
  },
  {
    key: "nearest_247",
    label: "Найти ближайший магазин 24/7",
    typeIds: [BusinessType.SHOP_247],
  },
  {
    key: "nearest_ammu",
    label: "Найти ближайший магазин оружия",
    typeIds: [BusinessType.AMMU],
  },
  {
    key: "nearest_rent",
    label: "Найти ближайший прокат авто",
    typeIds: [BusinessType.VEHICLE_RENT],
  },
  {
    key: "nearest_food",
    label: "Найти ближайшее заведение питания",
    typeIds: [BusinessType.FASTFOOD, BusinessType.STREET_FOOD],
  },
];

type MenuState =
  | { kind: "main" }
  | { kind: "category"; categoryKey: string };

const activeByPlayer = new Map<number, GpsTarget>();
const menuState = new Map<number, MenuState>();

/** Сброс метки `/findid*` при установке GPS (без циклического импорта). */
let clearFindIdMark: ((player: Player) => void) | null = null;

export function setFindIdMarkClearer(
  clearer: ((player: Player) => void) | null
): void {
  clearFindIdMark = clearer;
}

/** Снять GPS-маршрут (для `/findidhouse` / `/findidbiz`). */
export function clearGpsRouteForPlayer(player: Player): void {
  const id = playerId(player);
  if (id === null || !activeByPlayer.has(id)) {
    return;
  }

  clearRoute(player, id);
}

export const gpsModule: GameModule = {
  name: "gps",
  start() {
    setInterval(tickGps, TICK_MS);

    omp.on("playerDisconnect", (player) => {
      const id = playerId(player);
      if (id !== null) {
        clearRoute(player, id);
        menuState.delete(id);
      }
    });
  },
};

export function showGpsMenu(player: Player): void {
  const id = playerId(player);
  if (id !== null && activeByPlayer.has(id)) {
    clearRoute(player, id);
    player.sendClientMessage(Color.gray, "Вы отключили GPS.");
    return;
  }

  showMainMenu(player);
}

export function bindGpsDialogs(): void {
  omp.on("dialogResponse", (player, dialogId, response, listItem) => {
    if (Number(dialogId) !== GPS_DIALOG_ID) {
      return;
    }

    const id = playerId(player);
    if (id === null) {
      return;
    }

    if (Number(response) === 0) {
      const state = menuState.get(id);
      if (state?.kind === "category") {
        showMainMenu(player);
        return;
      }
      menuState.delete(id);
      return;
    }

    onGpsListPick(player, Number(listItem));
  });
}

function showMainMenu(player: Player): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  menuState.set(id, { kind: "main" });

  const lines: string[] = [];
  let n = 1;
  for (const cat of CATEGORIES) {
    lines.push(`${C_CAT}${n}. ${cat.label}`);
    n += 1;
  }
  for (const item of NEAREST_BIZ) {
    lines.push(`${C_NEAR}${n}. ${item.label}`);
    n += 1;
  }

  try {
    Dialog.show(
      player,
      GPS_DIALOG_ID,
      DIALOG_STYLE_LIST,
      "GPS",
      lines.join("\n"),
      "Выбрать",
      "Закрыть"
    );
  } catch {
    menuState.delete(id);
    player.sendClientMessage(Color.error, "Не удалось открыть GPS.");
  }
}

function showCategoryMenu(player: Player, category: GpsCategory): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  menuState.set(id, { kind: "category", categoryKey: category.key });

  const lines = category.targets.map(
    (target, index) => `${index + 1}. ${target.label}`
  );

  try {
    Dialog.show(
      player,
      GPS_DIALOG_ID,
      DIALOG_STYLE_LIST,
      category.label,
      lines.join("\n"),
      "Выбрать",
      "Назад"
    );
  } catch {
    menuState.delete(id);
    player.sendClientMessage(Color.error, "Не удалось открыть GPS.");
  }
}

function onGpsListPick(player: Player, listItem: number): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const state = menuState.get(id) ?? { kind: "main" };

  if (state.kind === "category") {
    const category = CATEGORIES.find((c) => c.key === state.categoryKey);
    if (!category) {
      showMainMenu(player);
      return;
    }

    const target = category.targets[listItem];
    if (!target) {
      player.sendClientMessage(Color.error, "Не удалось выбрать пункт GPS.");
      showCategoryMenu(player, category);
      return;
    }

    menuState.delete(id);
    setRoute(player, target);
    return;
  }

  if (listItem >= 0 && listItem < CATEGORIES.length) {
    const category = CATEGORIES[listItem];
    if (!category) {
      showMainMenu(player);
      return;
    }
    showCategoryMenu(player, category);
    return;
  }

  const nearestIndex = listItem - CATEGORIES.length;
  if (nearestIndex >= 0 && nearestIndex < NEAREST_BIZ.length) {
    const item = NEAREST_BIZ[nearestIndex];
    if (!item) {
      showMainMenu(player);
      return;
    }
    const target = nearestBusinessTarget(player, item);
    if (!target) {
      return;
    }
    menuState.delete(id);
    setRoute(player, target);
    return;
  }

  player.sendClientMessage(Color.error, "Не удалось выбрать пункт GPS.");
  showMainMenu(player);
}

function nearestBusinessTarget(player: Player, item: NearestBizItem): GpsTarget | null {
  let pos;
  try {
    pos = player.getPos();
  } catch {
    player.sendClientMessage(Color.error, "Не удалось определить вашу позицию.");
    return null;
  }

  let bestId: number | null = null;
  let bestName = "";
  let bestX = 0;
  let bestY = 0;
  let bestZ = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const business of listBusinesses()) {
    if (!item.typeIds.includes(business.typeId)) {
      continue;
    }

    const distance = Math.hypot(
      pos.x - business.entranceX,
      pos.y - business.entranceY,
      pos.z - business.entranceZ
    );
    if (distance >= bestDistance) {
      continue;
    }

    bestDistance = distance;
    bestId = business.id;
    bestName = business.name;
    bestX = business.entranceX;
    bestY = business.entranceY;
    bestZ = business.entranceZ;
  }

  if (bestId === null) {
    player.sendClientMessage(Color.error, `${item.label}: ничего не найдено.`);
    return null;
  }

  return {
    key: `biz_${bestId}`,
    label: `${item.label}: ${bestName}`,
    x: bestX,
    y: bestY,
    z: bestZ,
  };
}

function setRoute(player: Player, target: GpsTarget): void {
  const id = playerId(player);
  if (id === null || !isAuthenticated(player)) {
    return;
  }

  try {
    clearFindIdMark?.(player);
  } catch {
    // Метка findid опциональна.
  }

  let pos;
  try {
    pos = player.getPos();
    player.setMapIcon(
      GPS_ICON_SLOT,
      target.x,
      target.y,
      target.z,
      GPS_ICON_TYPE,
      GPS_ICON_COLOR,
      MAPICON_GLOBAL
    );
    if (
      !isMinerOnShift(player) &&
      !isLoaderOnShift(player) &&
      !isAutoschoolExamOnRoute(player) &&
      !isHospitalMedDeliveryActive(player) &&
      !isArmyAmmoCarrying(player)
    ) {
      Checkpoint.set(player, target.x, target.y, target.z, CHECKPOINT_RADIUS);
    }
  } catch {
    player.sendClientMessage(Color.error, "Не удалось поставить метку.");
    return;
  }

  activeByPlayer.set(id, target);

  const meters = Math.round(
    Math.hypot(pos.x - target.x, pos.y - target.y, pos.z - target.z)
  );
  player.sendClientMessage(
    Color.info,
    `Метка: ${target.label}. Дистанция: ${meters} m.`
  );
}

function tickGps(): void {
  omp.players.forEach((player) => {
    const id = playerId(player);
    if (id === null) {
      return;
    }

    const target = activeByPlayer.get(id);
    if (!target || !isPlayerActive(player) || !isAuthenticated(player)) {
      return;
    }

    try {
      const pos = player.getPos();
      const dist = Math.hypot(pos.x - target.x, pos.y - target.y, pos.z - target.z);
      if (dist <= ARRIVE_RADIUS) {
        arrive(player);
        return;
      }

      if (
        !isMinerOnShift(player) &&
        !isLoaderOnShift(player) &&
        !isAutoschoolExamOnRoute(player) &&
        !isHospitalMedDeliveryActive(player) &&
        !isArmyAmmoCarrying(player) &&
        !Checkpoint.isActive(player)
      ) {
        Checkpoint.set(player, target.x, target.y, target.z, CHECKPOINT_RADIUS);
      }
    } catch {
      // Игрок уже вышел.
    }
  });
}

function arrive(player: Player): void {
  const id = playerId(player);
  if (id === null) {
    return;
  }

  const target = activeByPlayer.get(id);
  if (!target) {
    return;
  }

  clearRoute(player, id);
  player.sendClientMessage(
    Color.info,
    `Вы прибыли к месту: ${target.label}.`
  );
}

function clearRoute(player: Player, id: number): void {
  activeByPlayer.delete(id);
  try {
    player.removeMapIcon(GPS_ICON_SLOT);
    if (
      !isMinerOnShift(player) &&
      !isLoaderOnShift(player) &&
      !isAutoschoolExamOnRoute(player) &&
      !isHospitalMedDeliveryActive(player) &&
      !isArmyAmmoCarrying(player)
    ) {
      Checkpoint.disable(player);
    }
  } catch {
    // Игрок уже вышел.
  }
}
