import { Hono } from "hono";
import type { Env } from "../types/env";

export const healthRoute = new Hono<{ Bindings: Env }>();

healthRoute.get("/health", (c) => {
  return c.json({
    status: "ok",
    app: "ieadpg-d1",
    time: new Date().toISOString(),
    features: {
      kv: !!c.env.OTP_KV,
      queue: !!c.env.WHATSAPP_QUEUE,
      jwt: !!c.env.JWT_SECRET
    }
  });
});
