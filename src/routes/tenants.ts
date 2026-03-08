import { Router } from "express";
import { adminAuth } from "../middleware/adminAuth.js";
import { validate } from "../middleware/validate.js";
import { tenantConfigSchema, tenantConfigUpdateSchema, menuItemSchema } from "../types/api.js";
import type { TenantConfigInput, MenuItemInput } from "../types/api.js";
import type { BusinessHours } from "../types/tenant.js";
import {
  listTenants, getTenant, createTenant, updateTenant,
  getMenuItemsForTenant, insertMenuItem, deleteMenuItem,
} from "../db.js";
import type { TenantRegistry } from "../tenant-registry.js";

type Params = Record<string, string>;

export function tenantsRouter(registry: TenantRegistry) {
  const router = Router();
  router.use(adminAuth);

  // GET /tenants
  router.get("/", (_req, res) => {
    res.json({ tenants: listTenants() });
  });

  // GET /tenants/:id
  router.get("/:id", (req, res) => {
    const { id } = req.params as Params;
    const tenant = getTenant(id);
    if (!tenant) {
      res.status(404).json({ error: `Tenant not found: ${id}`, code: "NOT_FOUND" });
      return;
    }
    res.json(tenant);
  });

  // POST /tenants
  router.post("/", validate(tenantConfigSchema), (req, res) => {
    const input = req.body as TenantConfigInput;
    const existing = getTenant(input.id);
    if (existing) {
      res.status(409).json({ error: `Tenant already exists: ${input.id}`, code: "CONFLICT" });
      return;
    }
    const tenant = createTenant({
      id: input.id,
      name: input.name,
      language: input.language,
      currency: input.currency,
      currencySymbol: input.currencySymbol,
      deliveryRadiusKm: input.deliveryRadiusKm,
      minimumOrderAmount: input.minimumOrderAmount,
      estimatedDeliveryMinutes: input.estimatedDeliveryMinutes,
      paymentMethods: input.paymentMethods,
      hours: input.hours as Record<string, BusinessHours>,
      whatsappNumber: input.whatsappNumber,
      systemPromptExtra: input.systemPromptExtra,
    });
    res.status(201).json(tenant);
  });

  // PUT /tenants/:id
  router.put("/:id", validate(tenantConfigUpdateSchema), (req, res) => {
    const { id } = req.params as Params;
    const input = req.body as Partial<TenantConfigInput>;
    const updated = updateTenant(id, {
      name: input.name,
      language: input.language,
      currency: input.currency,
      currencySymbol: input.currencySymbol,
      deliveryRadiusKm: input.deliveryRadiusKm,
      minimumOrderAmount: input.minimumOrderAmount,
      estimatedDeliveryMinutes: input.estimatedDeliveryMinutes,
      paymentMethods: input.paymentMethods,
      hours: input.hours as Record<string, BusinessHours> | undefined,
      whatsappNumber: input.whatsappNumber,
      systemPromptExtra: input.systemPromptExtra,
    });
    if (!updated) {
      res.status(404).json({ error: `Tenant not found: ${id}`, code: "NOT_FOUND" });
      return;
    }
    registry.invalidate(id);
    res.json(updated);
  });

  // GET /tenants/:id/menu
  router.get("/:id/menu", (req, res) => {
    const { id } = req.params as Params;
    const tenant = getTenant(id);
    if (!tenant) {
      res.status(404).json({ error: `Tenant not found: ${id}`, code: "NOT_FOUND" });
      return;
    }
    res.json({ items: getMenuItemsForTenant(id) });
  });

  // POST /tenants/:id/menu
  router.post("/:id/menu", validate(menuItemSchema), (req, res) => {
    const { id } = req.params as Params;
    const tenant = getTenant(id);
    if (!tenant) {
      res.status(404).json({ error: `Tenant not found: ${id}`, code: "NOT_FOUND" });
      return;
    }
    const { category, name, price } = req.body as MenuItemInput;
    const item = insertMenuItem(id, category, name, price);
    res.status(201).json(item);
  });

  // DELETE /tenants/:id/menu/:itemId
  router.delete("/:id/menu/:itemId", (req, res) => {
    const { id, itemId: itemIdStr } = req.params as Params;
    const itemId = Number(itemIdStr);
    if (isNaN(itemId)) {
      res.status(400).json({ error: "Invalid item ID", code: "VALIDATION_ERROR" });
      return;
    }
    const deleted = deleteMenuItem(id, itemId);
    if (!deleted) {
      res.status(404).json({ error: "Menu item not found", code: "NOT_FOUND" });
      return;
    }
    res.status(204).send();
  });

  return router;
}
