export const VALID_DDDS = new Set([
  "11", "12", "13", "14", "15", "16", "17", "18", "19",
  "21", "22", "24", "27", "28",
  "31", "32", "33", "34", "35", "37", "38",
  "41", "42", "43", "44", "45", "46", "47", "48", "49",
  "51", "53", "54", "55",
  "61", "62", "63", "64", "65", "66", "67", "68", "69",
  "71", "73", "74", "75", "77", "79",
  "81", "82", "83", "84", "85", "86", "87", "88", "89",
  "91", "92", "93", "94", "95", "96", "97", "98", "99"
]);

export function normalizeBrazilianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 13) {
    return digits;
  }
  if (digits.length >= 10 && digits.length <= 11) {
    return `55${digits}`;
  }
  return digits;
}

export function isValidBrazilianPhone(raw: string): boolean {
  const normalized = normalizeBrazilianPhone(raw);
  if (!normalized.startsWith("55")) return false;
  const local = normalized.slice(2);
  if (local.length !== 10 && local.length !== 11) return false;
  const ddd = local.slice(0, 2);
  if (!VALID_DDDS.has(ddd)) return false;
  if (local.length === 11 && local[2] !== "9") {
    return false;
  }
  return true;
}

export function maskPhone(phone: string): string {
  return phone.replace(/(\d{4})\d+(\d{2})/, "$1****$2");
}
