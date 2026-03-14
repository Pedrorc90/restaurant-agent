import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";

export const validate = (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`);
      res.status(400).json({ error: errors.join("; "), code: "VALIDATION_ERROR" });
      return;
    }
    req.body = result.data;
    next();
  };
