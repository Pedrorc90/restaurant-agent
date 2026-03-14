# TODO — Pre-launch Audit

## P0 — Blockers (fix before launch)

- [X] **Cross-session leakage** — `sessionId` comes from client without ownership validation. Any user can read another user's conversation. (`src/routes/chat.ts`, `src/tools.ts`)
- [X] **Twilio auth** — If `TWILIO_AUTH_TOKEN` is missing from `.env`, the webhook is wide open. Add startup validation. (`src/routes/whatsapp.ts`)
- [X] **ChatStream persistence** — If client disconnects during streaming, message is never saved and conversation history gets corrupted. (`src/agent.ts`)
- [X] **JSON.parse without try-catch** — A corrupted DB row crashes the entire process. Wrap all `JSON.parse` calls. (`src/db.ts`, `src/tools.ts`)
- [X] **`getOrderBySession` missing tenant filter** — A tenant can read orders from another tenant. Real isolation bug. (`src/db.ts:333`)

## P1 — High priority (sprint 1)

- [X] **Debug logs in production** — `console.log("WHATSAPP HIT", req.body)` leaks user messages to stdout. GDPR risk. (`src/routes/whatsapp.ts:13`)
- [X] **No rate limiting on Admin API** — Global 60 req/min allows brute force on `X-Admin-Key` (86,400 attempts/day). Add specific rate limit for admin routes.
- [X] **No business hours enforcement** — Orders are accepted 24/7 even outside configured hours. (`src/tools.ts`, `src/menu.ts`)
- [X] **No pagination in `listSessions()`** — Returns all sessions in memory. OOM risk with large tenants. (`src/routes/session.ts`)
- [X] **Wrong error code in adminAuth** — Returns `code: "INTERNAL_ERROR"` on 401. Should be `"UNAUTHORIZED"`. (`src/middleware/adminAuth.ts:12`)
- [X] **Prompt injection via `systemPromptExtra`** — Tenant config accepts any string, including "Ignore all previous instructions...". Add sanitization. (`src/types/api.ts`)

## P2 — Medium priority (sprint 2)

- [X] **No timeout on Anthropic client** — Requests can hang indefinitely. Configure timeout.
- [X] **Missing DB indices** — Add indices on `orders(session_id, tenant_id)` and `menu_items(tenant_id)`.
- [X] **No structured logging / observability** — No way to diagnose failures in production. Add structured logs and basic metrics.
- [X] **No API versioning** — Breaking changes affect all clients. Prefix routes with `/v1/`.
- [X] **`TenantRegistry.preloadAll()` does not scale** — Loads all tenants into memory at startup. Use lazy loading or LRU cache for large deployments.
- [X] **Zod errors not user-friendly** — Validation error messages are generic. Improve serialization. (`src/middleware/validate.ts`)
- [X] **`price` minimum too low** — `z.number().positive()` allows 0.0001. Use `z.number().min(0.01)` for currency. (`src/types/api.ts:70`)

## P3 — Low priority (tech debt)

- [X] **No tenant filter in some DB queries** — Removed `getMenuItems()` (no tenant filter, unused). All active DB functions have tenant isolation.
- [X] **No supported language validation** — `language` now uses `z.enum(["es","en","pt","fr","it","de"])`. (`src/types/api.ts`)
- [X] **No API error code documentation** — Added `docs/error-codes.md` with full code → HTTP status → cause table. Added `TENANT_NOT_FOUND` to `ErrorResponse` type.
