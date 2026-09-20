import type { Player, Vehicle } from "@omp-node/core";
import { playerId } from "../../shared/player";

export type ExamKind = "car" | "moto";

export const PREMIER = 426;
export const WAYFARER = 586;

export type ExamSession = {
  accountId: number;
  kind: ExamKind;
  phase: "test" | "drive";
  question: number;
  correct: number;
  vehicleId: number | null;
  cpIndex: number;
  driveUntil: number | null;
};

export const exams = new Map<number, ExamSession>();

export function getExam(player: Player): ExamSession | null {
  const id = playerId(player);
  if (id === null) {
    return null;
  }

  return exams.get(id) ?? null;
}

export function isAutoschoolExamOnRoute(player: Player): boolean {
  const exam = getExam(player);
  return exam?.phase === "drive" && exam.vehicleId !== null;
}

export function examModel(kind: ExamKind): number {
  return kind === "car" ? PREMIER : WAYFARER;
}

export function kindFromModel(model: number): ExamKind | null {
  if (model === PREMIER) {
    return "car";
  }

  if (model === WAYFARER) {
    return "moto";
  }

  return null;
}

export function canEnterAutoschoolExamVehicle(player: Player, vehicle: Vehicle): boolean {
  const exam = getExam(player);
  if (!exam || exam.phase !== "drive") {
    return false;
  }

  try {
    return kindFromModel(vehicle.getModel()) === exam.kind;
  } catch {
    return false;
  }
}

export function autoschoolExamVehicleDeny(player: Player, vehicle: Vehicle): string | null {
  const exam = getExam(player);
  if (!exam || exam.phase !== "drive") {
    return null;
  }

  try {
    if (kindFromModel(vehicle.getModel()) === exam.kind) {
      return null;
    }
  } catch {
    return null;
  }

  return exam.kind === "car"
    ? "Dlya ekzamena nuzhen avtomobil'."
    : "Dlya ekzamena nuzhen motocikl.";
}
