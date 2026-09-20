export type Gender = "male" | "female";

export function isGender(value: string): value is Gender {
  return value === "male" || value === "female";
}

export const GENDER_LIST_MALE = "Мужской";
export const GENDER_LIST_FEMALE = "Женский";

export function genderLabel(gender: Gender): string {
  return gender === "female" ? GENDER_LIST_FEMALE : GENDER_LIST_MALE;
}

export function genderFromList(listItem: number, inputText: string): Gender | null {
  const raw = inputText.trim().toLowerCase();
  if (raw === GENDER_LIST_MALE.toLowerCase() || raw === "male") {
    return "male";
  }

  if (raw === GENDER_LIST_FEMALE.toLowerCase() || raw === "female") {
    return "female";
  }

  if (listItem === 0) {
    return "male";
  }

  if (listItem === 1) {
    return "female";
  }

  return null;
}

export function byGender(
  gender: Gender | null,
  male: string,
  female: string
): string {
  return gender === "female" ? female : male;
}
