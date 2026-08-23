import { parsePhoneNumberFromString } from "libphonenumber-js";

export function normalizePhoneNumber(phone: string): string {
  // If number starts with '+', it is already international.
  // We parse it, defaulting to country 'IN' (India) if there's no prefix.
  const parsed = parsePhoneNumberFromString(phone, "IN");
  if (!parsed || !parsed.isValid()) {
    throw new Error("Invalid phone number format");
  }
  return parsed.number; // Returns E.164 formatted string, e.g. +919456071969
}
