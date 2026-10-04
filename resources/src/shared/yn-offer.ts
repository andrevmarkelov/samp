/** Один активный Y/N-оффер на игрока (бизнес / машина / документы / инвайты / selllic и т.п.). */

export type YnOfferKind =
  | "biz"
  | "car"
  | "medcard"
  | "pass"
  | "lic"
  | "show_medcard"
  | "vbilet"
  | "invite"
  | "finvite"
  | "selllic"
  | "sellgun"
  | "selldrug";

const activeBySlot = new Map<number, YnOfferKind>();

/** Занять слот под оффер. false — уже есть любой другой. */
export function claimYnOffer(slot: number, kind: YnOfferKind): boolean {
  if (activeBySlot.has(slot)) {
    return false;
  }
  activeBySlot.set(slot, kind);
  return true;
}

export function getYnOfferKind(slot: number): YnOfferKind | undefined {
  return activeBySlot.get(slot);
}

/** Снять оффер. Если kind задан — только совпадающий. */
export function releaseYnOffer(slot: number, kind?: YnOfferKind): void {
  if (kind !== undefined && activeBySlot.get(slot) !== kind) {
    return;
  }
  activeBySlot.delete(slot);
}

export function hasYnOffer(slot: number): boolean {
  return activeBySlot.has(slot);
}
