---
name: add-api-route
description: Scaffold a complete new Express API route for the restaurant-agent project. Use when the user asks to add a new endpoint, create a new route, or add a new API feature. Follows the project's pattern - Zod schema in api.ts → DB functions in db.ts → router function → registration in server.ts. Enforces tenant isolation and middleware conventions.
---

# Add API Route — restaurant-agent

## Stack conventions

- **Router factory**: `export function xyzRouter(registry: TenantRegistry): Router`
- **Tenant resolution**: apply `resolveTenantMiddleware(registry)` at router level (public routes) or `adminAuth` (admin routes)
- **Validation**: use `validate(schema)` middleware, never access `req.body` without it
- **Params**: always cast `req.params as Record<string, string>`
- **Error codes**: use `"VALIDATION_ERROR"` | `"NOT_FOUND"` | `"CONFLICT"` | `"UNAUTHORIZED"` | `"INTERNAL_ERROR"`
- **Async handlers**: always wrap in try/catch and call `next(err)` on error

## Workflow

### 1. Gather requirements

Ask (if not already clear):
- What resource does this route manage? (e.g. `reviews`, `promotions`)
- Is it tenant-scoped (public, needs `X-Tenant-ID`) or admin-only (`X-Admin-Key`)?
- What HTTP methods are needed? (GET list, GET by id, POST, PUT, DELETE)
- What fields does the resource have?

### 2. Add Zod schema to `src/types/api.ts`

```typescript
export const myResourceSchema = z.object({
  field: z.string().min(1),
  // ...
});
export const myResourceUpdateSchema = myResourceSchema.partial();
export type MyResourceInput = z.infer<typeof myResourceSchema>;
```

### 3. Add DB functions to `src/db.ts`

Follow these rules:
- Prepare statements at module level (not inside functions)
- Always include `tenant_id` in WHERE clauses
- Name convention: `getXForTenant`, `insertX`, `deleteX`, `updateX`
- Return typed interfaces (define the interface near the top of db.ts)

```typescript
// Prepared statements (module level)
const stmtGetMyResource = db.prepare("SELECT * FROM my_resources WHERE tenant_id = ?");
const stmtInsertMyResource = db.prepare(
  "INSERT INTO my_resources (tenant_id, field) VALUES (?, ?)"
);

// Exported functions
export function getMyResourcesForTenant(tenantId: string): MyResource[] {
  return stmtGetMyResource.all(tenantId) as MyResource[];
}

export function insertMyResource(tenantId: string, field: string): MyResource {
  const result = stmtInsertMyResource.run(tenantId, field);
  return db.prepare("SELECT * FROM my_resources WHERE id = ?").get(result.lastInsertRowid) as MyResource;
}
```

If a new table is needed, add it to `initDb()` using the migration pattern:
```typescript
db.prepare(`CREATE TABLE IF NOT EXISTS my_resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL DEFAULT 'la-cazuela',
  field TEXT NOT NULL
)`).run();
```

### 4. Create `src/routes/myResource.ts`

Use this template:

```typescript
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { resolveTenantMiddleware } from "../middleware/resolveTenant.js";  // or adminAuth
import { myResourceSchema } from "../types/api.js";
import type { MyResourceInput } from "../types/api.js";
import type { TenantRegistry } from "../tenant-registry.js";
import { getMyResourcesForTenant, insertMyResource } from "../db.js";

type Params = Record<string, string>;

export function myResourceRouter(registry: TenantRegistry) {
  const router = Router();
  router.use(resolveTenantMiddleware(registry));

  router.get("/", (_req, res) => {
    // ...
  });

  router.post("/", validate(myResourceSchema), async (req, res, next) => {
    try {
      const input = req.body as MyResourceInput;
      // ...
    } catch (err) {
      next(err);
    }
  });

  return router;
}
```

### 5. Register in `src/server.ts`

Add import and `app.use()`:
```typescript
import { myResourceRouter } from "./routes/myResource.js";
// ...
app.use("/my-resources", myResourceRouter(registry));
```

### 6. Verify checklist

- [ ] Schema in `api.ts` with proper Zod constraints
- [ ] DB functions use `tenant_id` in all queries
- [ ] Router uses `validate()` before accessing `req.body`
- [ ] `req.params` cast to `Record<string, string>`
- [ ] Async handlers have try/catch + `next(err)`
- [ ] Route registered in `server.ts`
- [ ] Error responses use correct `code` values

## Reference Files

- `references/route-examples.md` — complete examples from existing routes
