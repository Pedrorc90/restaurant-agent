import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { resolveTenantMiddleware } from "../middleware/resolveTenant.js";
import { createOrderSchema } from "../types/api.js";
import type { CreateOrderRequest } from "../types/api.js";
import { insertOrder, getOrderBySessionAndTenant } from "../db.js";
import type { TenantRegistry } from "../tenant-registry.js";

export function ordersRouter(registry: TenantRegistry) {
  const router = Router();
  router.use(resolveTenantMiddleware(registry));

  router.post("/", validate(createOrderSchema), (req, res) => {
    const { sessionId, items, total } = req.body as CreateOrderRequest;
    const orderId = insertOrder(sessionId, req.tenantId, JSON.stringify(items), total);
    res.status(201).json({ orderId, sessionId, status: "pending", total });
  });

  router.get("/:sessionId", (req, res) => {
    const order = getOrderBySessionAndTenant(req.params.sessionId, req.tenantId);
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    res.json({ ...order, items: JSON.parse(order.items) });
  });

  return router;
}
