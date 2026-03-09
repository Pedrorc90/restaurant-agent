# TODO — Pre-launch Audit

## P0 — Blockers (fix before launch)

- [ ] **Cross-session leakage** — `sessionId` comes from client without ownership validation. Any user can read another user's conversation. (`src/routes/chat.ts`, `src/tools.ts`)
- [ ] **Twilio auth** — If `TWILIO_AUTH_TOKEN` is missing from `.env`, the webhook is wide open. Add startup validation. (`src/routes/whatsapp.ts`)
- [ ] **ChatStream persistence** — If client disconnects during streaming, message is never saved and conversation history gets corrupted. (`src/agent.ts`)
- [ ] **JSON.parse without try-catch** — A corrupted DB row crashes the entire process. Wrap all `JSON.parse` calls. (`src/db.ts`, `src/tools.ts`)
- [ ] **`getOrderBySession` missing tenant filter** — A tenant can read orders from another tenant. Real isolation bug. (`src/db.ts:333`)

## P1 — High priority (sprint 1)

- [ ] **Debug logs in production** — `console.log("WHATSAPP HIT", req.body)` leaks user messages to stdout. GDPR risk. (`src/routes/whatsapp.ts:13`)
- [ ] **No rate limiting on Admin API** — Global 60 req/min allows brute force on `X-Admin-Key` (86,400 attempts/day). Add specific rate limit for admin routes.
- [ ] **No business hours enforcement** — Orders are accepted 24/7 even outside configured hours. (`src/tools.ts`, `src/menu.ts`)
- [ ] **No pagination in `listSessions()`** — Returns all sessions in memory. OOM risk with large tenants. (`src/routes/session.ts`)
- [ ] **Wrong error code in adminAuth** — Returns `code: "INTERNAL_ERROR"` on 401. Should be `"UNAUTHORIZED"`. (`src/middleware/adminAuth.ts:12`)
- [ ] **Prompt injection via `systemPromptExtra`** — Tenant config accepts any string, including "Ignore all previous instructions...". Add sanitization. (`src/types/api.ts`)

## P2 — Medium priority (sprint 2)

- [ ] **No timeout on Anthropic client** — Requests can hang indefinitely. Configure timeout.
- [ ] **Missing DB indices** — Add indices on `orders(session_id, tenant_id)` and `menu_items(tenant_id)`.
- [ ] **No structured logging / observability** — No way to diagnose failures in production. Add structured logs and basic metrics.
- [ ] **No API versioning** — Breaking changes affect all clients. Prefix routes with `/v1/`.
- [ ] **`TenantRegistry.preloadAll()` does not scale** — Loads all tenants into memory at startup. Use lazy loading or LRU cache for large deployments.
- [ ] **Zod errors not user-friendly** — Validation error messages are generic. Improve serialization. (`src/middleware/validate.ts`)
- [ ] **`price` minimum too low** — `z.number().positive()` allows 0.0001. Use `z.number().min(0.01)` for currency. (`src/types/api.ts:70`)

## P3 — Low priority (tech debt)

- [ ] **No tenant filter in some DB queries** — Audit all DB functions for missing `tenant_id` filters.
- [ ] **No supported language validation** — `language` field accepts any string but system prompt only handles a subset. (`src/types/api.ts:51`)
- [ ] **No API error code documentation** — Specify which error code is returned in which case.
