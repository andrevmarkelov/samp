export type Licenses = {
  car: boolean;
  moto: boolean;
  fly: boolean;
  boat: boolean;
  gun: boolean;
};

export type LicenseKey = keyof Licenses;

export type LicenseDef = {
  key: LicenseKey;
  label: string;
  offer: string;
  min: number;
  max: number;
};

export const EMPTY_LICENSES: Licenses = {
  car: false,
  moto: false,
  fly: false,
  boat: false,
  gun: false,
};

export const LICENSE_ROWS: readonly LicenseDef[] = [
  { key: "car", label: "Avtomobili", offer: "na avtomobili", min: 5000, max: 50000 },
  { key: "moto", label: "Motocikly", offer: "na motocikly", min: 3000, max: 30000 },
  { key: "fly", label: "Polety", offer: "na polety", min: 20000, max: 150000 },
  { key: "boat", label: "Vodnyy transport", offer: "na vodnyy transport", min: 10000, max: 80000 },
  { key: "gun", label: "Oruzhie", offer: "na oruzhie", min: 15000, max: 100000 },
];

export function licenseFlag(value: unknown): boolean {
  return Boolean(Number(value));
}

export function missingLicenses(licenses: Licenses): LicenseDef[] {
  return LICENSE_ROWS.filter((row) => !licenses[row.key]);
}

export function findLicense(key: string): LicenseDef | null {
  return LICENSE_ROWS.find((row) => row.key === key) ?? null;
}
