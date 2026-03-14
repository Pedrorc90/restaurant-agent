# Route Examples — restaurant-agent

## Complete tenant-scoped route (orders)

`src/routes/orders.ts`:
```typescript
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { resolveTenantMiddleware } from "../middleware/resolveTenant.js";
import { createOrderSchema } from "../types/api.js";
import type { CreateOrderRequest } from "../types/api.js";
import type { TenantRegistry } from "../tenant-registry.js";
import { getOrderBySessionAndTenant, insertOrder } from "../db.js";
import { verifySession } from "../session-auth.js";

type Params = Record<string, string>;

export function ordersRouter(registry: TenantRegistry) {
  const router = Router();
  router.use(resolveTenantMiddleware(registry));

  router.get("/:sessionId", (req, res) => {
    const { sessionId } = req.params as Params;
    const order = getOrderBySessionAndTenant(sessionId, req.tenantId);
    if (!order) {
      res.status(404).json({ error: "Order not found", code: "NOT_FOUND" });
      return;
    }
    let parsedItems: unknown = order.items;
    try { parsedItems = JSON.parse(order.items); } catch { /* keep raw string */ }
    res.json({ ...order, items: parsedItems });
  });

  router.post("/", validate(createOrderSchema), async (req, res, next) => {
    try {
      const { sessionId, sessionToken, items, total } = req.body as CreateOrderRequest;
      if (!verifySession(sessionId, sessionToken)) {
        res.status(401).json({ error: "Invalid session token", code: "UNAUTHORIZED" });
        return;
      }
      const id = insertOrder(sessionId, req.tenantId, JSON.stringify(items), total);
      res.status(201).json({ id, status: "pending" });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
```

## Admin-only route (tenants)

```typescript
import { adminAuth } from "../middleware/adminAuth.js";

export function tenantsRouter(registry: TenantRegistry) {
  const router = Router();
  router.use(adminAuth);  // all routes protected

  router.get("/", (_req, res) => {
    res.json({ tenants: listTenants() });
  });

  router.post("/", validate(tenantConfigSchema), (req, res) => {
    const input = req.body as TenantConfigInput;
    const existing = getTenant(input.id);
    if (existing) {
      res.status(409).json({ error: `Tenant already exists: ${input.id}`, code: "CONFLICT" });
      return;
    }
    const tenant = createTenant({ ...input });
    res.status(201).json(tenant);
  });

  return router;
}
```

## Error response codes

| Situation | HTTP | code |
|---|---|---|
| Zod validation fails | 400 | `VALIDATION_ERROR` |
| Resource not found | 404 | `NOT_FOUND` |
| Duplicate resource | 409 | `CONFLICT` |
| Bad session token | 401 | `UNAUTHORIZED` |
| Missing admin key | 401 | `UNAUTHORIZED` |
| Unexpected server error | 500 | `INTERNAL_ERROR` |

## Middleware order in server.ts

```typescript
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ?? "*" }));
app.use(express.json({ limit: "10kb" }));
app.use(rateLimit({ windowMs: 60_000, max: 60 }));

// Routes:
app.use("/health", healthRouter);          // no auth
app.use("/tenants", tenantsRouter(...));   // adminAuth inside router
app.use("/chat", chatRouter(...));         // resolveTenant inside + session auth
app.use("/session", sessionRouter(...));   // resolveTenant inside
app.use("/orders", ordersRouter(...));     // resolveTenant inside + session auth
app.use("/whatsapp", whatsappRouter(...)); // Twilio sig validation inside

app.use(errorHandler);  // always last
```

## TypeScript conventions

```typescript
// Always cast params
type Params = Record<string, string>;
const { id } = req.params as Params;

// Express 5 async handler signature
router.post("/", validate(schema), async (req, res, next) => {
  try {
    // ...
  } catch (err) {
    next(err);
  }
});
```
