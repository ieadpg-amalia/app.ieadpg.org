CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`telefone` text NOT NULL,
	`nome` text,
	`cpf` text,
	`type` text DEFAULT 'unidentified',
	`birth_date` text,
	`gender` text,
	`categoria` text,
	`origem` text DEFAULT 'grupo_ieadpg_amalia',
	`observacoes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`lid` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_telefone_unique` ON `users` (`telefone`);