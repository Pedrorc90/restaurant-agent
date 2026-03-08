import type { Request, Response, NextFunction } from "express";
import type { TenantRegistry } from "../tenant-registry.js";
import { TenantNotFoundError } from "../tenant-registry.js";

export function resolveTenantMiddleware(registry: TenantRegistry) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const tenantId = req.headers["x-tenant-id"] as string | undefined;
    if (!tenantId) {
      res.status(400).json({ error: "Missing X-Tenant-ID header", code: "VALIDATION_ERROR" });
      return;
    }

    try {
      // Validates existence — throws TenantNotFoundError if not found
      registry.getAgent(tenantId);
      req.tenantId = tenantId;
      next();
    } catch (err) {
      if (err instanceof TenantNotFoundError) {
        res.status(404).json({ error: err.message, code: "TENANT_NOT_FOUND" });
        return;
      }
      next(err);
    }
  };
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      tenantId: string;
    }
  }
}
