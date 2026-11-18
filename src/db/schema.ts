import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  telefone: text("telefone").notNull().unique(),
  nome: text("nome"),
  cpf: text("cpf"),
  type: text("type").$type<"unidentified" | "member" | "visitor">().default("unidentified"),
  birthDate: text("birth_date"),
  gender: text("gender").$type<"m" | "f">(),
  categoria: text("categoria"),
  origem: text("origem").default("grupo_ieadpg_amalia"),
  observacoes: text("observacoes"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  lid: text("lid")
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
