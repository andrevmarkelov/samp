import type { Player, Vehicle } from "@omp-node/core";
import { getAccount } from "../auth/session";
import type { LicenseKey } from "../auth/licenses";

/** Faggio у ЖД и Pizzaboy — скутера, права не нужны. */
const SCOOTERS = new Set([448, 462]);
const BICYCLES = new Set([481, 509, 510]);
const MOTORCYCLES = new Set([
  448, 461, 462, 463, 468, 471, 521, 522, 523, 581, 586,
]);
const AIRCRAFT = new Set([
  417, 425, 447, 460, 469, 476, 487, 488, 497, 511, 512, 513, 519, 520, 548, 553,
  563, 577, 592, 593,
]);
const NO_LICENSE = new Set([
  430, 435, 441, 446, 449, 450, 452, 453, 454, 464, 465, 472, 473, 484, 493, 501,
  537, 538, 564, 569, 570, 584, 590, 591, 595, 606, 607, 608, 610, 611,
]);

const DENY: Record<"car" | "moto" | "fly", string> = {
  car: "U vas net licenzii na avtomobili.",
  moto: "U vas net licenzii na motocikly.",
  fly: "U vas net licenzii na polety.",
};

export type DriveLicense = Extract<LicenseKey, "car" | "moto" | "fly">;

export function requiredDriveLicense(model: number): DriveLicense | null {
  if (SCOOTERS.has(model) || BICYCLES.has(model) || NO_LICENSE.has(model)) {
    return null;
  }

  if (AIRCRAFT.has(model)) {
    return "fly";
  }

  if (MOTORCYCLES.has(model)) {
    return "moto";
  }

  if (model >= 400 && model <= 611) {
    return "car";
  }

  return null;
}

export function driveLicenseDeny(player: Player, vehicle: Vehicle): string | null {
  const account = getAccount(player);
  if (!account) {
    return "Snachala voydi v akkaunt.";
  }

  let model = 0;
  try {
    model = vehicle.getModel();
  } catch {
    return null;
  }

  const need = requiredDriveLicense(model);
  if (!need || account.licenses[need]) {
    return null;
  }

  return DENY[need];
}
