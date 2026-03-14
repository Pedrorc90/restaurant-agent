---
name: audit-security
description: Security audit for the restaurant-agent Express API. Use when the user asks to audit security, check for vulnerabilities, review security issues, or find security gaps. Scans routes, middleware, env validation, and known issues from TODO.md. Returns a prioritized list of findings with file:line references and suggested fixes.
---

# Security Audit — restaurant-agent

## Scope

Audit the Express API for security vulnerabilities. Focus on:

1. **Auth & access control** — missing middleware, bypassed checks
2. **Input validation** — unvalidated params, injection vectors
3. **Env var startup validation** — missing required vars not checked at boot
4. **Tenant isolation** — cross-tenant data leakage
5. **Information leakage** — debug logs, verbose errors in production
6. **Rate limiting** — missing or insufficient limits on sensitive routes

## Workflow

### 1. Read current state

Load TODO.md to avoid re-reporting already-known issues:
```
E:/Projects/02_Projects/agents/restaurant-agent/TODO.md
```

Read these files to find new issues:
- `src/server.ts` — middleware stack order, rate limits
- `src/middleware/adminAuth.ts` — auth implementation
- `src/middleware/resolveTenant.ts` — tenant resolution
- `src/routes/whatsapp.ts` — Twilio signature validation
- `src/routes/chat.ts` — session auth
- `src/routes/orders.ts` — tenant scoping
- `src/routes/session.ts` — access control
- `src/types/api.ts` — Zod schemas, input constraints

### 2. Check patterns

For each file, look for:

**Auth gaps:**
- Routes without `adminAuth` or `resolveTenantMiddleware`
- Missing `sessionToken` validation before accessing session data

**Env validation:**
- `process.env.X` used without startup check → process can start with broken config
- Pattern: grep for `process.env.` and cross-check with startup validation in `server.ts`

**Injection:**
- `systemPromptExtra` passed directly to LLM without sanitization
- Raw string interpolation in SQL (should use `?` placeholders)

**Tenant isolation:**
- DB functions called without `tenantId` parameter
- `getOrderBySession` (no tenant filter) vs `getOrderBySessionAndTenant` (safe)

**Info leakage:**
- `console.log` in route handlers (especially with `req.body`)
- Stack traces exposed in error responses

**Rate limits:**
- Admin routes with same limit as public routes
- No per-IP or per-tenant limits

### 3. Output format

For each finding:

```
[SEVERITY] Title
File: src/path/file.ts:LINE
Issue: one-line description
Fix: concrete suggestion
```

Severity levels: `CRITICAL` | `HIGH` | `MEDIUM` | `LOW`

Group by severity, highest first.

At the end, summarize:
- Total findings by severity
- Which TODO.md items are still open vs new findings

## Reference Files

- `references/security-patterns.md` — known patterns and anti-patterns for this codebase
