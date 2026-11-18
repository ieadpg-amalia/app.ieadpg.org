import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import type { Env, WhatsAppQueueMessage } from "./types/env";
import { healthRoute } from "./routes/health";
import { authRoute } from "./routes/auth";
import { contactRoute } from "./routes/contact";
import { usersRoute } from "./routes/users";
import { cpfRoute } from "./routes/cpf";
import { handleWhatsAppQueue } from "./consumer";

const app = new Hono<{ Bindings: Env }>();

// Middlewares globais de segurança e CORS
app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));

app.use("*", secureHeaders());

// Registro de rotas modulares
app.route("/", healthRoute);
app.route("/", authRoute);
app.route("/", contactRoute);
app.route("/", usersRoute);
app.route("/", cpfRoute);

// Fallback para Assets estáticos da SPA (Portal do Membro)
app.all("*", async (c) => {
  if (c.env.ASSETS) {
    const res = await c.env.ASSETS.fetch(c.req.raw);
    if (res.status !== 404) {
      return res;
    }
    // Fallback de SPA para rotas não-API
    const url = new URL(c.req.url);
    if (c.req.method === "GET" && !url.pathname.startsWith("/api/")) {
      const indexReq = new Request(new URL("/", c.req.url), c.req.raw);
      return await c.env.ASSETS.fetch(indexReq);
    }
  }

  return c.text("Not Found", 404);
});

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<WhatsAppQueueMessage>, env: Env): Promise<void> {
    await handleWhatsAppQueue(batch, env);
  }
};
