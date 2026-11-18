# IEADPG D1 API & Portal do Membro

Microsserviço de Backend e Portal do Membro da **IEADPG Jardim Amália**, construído para execução na borda da Cloudflare.

## Arquitetura & Stack Tecnológica
- **Runtime**: Cloudflare Workers (ES Modules, TypeScript estrito)
- **Framework Web**: [Hono v4](https://hono.dev/)
- **Persistência**: Cloudflare D1 (`ieadpg-db`) gerenciado via [Drizzle ORM](https://orm.drizzle.team/)
- **Cache & Sessões OTP**: Cloudflare KV (`ieadpg-otp-kv`) com expiração automática (TTL 300s)
- **Mensageria Assíncrona**: Cloudflare Queues (`ieadpg-whatsapp-queue`) com retries automáticos
- **Autenticação**: Tokens JWT baseados em Web Crypto API nativa (`jose` / `crypto.subtle`)
- **Frontend SPA**: Servido nativamente via Cloudflare Workers Assets
- **CI/CD**: GitHub Actions com `cloudflare/wrangler-action`

## Rotas Principais
- `GET /health`: Status de saúde e verificação de bindings ativos.
- `POST /api/contato/verificar-whatsapp`: Validação de telefone brasileiro e emissão de OTP.
- `POST /api/contato/verificar-otp`: Confirmação do OTP, criação do usuário no D1 e retorno de JWT.
- `POST /api/contato/completar-cpf`: Validação de CPF (checksum oficial) e integração com CPF Hub.
- `POST /api/auth/otp/send`: Envio de OTP para login de membro existente via WhatsApp Queue.
- `POST /api/auth/otp/verify`: Autenticação e emissão de token JWT para membro.
- `GET /api/auth/me`: Verificação do token Bearer e recuperação do usuário autenticado.
- `GET /api/users`: Listagem de usuários cadastrados no D1.
- `GET /api/cpf/:cpf`: Consulta e validação de CPF.

## Desenvolvimento Local
```bash
npm install
npm run typecheck
npm run dev
```

## Migrações D1
```bash
npm run db:generate
npm run db:migrate:local
npm run db:migrate:prod
```
