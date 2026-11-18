export interface CpfValidationResult {
  valid: boolean;
  normalized: string;
  error?: string;
}

export function validateAndNormalizeCpf(rawCpf: string): CpfValidationResult {
  const digits = rawCpf.replace(/\D/g, "");
  if (digits.length !== 11) {
    return { valid: false, normalized: digits, error: "CPF deve conter exatamente 11 dígitos" };
  }
  if (/^(\d)\1{10}$/.test(digits)) {
    return { valid: false, normalized: digits, error: "CPF com dígitos repetidos é inválido" };
  }
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i], 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(digits[9], 10)) {
    return { valid: false, normalized: digits, error: "Primeiro dígito verificador inválido" };
  }
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i], 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(digits[10], 10)) {
    return { valid: false, normalized: digits, error: "Segundo dígito verificador inválido" };
  }
  return { valid: true, normalized: digits };
}

export function isValidCpf(raw: string): boolean {
  return validateAndNormalizeCpf(raw).valid;
}

export interface CpfHubData {
  name?: string;
  birthDate?: string;
  gender?: string;
  [key: string]: unknown;
}

export interface CpfLookupResult {
  found: boolean;
  data: CpfHubData | null;
  error?: string;
  statusCode: number;
}

export async function lookupCpf(cpfInput: string, apiKey: string): Promise<CpfLookupResult> {
  const validation = validateAndNormalizeCpf(cpfInput);
  if (!validation.valid) {
    return {
      found: false,
      data: null,
      error: validation.error,
      statusCode: 400
    };
  }

  const normalized = validation.normalized;
  const url = `https://api.cpfhub.io/cpf/${normalized}`;
  let attempts = 0;
  const maxAttempts = 3;
  let delayMs = 500;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          "Accept": "application/json"
        }
      });

      const statusCode = res.status;
      if (statusCode === 404) {
        return {
          found: false,
          data: null,
          error: "CPF não encontrado na base de dados",
          statusCode: 404
        };
      }

      const body = (await res.json().catch(() => null)) as { success?: boolean; data?: CpfHubData; error?: string | { message?: string } } | null;

      if (res.ok && body && body.success && body.data) {
        return {
          found: true,
          data: body.data,
          statusCode: 200
        };
      }

      const errorMsg = body
        ? typeof body.error === "string"
          ? body.error
          : body.error?.message || "Erro desconhecido da API"
        : `Erro HTTP ${statusCode}`;

      if ([400, 401, 403, 422].includes(statusCode)) {
        return {
          found: false,
          data: null,
          error: errorMsg,
          statusCode
        };
      }

      if ([500, 502, 503, 504].includes(statusCode)) {
        if (attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, delayMs));
          delayMs *= 2;
          continue;
        }
      }

      return {
        found: false,
        data: null,
        error: errorMsg,
        statusCode
      };
    } catch (err: unknown) {
      if (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, delayMs));
        delayMs *= 2;
        continue;
      }
      return {
        found: false,
        data: null,
        error: err instanceof Error ? err.message : "Falha na conexão com CPF Hub",
        statusCode: 503
      };
    }
  }

  return {
    found: false,
    data: null,
    error: "Tempo de resposta esgotado",
    statusCode: 504
  };
}
