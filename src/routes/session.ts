import { Router } from "express";
import { resolveTenantMiddleware } from "../middleware/resolveTenant.js";
import type { TenantRegistry } from "../tenant-registry.js";

export function sessionRouter(registry: TenantRegistry) {
  const router = Router();
  router.use(resolveTenantMiddleware(registry));

  router.get("/", (req, res) => {
    const agent = registry.getAgent(req.tenantId);
    res.json({ sessions: agent.listSessions() });
  });

  router.delete("/:id", (req, res) => {
    const agent = registry.getAgent(req.tenantId);
    agent.clearSession(req.params.id);
    res.status(204).send();
  });

  return router;
}
