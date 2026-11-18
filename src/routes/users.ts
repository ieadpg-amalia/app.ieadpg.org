import { Hono } from "hono";
import type { Env } from "../types/env";
import { createDb } from "../db";
import { users } from "../db/schema";

export const usersRoute = new Hono<{ Bindings: Env }>();

const getUsersHandler = async (c: any) => {
  const db = createDb(c.env.DB);
  const rows = await db.select().from(users).all();
  return c.json(rows);
};

usersRoute.get("/api/users", getUsersHandler);
usersRoute.get("/api/usuarios", getUsersHandler);
usersRoute.get("/api/contatos", getUsersHandler);
