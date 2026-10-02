import { findOwnedBusiness } from "./repository";

export function businessOwnershipLabel(userId: number): string {
  const business = findOwnedBusiness(userId);
  if (!business) {
    return "отсутствует";
  }

  return `${business.name} (#${business.id})`;
}
