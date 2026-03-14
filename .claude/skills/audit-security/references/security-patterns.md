# Security Patterns — restaurant-agent

## Known safe patterns

### Session auth (chat route)
```typescript
if (!clientToken || !verifySession(clientSessionId, clientToken)) {
  res.status(401).json({ error: "Invalid session token", code: "UNAUTHORIZED" });
  return;
}
```
This is correct. Any route accessing session data must follow this pattern.

### Admin auth middleware
Applied via `router.use(adminAuth)` at router level. Correct for `/tenants` routes.

### Tenant resolution
`resolveTenantMiddleware(registry)` reads `X-Tenant-ID` header and sets `req.tenantId`.
Must be applied to any route that accesses tenant-scoped data.

### Validated body access
Always use `validate(schema)` before accessing `req.body`. Never cast `req.body` directly without prior validation middleware.

## Known vulnerable patterns

### Twilio auth skip (intentional in dev)
```typescript
if (process.env.NODE_ENV === 'development') { /* skip validation */ }
```
This is intentional for local dev but MUST have `TWILIO_AUTH_TOKEN` validated at startup for production.

### getOrderBySession (no tenant filter) — CRITICAL BUG
```typescript
// UNSAFE — returns orders from any tenant
export function getOrderBySession(sessionId: string): Order | undefined
// SAFE — use this instead
export function getOrderBySessionAndTenant(sessionId: string, tenantId: string): Order | undefined
```

### Debug log leaking request body — HIGH
```typescript
console.log("WHATSAPP HIT", req.body);  // src/routes/whatsapp.ts:13
```
Logs user messages (phone numbers, order content) to stdout. GDPR risk.

### adminAuth wrong error code — LOW
```typescript
res.status(401).json({ error: "Unauthorized", code: "INTERNAL_ERROR" });  // should be "UNAUTHORIZED"
```

## Env vars required at startup
These must be validated in `server.ts` before the app starts:

| Var | Currently validated? | Impact if missing |
|-----|---------------------|-------------------|
| `SESSION_SECRET` | ✓ Yes (exits) | HMAC broken |
| `ADMIN_API_KEY` | ✗ No (returns 503) | Admin routes unusable |
| `TWILIO_AUTH_TOKEN` | ✗ No (webhook open) | WhatsApp webhook unprotected |
| `ANTHROPIC_API_KEY` | ✗ No | All chat requests fail at runtime |

## Rate limiting
Current: global 60 req/min for all routes.
Admin routes (`/tenants`) should have a stricter limit (e.g. 10 req/min) to prevent brute force on `X-Admin-Key`.
