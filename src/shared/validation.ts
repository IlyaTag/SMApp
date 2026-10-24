import { parsePhoneNumberFromString } from "libphonenumber-js/min";

export const MAX_TEXT_LENGTH = 4096;

export function normalizePhone(value: string): string {
  const phone = parsePhoneNumberFromString(value);

  if (
    !value.trim().startsWith("+") ||
    !phone?.isPossible() ||
    !Number.isSafeInteger(Number(phone.number.slice(1)))
  )
    throw new Error("Введите международный номер с + и кодом страны.");

  return phone.number;
}

// Conservative UTF-16 limit until the provider's Unicode counting is verified live.
export function validText(value: string) {
  return value.trim().length > 0 && value.length <= MAX_TEXT_LENGTH;
}
