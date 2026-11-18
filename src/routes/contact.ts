import { Hono } from "hono";
import { or, eq } from "drizzle-orm";
import type { Env } from "../types/env";
import { createDb } from "../db";
import { users } from "../db/schema";
import { isValidBrazilianPhone, normalizeBrazilianPhone, maskPhone } from "../services/phone";
import { generateNumericOtp, getOtpKvKey, type OtpPayload } from "../services/otp";
import { isValidCpf, lookupCpf } from "../services/cpf";
import { signUserToken } from "../services/jwt";

export const contactRoute = new Hono<{ Bindings: Env }>();

interface PhoneVerificationBody {
  phone?: string;
}

interface OtpVerificationBody {
  phone?: string;
  code?: string;
}

interface CompleteCpfBody {
  cpf?: string;
  nome?: string;
  birthDate?: string;
  gender?: string;
  userId?: number;
}

contactRoute.post("/api/contato/verificar-whatsapp", async (c) => {
  if (!c.env.OTP_KV) {
    return c.json({ success: false, error: "OTP_KV não configurado" }, 500);
  }

  try {
    const body: PhoneVerificationBody = await c.req.json<PhoneVerificationBody>().catch(() => ({}));
    const rawPhone = body.phone?.trim();

    if (!rawPhone || !isValidBrazilianPhone(rawPhone)) {
      return c.json({
        success: false,
        error: "Número de WhatsApp inválido. Digite o DDD e o número completo (ex: (42) 99999-9999)."
      }, 400);
    }

    const normalizedPhone = normalizeBrazilianPhone(rawPhone);
    const db = createDb(c.env.DB);

    const existingMember = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.telefone, normalizedPhone),
          eq(users.telefone, normalizedPhone.replace(/^55/, ""))
        )
      )
      .get();

    if (existingMember) {
      return c.json({
        success: false,
        exists: true,
        error: "Este número de WhatsApp já possui cadastro. Acesse diretamente a tela de login."
      }, 409);
    }

    const otpCode = generateNumericOtp(6);
    const kvKey = getOtpKvKey(normalizedPhone);
    const otpPayload: OtpPayload = {
      code: otpCode,
      phone: normalizedPhone,
      attempts: 0,
      createdAt: Date.now()
    };

    await c.env.OTP_KV.put(kvKey, JSON.stringify(otpPayload), {
      expirationTtl: 300
    });

    const textMessage = `[IEADPG Amália] Bem-vindo(a)! Seu código de verificação é: *${otpCode}*.\nVálido por 5 minutos.`;

    if (c.env.WHATSAPP_QUEUE) {
      await c.env.WHATSAPP_QUEUE.send({
        recipient: normalizedPhone,
        message: textMessage,
        type: "otp"
      });
    }

    return c.json({
      success: true,
      exists: false,
      phone: normalizedPhone,
      phoneMasked: maskPhone(normalizedPhone),
      expiresInSeconds: 300
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao processar número";
    return c.json({ success: false, error: message }, 500);
  }
});

contactRoute.post("/api/contato/verificar-otp", async (c) => {
  if (!c.env.OTP_KV || !c.env.JWT_SECRET) {
    return c.json({ success: false, error: "Serviço de autenticação incompleto no servidor" }, 500);
  }

  try {
    const body: OtpVerificationBody = await c.req.json<OtpVerificationBody>().catch(() => ({}));
    const rawPhone = body.phone?.trim();
    const code = body.code?.trim();

    if (!rawPhone || !code) {
      return c.json({ success: false, error: "Telefone e código são obrigatórios" }, 400);
    }

    const normalizedPhone = normalizeBrazilianPhone(rawPhone);
    const kvKey = getOtpKvKey(normalizedPhone);
    const storedJson = await c.env.OTP_KV.get(kvKey);

    if (!storedJson) {
      return c.json({ success: false, error: "Código expirado ou não solicitado. Peça um novo envio." }, 400);
    }

    const otpData = JSON.parse(storedJson) as OtpPayload;

    if (otpData.attempts >= 3) {
      await c.env.OTP_KV.delete(kvKey);
      return c.json({ success: false, error: "Limite de tentativas excedido. Solicite um novo código." }, 429);
    }

    if (otpData.code !== code) {
      otpData.attempts += 1;
      await c.env.OTP_KV.put(kvKey, JSON.stringify(otpData), { expirationTtl: 300 });
      return c.json({ success: false, error: "Código incorreto" }, 400);
    }

    await c.env.OTP_KV.delete(kvKey);

    const db = createDb(c.env.DB);
    const insertRes = await db
      .insert(users)
      .values({
        telefone: normalizedPhone,
        nome: "Novo Cadastro (Em preenchimento)",
        type: "unidentified"
      })
      .returning()
      .get();

    const token = await signUserToken(
      {
        userId: insertRes.id,
        phone: insertRes.telefone,
        type: insertRes.type || "unidentified"
      },
      c.env.JWT_SECRET,
      "7d"
    );

    return c.json({
      success: true,
      token,
      user: insertRes
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao verificar código e criar cadastro";
    return c.json({ success: false, error: message }, 500);
  }
});

contactRoute.post("/api/contato/completar-cpf", async (c) => {
  try {
    const body: CompleteCpfBody = await c.req.json<CompleteCpfBody>().catch(() => ({}));

    const rawCpf = body.cpf?.trim();
    if (!rawCpf || !isValidCpf(rawCpf)) {
      return c.json({ success: false, error: "CPF inválido." }, 400);
    }

    const cleanCpf = rawCpf.replace(/\D/g, "");
    const db = createDb(c.env.DB);

    let populatedName = body.nome?.trim() || "";
    let populatedBirthDate = body.birthDate?.trim() || null;
    let populatedGender = body.gender ? (body.gender.toLowerCase() as "m" | "f") : null;
    let source = "manual";

    if (c.env.CPFHUB_API_KEY) {
      const cpfLookup = await lookupCpf(cleanCpf, c.env.CPFHUB_API_KEY);
      if (cpfLookup.found && cpfLookup.data) {
        source = "cpfhub";
        populatedName = cpfLookup.data.name || populatedName;
        if (cpfLookup.data.birthDate && cpfLookup.data.birthDate.includes("/")) {
          const parts = cpfLookup.data.birthDate.split("/");
          if (parts.length === 3) {
            populatedBirthDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
          }
        } else {
          populatedBirthDate = cpfLookup.data.birthDate || populatedBirthDate;
        }
        populatedGender = cpfLookup.data.gender ? (cpfLookup.data.gender.toLowerCase() as "m" | "f") : populatedGender;
      }
    }

    if (!populatedName) {
      return c.json({
        success: false,
        needsManualFill: true,
        cpf: cleanCpf,
        error: "Dados cadastrais não retornados pela API. Por favor, confirme seu Nome Completo."
      }, 422);
    }

    let updatedUser = null;
    if (body.userId) {
      updatedUser = await db
        .update(users)
        .set({
          cpf: cleanCpf,
          nome: populatedName,
          birthDate: populatedBirthDate,
          gender: populatedGender
        })
        .where(eq(users.id, body.userId))
        .returning()
        .get();
    }

    return c.json({
      success: true,
      source,
      cpf: cleanCpf,
      data: {
        nome: populatedName,
        birthDate: populatedBirthDate,
        gender: populatedGender
      },
      user: updatedUser || null
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao validar e salvar CPF";
    return c.json({ success: false, error: message }, 500);
  }
});
