import type { Player } from "@omp-node/core";

type EndPatrol = (player: Player) => void;

let endPatrolImpl: EndPatrol | null = null;

/** Регистрируется из модуля патруля, чтобы тюрьма не тянула весь модуль по кругу. */
export function bindEndPatrol(impl: EndPatrol): void {
  endPatrolImpl = impl;
}

export function endPatrol(player: Player): void {
  endPatrolImpl?.(player);
}
