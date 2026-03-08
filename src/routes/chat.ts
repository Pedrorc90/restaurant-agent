import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { resolveTenantMiddleware } from "../middleware/resolveTenant.js";
import { chatRequestSchema } from "../types/api.js";
import type { ChatRequest } from "../types/api.js";
import type { TenantRegistry } from "../tenant-registry.js";

export function chatRouter(registry: TenantRegistry) {
  const router = Router();
  router.use(resolveTenantMiddleware(registry));

  router.post("/", validate(chatRequestSchema), async (req, res, next) => {
    const { message, sessionId, stream } = req.body as ChatRequest;
    const agent = registry.getAgent(req.tenantId);

    try {
      if (stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const s = await agent.chatStream(message, sessionId);
        s.on("text", (text) => res.write(`data: ${JSON.stringify({ delta: text })}\n\n`));
        s.on("finalMessage", () => {
          res.write("data: [DONE]\n\n");
          res.end();
        });
        s.on("error", next);
      } else {
        const reply = await agent.chat(message, sessionId);
        res.json({ reply, sessionId, messageCount: agent.getSessionLength(sessionId) });
      }
    } catch (err) {
      next(err);
    }
  });

  return router;
}
