import { Router } from "express";
import { resolveTenantMiddleware } from "../middleware/resolveTenant.js";
import { adminAuth } from "../middleware/adminAuth.js";
import type { TenantRegistry } from "../tenant-registry.js";
import { verifySession } from "../session-auth.js";

export function sessionRouter(registry: TenantRegistry) {
  const router = Router();
  router.use(resolveTenantMiddleware(registry));

  // List sessions — admin only
  router.get("/", adminAuth, (req, res) => {
    const agent = registry.getAgent(req.tenantId);
    res.json({ sessions: agent.listSessions() });
  });

  // Delete session — requires proof of ownership via session token
  router.delete("/:id", (req, res) => {
    const { id } = req.params as Record<string, string>;
    const sessionToken = req.headers["x-session-token"] as string | undefined;
    if (!sessionToken || !verifySession(id, sessionToken)) {
      res.status(401).json({ error: "Invalid session token", code: "UNAUTHORIZED" });
      return;
    }
    const agent = registry.getAgent(req.tenantId);
    agent.clearSession(id);
    res.status(204).send();
  });

  return router;
}
