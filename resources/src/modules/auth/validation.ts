const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RP_NAME_RE = /^[A-Z][a-z]+_[A-Z][a-z]+$/;
const MIN_AGE = 16;
const MAX_AGE = 80;

export function isRoleplayName(name: string): boolean {
  return RP_NAME_RE.test(name) && name.length >= 5 && name.length <= 24;
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function emailError(email: string): string | null {
  if (email.length < 6 || email.length > 255 || !EMAIL_RE.test(email)) {
    return "Vvedi pochtu vida name@example.com";
  }

  return null;
}

export function passwordError(password: string): string | null {
  if (password.length < 6 || password.length > 32) {
    return "Parol': ot 6 do 32 simvolov";
  }

  if (/\s/.test(password)) {
    return "Parol' ne dolzhen soderzhat' probely";
  }

  return null;
}

export function parseBirthDate(raw: string): { iso: string } | { error: string } {
  const match = raw.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) {
    return { error: "Data v formate DD.MM.YYYY, naprimer 15.04.1998" };
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return { error: "Takoy daty ne sushchestvuet" };
  }

  const age = ageOn(date, new Date());
  if (age < MIN_AGE) {
    return { error: `Registraciya s ${MIN_AGE} let` };
  }

  if (age > MAX_AGE) {
    return { error: "Prover' datu rozhdeniya" };
  }

  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { iso };
}

export function formatBirthDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

function ageOn(birth: Date, now: Date): number {
  let age = now.getFullYear() - birth.getFullYear();
  const month = now.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age;
}
