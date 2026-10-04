import { Dialog, omp, type Player } from "@omp-node/core";
import { Color } from "../../shared/colors";
import { isPlayerActive, playerId } from "../../shared/player";
import { listCommands } from "./registry";

export const HELP_MENU_DIALOG_ID = 96;
export const HELP_LIST_DIALOG_ID = 97;

const DIALOG_STYLE_LIST = 2;
const DIALOG_STYLE_MSGBOX = 0;
const C_CMD = "{33FF33}";
const C_DESC = "{FFFFFF}";

type HelpCategory = {
  key: string;
  label: string;
  /** Имена команд из registry (без /). */
  commands: readonly string[];
};

const CATEGORIES: readonly HelpCategory[] = [
  {
    key: "general",
    label: "Общие команды",
    commands: [
      "mn",
      "time",
      "gps",
      "findidhouse",
      "findidbiz",
      "report",
      "pass",
      "lic",
      "vbilet",
      "medcard",
      "hospital",
      "leaders",
      "advokats",
      "ad",
      "pay",
      "mask",
      "anim",
    ],
  },
  {
    key: "chat",
    label: "Общение",
    commands: ["me", "do", "try", "todo", "b", "s", "w"],
  },
  {
    key: "vehicles",
    label: "Управление транспортом",
    commands: ["lock", "car", "trunk", "limit", "eject", "unrent"],
  },
  {
    key: "houses",
    label: "Дома",
    commands: ["home", "heal", "sellhouse", "findidhouse", "makestore", "use"],
  },
  {
    key: "business",
    label: "Бизнес",
    commands: ["buybiz", "biz", "findidbiz"],
  },
  {
    key: "gangs",
    label: "Банды и мафии",
    commands: ["f", "capture", "makegun", "sellgun", "selldrug"],
  },
  {
    key: "org",
    label: "Организации",
    commands: [
      "r",
      "d",
      "gov",
      "members",
      "clear",
      "su",
      "wanted",
      "pursuit",
      "unmask",
      "frisk",
      "take",
      "cuff",
      "uncuff",
      "putpl",
      "arrest",
      "demote",
      "selllic",
      "givemedcard",
      "medhelp",
      "givevbilet",
      "pickmed",
      "putammo",
      "takeammo",
      "pult",
      "edit",
    ],
  },
  {
    key: "leaders",
    label: "Лидерам",
    commands: ["invite", "uninvite", "rang"],
  },
  {
    key: "family",
    label: "Семья",
    commands: [
      "family",
      "fam",
      "fmembers",
      "finvite",
      "funinvite",
      "frang",
    ],
  },
];

const menuState = new Map<number, string>();

export function bindHelpDialogs(): void {
  omp.on("dialogResponse", (player, dialogId, response, listItem) => {
    const id = Number(dialogId);
    if (id !== HELP_MENU_DIALOG_ID && id !== HELP_LIST_DIALOG_ID) {
      return;
    }

    const slotId = playerId(player);
    if (slotId === null) {
      return;
    }

    if (id === HELP_MENU_DIALOG_ID) {
      if (Number(response) === 0) {
        menuState.delete(slotId);
        return;
      }
      onHelpCategoryPick(player, Number(listItem));
      return;
    }

    // Список команд: «Назад» (1) / «Закрыть» (0)
    if (Number(response) === 0) {
      menuState.delete(slotId);
      return;
    }

    showHelpMenu(player);
  });

  omp.on("playerDisconnect", (player) => {
    const slotId = playerId(player);
    if (slotId !== null) {
      menuState.delete(slotId);
    }
  });
}

/** Меню категорий команд (из `/mn` → «Список команд»). */
export function showHelpMenu(player: Player): void {
  if (!isPlayerActive(player)) {
    return;
  }

  const slotId = playerId(player);
  if (slotId === null) {
    return;
  }

  menuState.set(slotId, "main");

  const lines = CATEGORIES.map((cat, index) => `${index + 1}. ${cat.label}`);

  try {
    Dialog.show(
      player,
      HELP_MENU_DIALOG_ID,
      DIALOG_STYLE_LIST,
      "Список команд",
      lines.join("\n"),
      "Выбрать",
      "Закрыть"
    );
  } catch {
    menuState.delete(slotId);
    player.sendClientMessage(Color.error, "Не удалось открыть список команд.");
  }
}

function onHelpCategoryPick(player: Player, listItem: number): void {
  const category = CATEGORIES[listItem];
  if (!category) {
    showHelpMenu(player);
    return;
  }
  showHelpCategory(player, category);
}

function showHelpCategory(player: Player, category: HelpCategory): void {
  const slotId = playerId(player);
  if (slotId === null) {
    return;
  }

  menuState.set(slotId, category.key);

  const byName = new Map(listCommands().map((cmd) => [cmd.name, cmd.description]));
  const lines: string[] = [];
  for (const name of category.commands) {
    const description = byName.get(name);
    if (!description) {
      continue;
    }
    lines.push(`${C_CMD}/${name}${C_DESC} — ${description}`);
  }

  if (lines.length === 0) {
    player.sendClientMessage(Color.error, "В этом разделе пока нет команд.");
    showHelpMenu(player);
    return;
  }

  try {
    Dialog.show(
      player,
      HELP_LIST_DIALOG_ID,
      DIALOG_STYLE_MSGBOX,
      category.label,
      lines.join("\n"),
      "Назад",
      "Закрыть"
    );
  } catch {
    menuState.delete(slotId);
    player.sendClientMessage(Color.error, "Не удалось открыть раздел команд.");
  }
}
