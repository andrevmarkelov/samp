/** Каталог анимаций (как на Advance RP / Funny RP). Индексы 0..73 = /anim 1..74. */

export type SpecialAnim = {
  kind: "special";
  label: string;
  action: number;
};

export type LibraryAnim = {
  kind: "library";
  label: string;
  lib: string;
  name: string;
  delta: number;
  loop: boolean;
  lockX: boolean;
  lockY: boolean;
  freeze: boolean;
  time: number;
};

export type AnimEntry = SpecialAnim | LibraryAnim;

const SPECIAL_ACTION_DANCE1 = 5;
const SPECIAL_ACTION_DANCE2 = 6;
const SPECIAL_ACTION_DANCE3 = 7;
const SPECIAL_ACTION_DANCE4 = 8;

function special(label: string, action: number): SpecialAnim {
  return { kind: "special", label, action };
}

function anim(
  label: string,
  lib: string,
  name: string,
  loop: boolean,
  lockX = false,
  lockY = false,
  freeze = false,
  time = 0,
  delta = 4.1
): LibraryAnim {
  return { kind: "library", label, lib, name, delta, loop, lockX, lockY, freeze, time };
}

export const ANIMATIONS: readonly AnimEntry[] = [
  special("Танец 1", SPECIAL_ACTION_DANCE1),
  special("Танец 2", SPECIAL_ACTION_DANCE2),
  special("Танец 3", SPECIAL_ACTION_DANCE3),
  special("Танец 4", SPECIAL_ACTION_DANCE4),
  anim("Танец 5", "DANCING", "DAN_Left_A", true),
  anim("Танец 6", "DANCING", "dnce_M_a", true),
  anim("Махать рукой", "ON_LOOKERS", "wave_loop", true),
  anim("Лечь на землю", "BEACH", "bather", true),
  anim("Походка пьяного", "PED", "WALK_drunk", true, true, true),
  anim("Кувыркаться", "PED", "Crouch_Roll_L", true, true, true),
  anim("Попрощаться", "PED", "endchat_03", true),
  anim("Читать рэп", "BENCHPRESS", "gym_bp_celebrate", true),
  anim("Укрыться", "PED", "cower", true),
  anim("Подложить бомбу", "BOMBER", "BOM_Plant", false),
  anim("Надеть маску", "SHOP", "ROB_Shifty", false),
  anim("Вытянуть руку перед собой", "SHOP", "ROB_Loop_Threat", true),
  anim("Сложить руки вместе", "COP_AMBIENT", "Coplook_loop", true),
  anim("Съел что-то не то...", "FOOD", "EAT_Vomit_P", false),
  anim("Перекусить", "FOOD", "EAT_Burger", false),
  anim("Шлёпнуть кому-то по заднице", "SWEET", "sweet_ass_slap", false),
  anim("Предложить наркотики", "DEALER", "DEALER_DEAL", false),
  anim("Эффект электрошокера", "CRACK", "crckdeth2", true),
  anim("Мужское курение", "LOWRIDER", "M_smklean_loop", true),
  anim("Женское курение", "LOWRIDER", "F_smklean_loop", true),
  anim("Присесть", "BEACH", "ParkSit_M_loop", true),
  anim("Восточное единоборство", "PARK", "Tai_Chi_Loop", true),
  anim("Выпить напиток", "BAR", "dnk_stndF_loop", true),
  anim("Танец на одной ноге", "DANCING", "DAN_Right_A", true),
  anim("Поза вратаря", "BSKTBALL", "BBALL_def_loop", true),
  anim("Facepalm", "MISC", "plyr_shkhead", false),
  anim("Элемент восточного танца", "BSKTBALL", "BBALL_idle", false),
  anim("Позвать кого-то", "CAMERA", "camstnd_cmon", true),
  anim("Руки вверх!", "SHOP", "SHP_Rob_HandsUP", true),
  anim("Спать на боку", "CRACK", "crckidle2", true),
  anim("Спать на спине", "CRACK", "crckidle4", true),
  anim("Смотреть по сторонам", "DEALER", "DEALER_IDLE", true),
  anim("Облокотиться на бок", "GANGS", "leanIDLE", true),
  anim("Толкнуть боком", "GANGS", "shake_carSH", false),
  anim("Раздумье", "GANGS", "smkcig_prtl", false),
  anim("Лечь, оперевшись на ладонь", "BEACH", "ParkSit_W_loop", true),
  anim("Сесть на стул", "INT_HOUSE", "LOU_Loop", true),
  anim("Сидеть уставшим за компьютером", "INT_OFFICE", "OFF_Sit_Bored_Loop", true),
  anim("Сидеть за столом", "INT_OFFICE", "OFF_Sit_Idle_Loop", true),
  anim("Сидеть и печатать", "INT_OFFICE", "OFF_Sit_Type_Loop", true),
  anim("Взять что-то и рассмотреть", "INT_SHOP", "shop_shelf", true),
  anim("Сесть, закинув ногу на ногу", "JST_BUISNESS", "girl_02", true),
  anim("Отказаться от чего-либо", "KISSING", "GF_StreetArgue_02", false),
  anim("Поцелуй 1", "KISSING", "Grlfrd_Kiss_01", false),
  anim("Поцелуй 2", "KISSING", "Grlfrd_Kiss_02", false),
  anim("Поцелуй 3", "KISSING", "Grlfrd_Kiss_03", false),
  anim("Размахивать руками на месте", "LOWRIDER", "RAP_B_Loop", true),
  anim("Искусственное дыхание", "MEDIC", "CPR", true),
  anim("Пощёчины для лежачего", "MISC", "bitchslap", true),
  anim("Подглядывать через что-то", "MISC", "bng_wndw", true),
  anim("Движение тореодора", "MISC", "KAT_Throw_K", false),
  anim("Сесть на стул (2)", "MISC", "SEAT_LR", true),
  anim("Сесть на стул (3)", "PED", "SEAT_idle", true),
  anim("Смотреть наверх", "ON_LOOKERS", "lkup_loop", true),
  anim("Указать рукой наверх", "ON_LOOKERS", "Pointup_loop", true),
  anim("Быть в страхе", "ON_LOOKERS", "panic_loop", true),
  anim("Призывать к чему-либо", "ON_LOOKERS", "shout_02", true),
  anim("Сходить по-маленькому", "PAULNMAC", "Piss_loop", true),
  anim("Гангстерский жест", "GHANDS", "gsign1LH", true),
  anim("Голосовать на остановке", "PED", "IDLE_taxi", true),
  anim("Удар ногой", "POLICE", "Door_Kick", false),
  anim("Стучаться в дверь", "POLICE", "CopTraf_Stop", true),
  anim("Устроить бунт", "RIOT", "RIOT_ANGRY_B", true),
  anim("Пританцовывать", "LOWRIDER", "RAP_C_Loop", true),
  anim("Лечь на землю (2)", "SWAT", "gnstwall_injurd", true),
  anim("Плохое самочувствие", "SWEET", "Sweet_injuredloop", true),
  anim("Приветствие 1", "RIOT", "RIOT_ANGRY", true),
  anim("Приветствие 2", "GHANDS", "gsign2", true),
  anim("Приветствие 3", "GHANDS", "gsign4", true),
  anim("Приветствие 4", "GHANDS", "gsign5", true),
];

export const ANIM_COUNT = ANIMATIONS.length;
export const ANIM_INFO_LABEL = "{33CC00}Информация";

export function dialogAnimList(): string {
  const lines = ANIMATIONS.map((entry, index) => `${index + 1}. ${entry.label}`);
  lines.push(ANIM_INFO_LABEL);
  return lines.join("\n");
}
