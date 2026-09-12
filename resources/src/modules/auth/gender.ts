export type Gender = "male" | "female";

export function isGender(value: string): value is Gender {
  return value === "male" || value === "female";
}

export function genderLabel(gender: Gender): string {
  return gender === "female" ? "женский" : "мужской";
}

export function byGender(
  gender: Gender | null,
  male: string,
  female: string
): string {
  return gender === "female" ? female : male;
}
