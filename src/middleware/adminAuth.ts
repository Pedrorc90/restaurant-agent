import type { Request, Response, NextFunction } from "express";

export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    res.status(503).json({ error: "Admin API not configured", code: "INTERNAL_ERROR" });
    return;
  }

  const provided = req.headers["x-admin-key"] as string | undefined;
  if (!provided || provided !== adminKey) {
    res.status(401).json({ error: "Unauthorized", code: "INTERNAL_ERROR" });
    return;
  }

  next();
}
