import { Hono } from "hono";
import type { Env } from "../types/env";
import { lookupCpf } from "../services/cpf";

export const cpfRoute = new Hono<{ Bindings: Env }>();

cpfRoute.get("/api/cpf/:cpf", async (c) => {
  const apiKey = c.env.CPFHUB_API_KEY;
  if (!apiKey) {
    return c.json({ success: false, error: "CPFHUB_API_KEY não configurada no servidor" }, 500);
  }

  const rawCpf = c.req.param("cpf");
  const result = await lookupCpf(rawCpf, apiKey);

  if (!result.found) {
    return c.json(
      { success: false, data: null, error: result.error },
      result.statusCode as any
    );
  }

  return c.json({
    success: true,
    data: result.data
  });
});
