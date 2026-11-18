import { Hono } from "hono";
import { or, eq } from "drizzle-orm";
import type { Env } from "../types/env";
import { createDb } from "../db";
import { users } from "../db/schema";
import { generateNumericOtp, getOtpKvKey, type OtpPayload } from "../services/otp";
import { maskPhone } from "../services/phone";
import { signUserToken, verifyUserToken, extractBearerToken } from "../services/jwt";

export const authRoute = new Hono<{ Bindings: Env }>();

interface OtpSendBody {
  phone?: string;
  cpf?: string;
}

interface OtpVerifyBody {
  phone?: string;
  cpf?: string;
  code?: string;
}

authRoute.post("/api/auth/otp/send", async (c) => {
  if (!c.env.OTP_KV) {
    return c.json({ success: false, error: "OTP_KV não configurado" }, 500);
  }

  try {
    const body: OtpSendBody = await c.req.json<OtpSendBody>().catch(() => ({}));
    const rawTarget = body.phone || body.cpf;

    if (!rawTarget) {
      return c.json({ success: false, error: "Informe phone ou cpf" }, 400);
    }

    const cleanTarget = rawTarget.replace(/\D/g, "");
    const db = createDb(c.env.DB);

    const member = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.telefone, cleanTarget),
          eq(users.cpf, cleanTarget),
          eq(users.telefone, `55${cleanTarget}`)
        )
      )
      .get();

    if (!member) {
      return c.json({ success: false, error: "Membro não encontrado no cadastro" }, 404);
    }

    const otpCode = generateNumericOtp(6);
    const kvKey = getOtpKvKey(member.telefone);
    const otpPayload: OtpPayload = {
      code: otpCode,
      userId: member.id,
      phone: member.telefone,
      attempts: 0,
      createdAt: Date.now()
    };

    await c.env.OTP_KV.put(kvKey, JSON.stringify(otpPayload), {
      expirationTtl: 300
    });

    const textMessage = `[IEADPG Amália] Seu código de acesso é: *${otpCode}*.\nVálido por 5 minutos. Não compartilhe com ninguém.`;

    if (c.env.WHATSAPP_QUEUE) {
      await c.env.WHATSAPP_QUEUE.send({
        recipient: member.lid ? member.lid : member.telefone,
        message: textMessage,
        type: "otp",
        metadata: { userId: member.id }
      });
    }

    return c.json({
      success: true,
      message: "Código OTP gerado e enfileirado para envio via WhatsApp",
      phoneMasked: maskPhone(member.telefone),
      expiresInSeconds: 300
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao processar envio de OTP";
    return c.json({ success: false, error: message }, 500);
  }
});

authRoute.post("/api/auth/otp/verify", async (c) => {
  if (!c.env.OTP_KV || !c.env.JWT_SECRET) {
    return c.json({ success: false, error: "Serviço de autenticação incompleto no servidor" }, 500);
  }

  try {
    const body: OtpVerifyBody = await c.req.json<OtpVerifyBody>().catch(() => ({}));
    const rawTarget = body.phone || body.cpf;
    const code = body.code?.trim();

    if (!rawTarget || !code) {
      return c.json({ success: false, error: "Informe o identificador (telefone/cpf) e o código code" }, 400);
    }

    const cleanTarget = rawTarget.replace(/\D/g, "");
    const db = createDb(c.env.DB);

    const member = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.telefone, cleanTarget),
          eq(users.cpf, cleanTarget),
          eq(users.telefone, `55${cleanTarget}`)
        )
      )
      .get();

    if (!member) {
      return c.json({ success: false, error: "Usuário não encontrado" }, 404);
    }

    const kvKey = getOtpKvKey(member.telefone);
    const storedJson = await c.env.OTP_KV.get(kvKey);

    if (!storedJson) {
      return c.json({ success: false, error: "Código expirado ou não solicitado" }, 400);
    }

    const otpData = JSON.parse(storedJson) as OtpPayload;

    if (otpData.attempts >= 3) {
      await c.env.OTP_KV.delete(kvKey);
      return c.json({ success: false, error: "Número máximo de tentativas excedido. Solicite um novo código." }, 429);
    }

    if (otpData.code !== code) {
      otpData.attempts += 1;
      await c.env.OTP_KV.put(kvKey, JSON.stringify(otpData), { expirationTtl: 300 });
      return c.json({ success: false, error: "Código incorreto" }, 400);
    }

    await c.env.OTP_KV.delete(kvKey);

    const token = await signUserToken(
      {
        userId: member.id,
        phone: member.telefone,
        type: member.type || "member"
      },
      c.env.JWT_SECRET,
      "7d"
    );

    return c.json({
      success: true,
      token,
      user: {
        id: member.id,
        nome: member.nome,
        telefone: member.telefone,
        type: member.type,
        cpf: member.cpf
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao validar OTP";
    return c.json({ success: false, error: message }, 500);
  }
});

authRoute.get("/api/auth/me", async (c) => {
  const jwtSecret = c.env.JWT_SECRET;
  if (!jwtSecret) {
    return c.json({ success: false, error: "JWT_SECRET não configurado" }, 500);
  }

  const token = extractBearerToken(c.req.raw);
  if (!token) {
    return c.json({ success: false, error: "Token de autenticação não fornecido" }, 401);
  }

  const verified = await verifyUserToken(token, jwtSecret);
  if (!verified.valid) {
    return c.json({ success: false, error: verified.error }, 401);
  }

  return c.json({
    success: true,
    user: verified.payload
  });
});
