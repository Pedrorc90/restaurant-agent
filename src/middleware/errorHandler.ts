import Anthropic from "@anthropic-ai/sdk";
import type { Request, Response, NextFunction } from "express";
import { TenantNotFoundError } from "../tenant-registry.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof TenantNotFoundError) {
    res.status(404).json({ error: err.message, code: "TENANT_NOT_FOUND" });
    return;
  }

  if (err instanceof Anthropic.APIError) {
    const status = err.status === 429 ? 429 : err.status === 400 ? 400 : 502;
    const code = err.status === 429 ? "RATE_LIMITED" : "INTERNAL_ERROR";
    res.status(status).json({ error: err.message, code });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
}
