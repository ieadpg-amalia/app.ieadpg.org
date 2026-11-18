export interface OtpPayload {
  code: string;
  userId?: number;
  phone: string;
  attempts: number;
  createdAt: number;
}

export function generateNumericOtp(digits = 6): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits) - 1;
  const num = min + (array[0] % (max - min + 1));
  return num.toString();
}

export function getOtpKvKey(phoneOrIdentifier: string): string {
  const clean = phoneOrIdentifier.replace(/\D/g, "");
  return `otp:${clean}`;
}
