import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { resolveTenantMiddleware } from "../middleware/resolveTenant.js";
import { createOrderSchema } from "../types/api.js";
import type { CreateOrderRequest } from "../types/api.js";
import { insertOrder, getOrderBySessionAndTenant } from "../db.js";
import type { TenantRegistry } from "../tenant-registry.js";
import { verifySession } from "../session-auth.js";

export function ordersRouter(registry: TenantRegistry) {
  const router = Router();
  router.use(resolveTenantMiddleware(registry));

  router.post("/", validate(createOrderSchema), (req, res) => {
    const { sessionId, sessionToken, items, total } = req.body as CreateOrderRequest;
    if (!verifySession(sessionId, sessionToken)) {
      res.status(401).json({ error: "Invalid session token", code: "UNAUTHORIZED" });
      return;
    }
    const orderId = insertOrder(sessionId, req.tenantId, JSON.stringify(items), total);
    res.status(201).json({ orderId, sessionId, status: "pending", total });
  });

  router.get("/:sessionId", (req, res) => {
    const { sessionId } = req.params as Record<string, string>;
    const sessionToken = req.headers["x-session-token"] as string | undefined;
    if (!sessionToken || !verifySession(sessionId, sessionToken)) {
      res.status(401).json({ error: "Invalid session token", code: "UNAUTHORIZED" });
      return;
    }
    const order = getOrderBySessionAndTenant(sessionId, req.tenantId);
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    let parsedItems: unknown = order.items;
    try { parsedItems = JSON.parse(order.items); } catch { /* keep raw string */ }
    res.json({ ...order, items: parsedItems });
  });

  return router;
}
