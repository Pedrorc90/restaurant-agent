# Restaurant Agent — CLAUDE.md

## Stack
- Node.js + TypeScript (ESM, `module: nodenext`)
- Express 5 + Zod v4 + better-sqlite3
- Anthropic SDK (`claude-haiku-4-5-20251001` default)
- Twilio SDK for WhatsApp webhook

## Scripts
```bash
npm run build        # tsc
npm start            # node dist/index.js  (CLI mode)
npm run serve        # node dist/server.js (HTTP server)
npm run dev          # tsx src/index.ts    (CLI dev)
npm run dev:server   # tsx src/server.ts   (HTTP dev)
```

## Architecture
Multi-tenant monolith. Each tenant is isolated by `tenant_id` across all DB tables.

## Key Files
- `src/types/tenant.ts` — TenantConfig, BusinessHours interfaces
- `src/types/api.ts` — Zod schemas (chatRequest, createOrder, tenantConfig, menuItem)
- `src/db.ts` — SQLite init + all DB functions (*ForTenant variants)
- `src/menu.ts` — `buildSystemPrompt(config: TenantConfig)`
- `src/tools.ts` — `executeTool(name, input, sessionId, config)`
- `src/agent.ts` — RestaurantAgent (requires tenantConfig)
- `src/tenant-registry.ts` — TenantRegistry (lazy cache), TenantNotFoundError
- `src/middleware/resolveTenant.ts` — X-Tenant-ID header → req.tenantId
- `src/middleware/adminAuth.ts` — X-Admin-Key header (ADMIN_API_KEY env)
- `src/routes/tenants.ts` — CRUD tenants + menu items (admin protected)
- `src/routes/whatsapp.ts` — Twilio WhatsApp webhook
- `src/server.ts` — uses TenantRegistry, preloads all tenants at startup
- `src/index.ts` — CLI: `node dist/index.js [model] [tenantId]`

## Tenant Resolution
- REST API: `X-Tenant-ID` header via `resolveTenantMiddleware`
- WhatsApp: `From` number → `getTenantByWhatsapp()` → fallback to `la-cazuela`

## DB Schema
Tables: `tenants`, `conversations`, `menu_items`, `orders`
All have `tenant_id TEXT NOT NULL DEFAULT 'la-cazuela'`
Migration uses `PRAGMA table_info` to check before `ALTER TABLE`

## Env Vars (.env)
```
ANTHROPIC_API_KEY=...
TWILIO_AUTH_TOKEN=...
NODE_ENV=development        # skips Twilio signature validation in development
ADMIN_API_KEY=...           # required for /tenants routes
DATABASE_PATH=...           # default: ./data/conversations.db
MODEL=haiku|sonnet|opus
PORT=3000
CORS_ORIGIN=*
```

## WhatsApp / Twilio
- Webhook: `POST /whatsapp/webhook`
- In `NODE_ENV=development` Twilio signature validation (`x-twilio-signature`) is skipped
- Server must be exposed via a public tunnel for Twilio to reach the webhook
- **Tunnel**: `cloudflared` — launched manually from terminal
- Webhook URL to configure in Twilio: `https://<your-domain>/whatsapp/webhook`

## Technical Notes
- Zod v4: `z.record()` requires 2 args: `z.record(z.string(), valueSchema)`
- Express 5: `req.params` is `Record<string, string | string[]>` — cast with `req.params as Record<string, string>`
