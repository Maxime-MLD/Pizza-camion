import { isPlaceholderValue } from "./placeholders";

export interface MailtoOptions {
  subject?: string;
  body?: string;
  cc?: string;
  bcc?: string;
}

export function isConfiguredLinkValue(value: string): boolean {
  const normalizedValue = value.trim();
  return normalizedValue.length > 0 && !isPlaceholderValue(normalizedValue);
}

export function createTelHref(phone: string): string | undefined {
  if (!isConfiguredLinkValue(phone)) {
    return undefined;
  }

  const trimmedPhone = phone.trim();
  const prefix = trimmedPhone.startsWith("+") ? "+" : "";
  const digits = trimmedPhone.replace(/\D/g, "");

  return digits.length > 0 ? `tel:${prefix}${digits}` : undefined;
}

export function createMailtoHref(
  email: string,
  options: MailtoOptions = {},
): string | undefined {
  const normalizedEmail = email.trim();

  if (
    !isConfiguredLinkValue(normalizedEmail) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  ) {
    return undefined;
  }

  const parameters = new URLSearchParams();

  if (options.subject) parameters.set("subject", options.subject);
  if (options.body) parameters.set("body", options.body);
  if (options.cc) parameters.set("cc", options.cc);
  if (options.bcc) parameters.set("bcc", options.bcc);

  const query = parameters.toString();
  return `mailto:${normalizedEmail}${query ? `?${query}` : ""}`;
}
