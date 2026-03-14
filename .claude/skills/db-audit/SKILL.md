---
name: db-audit
description: Database audit for the restaurant-agent SQLite schema. Use when the user asks to audit the database, check for missing tenant filters, find tenant isolation bugs, check DB indices, or review DB query safety. Scans src/db.ts for missing tenant_id filters, unsafe queries, and missing indices. Returns findings with line references and fixes.
---

# DB Audit — restaurant-agent

## Scope

Audit `src/db.ts` for:

1. **Missing tenant_id filters** — queries that return data across tenants
2. **Unsafe SQL** — string interpolation instead of `?` placeholders
3. **Missing indices** — slow queries without index support
4. **Exported functions without tenant scope** — functions that should have been deprecated
5. **JSON serialization** — stored JSON fields without safe parse/stringify

## Workflow

### 1. Read the DB file

```
E:/Projects/02_Projects/agents/restaurant-agent/src/db.ts
```

Also check callers for context:
- `src/tools.ts` — which DB functions does the agent call?
- `src/routes/orders.ts` — which DB functions do routes call?
- `src/routes/session.ts` — session queries

### 2. Check each exported function

For every exported function in `db.ts`, verify:

**Tenant isolation checklist:**
- [ ] Does it accept `tenantId: string` parameter?
- [ ] Does the SQL WHERE clause include `tenant_id = ?`?
- [ ] Is there a `*ForTenant` variant that should be used instead?

**Known unsafe functions (flag these immediately):**
- `getOrderBySession(sessionId)` — no tenant filter → ISOLATION BUG
- `getMenuItems()` — no tenant filter (use `getMenuItemsForTenant` instead)

**SQL safety:**
- All values must use `?` placeholders, never string interpolation
- Pattern to flag: `` `SELECT ... WHERE id = ${variable}` ``

### 3. Check indices

Read the `initDb()` function and find `CREATE TABLE` statements.

Check if these indices exist:
- `orders(session_id, tenant_id)` — needed for order lookups
- `orders(tenant_id)` — needed for tenant order lists
- `menu_items(tenant_id)` — needed for menu queries
- `conversations(session_id, tenant_id)` — needed for chat history

If a `CREATE INDEX` statement is missing for these, flag it.

### 4. JSON fields

Fields stored as JSON strings: `payment_methods`, `hours`, `items` (orders)

Verify:
- Write path: uses `JSON.stringify()` before INSERT
- Read path: uses `safeJsonParse()` (not raw `JSON.parse()`)

### 5. Output format

```
[SEVERITY] Title
Function: functionName() at db.ts:LINE
Issue: description
Fix: concrete SQL or code change
```

Severity: `CRITICAL` (cross-tenant leak) | `HIGH` (data loss risk) | `MEDIUM` (perf/correctness) | `LOW` (code quality)

At the end, list:
- Functions with confirmed tenant isolation ✓
- Functions with missing tenant filter ✗
- Missing indices
