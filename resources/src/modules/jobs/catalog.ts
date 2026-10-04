import { byGender, type Gender } from "../auth/gender";

export const JOB_NONE = 0;
export const JOB_BUS_DRIVER = 1;

export type JobDef = {
  id: number;
  /** Название в паспорте / статистике / бирже. */
  title: string;
  /** Минимальный уровень персонажа для устройства. */
  minLevel: number;
};

const JOBS: readonly JobDef[] = [
  { id: JOB_BUS_DRIVER, title: "Водитель автобуса", minLevel: 2 },
];

const byId = new Map(JOBS.map((job) => [job.id, job]));

export function getJob(jobId: number): JobDef | null {
  return byId.get(jobId) ?? null;
}

export function isKnownJobId(jobId: number): boolean {
  return jobId === JOB_NONE || byId.has(jobId);
}

/** Подпись для паспорта/статистики с учётом пола. */
export function jobLabel(jobId: number, gender: Gender | null): string {
  if (jobId === JOB_NONE || !byId.has(jobId)) {
    return byGender(gender, "Безработный", "Безработная");
  }

  return byId.get(jobId)!.title;
}

/**
 * Тело диалога TABLIST_HEADERS.
 * listItem 0 — уволиться; 1+ — работа из каталога.
 */
export function jobHireDialogBody(): string {
  return [
    "Работа\tУровень",
    "Уволиться с работы\t—",
    ...JOBS.map((job) => `${job.title}\t${job.minLevel} LVL`),
  ].join("\n");
}

/** listItem 0 — уволиться; 1+ — работа из каталога. */
export function jobIdFromHireListItem(listItem: number): number | null {
  if (!Number.isInteger(listItem) || listItem < 0) {
    return null;
  }
  if (listItem === 0) {
    return JOB_NONE;
  }
  const job = JOBS[listItem - 1];
  return job?.id ?? null;
}
