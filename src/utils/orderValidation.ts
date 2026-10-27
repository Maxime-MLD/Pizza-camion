import { checkoutConfig } from "../config/checkout.config";
import type { CustomerDetails } from "../types/order";

export function normalizeFrenchPhone(raw: string): string | null {
  if (raw.length > 30 || /[^\d+\s().-]/.test(raw)) return null;
  let value = raw.trim().replace(/\(0\)/g, "").replace(/[\s().-]/g, "");
  if (value.startsWith("0033")) value = `+33${value.slice(4)}`;
  if (/^0[1-9]\d{8}$/.test(value)) return `+33${value.slice(1)}`;
  return /^\+33[1-9]\d{8}$/.test(value) ? value : null;
}
export function validateCustomer(input: CustomerDetails): {
  value: CustomerDetails;
  errors: Partial<Record<keyof CustomerDetails, string>>;
} {
  const value = { ...input, firstName: input.firstName.trim(), lastName: input.lastName.trim(), comment: input.comment.trim() };
  const errors: Partial<Record<keyof CustomerDetails, string>> = {};
  const validName = (name: string) => name.length >= 1 && name.length <= 80 && /^[\p{L}\p{M}][\p{L}\p{M} .’'-]*$/u.test(name);
  if (!validName(value.firstName)) errors.firstName = checkoutConfig.errors.firstName;
  if (!validName(value.lastName)) errors.lastName = checkoutConfig.errors.lastName;
  const phone = normalizeFrenchPhone(value.phone);
  if (!phone) errors.phone = checkoutConfig.errors.phone;
  else value.phone = phone;
  if (input.comment.length > 500) errors.comment = checkoutConfig.errors.comment;
  if (!value.privacyAcknowledged) errors.privacyAcknowledged = checkoutConfig.errors.privacyAcknowledged;
  return { value, errors };
}
