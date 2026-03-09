import { Router } from "express";
import { randomUUID } from "crypto";
import { validate } from "../middleware/validate.js";
import { resolveTenantMiddleware } from "../middleware/resolveTenant.js";
import { chatRequestSchema } from "../types/api.js";
import type { ChatRequest } from "../types/api.js";
import type { TenantRegistry } from "../tenant-registry.js";
import { signSession, verifySession } from "../session-auth.js";

export function chatRouter(registry: TenantRegistry) {
  const router = Router();
  router.use(resolveTenantMiddleware(registry));

  router.post("/", validate(chatRequestSchema), async (req, res, next) => {
    const { message, sessionId: clientSessionId, sessionToken: clientToken, stream } = req.body as ChatRequest;
    const agent = registry.getAgent(req.tenantId);

    let sessionId: string;
    let sessionToken: string;

    if (!clientSessionId) {
      // New session: generate and sign
      sessionId = randomUUID();
      sessionToken = signSession(sessionId);
    } else {
      // Existing session: validate ownership
      if (!clientToken || !verifySession(clientSessionId, clientToken)) {
        res.status(401).json({ error: "Invalid session token", code: "UNAUTHORIZED" });
        return;
      }
      sessionId = clientSessionId;
      sessionToken = clientToken;
    }

    try {
      if (stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Session-ID", sessionId);
        res.setHeader("X-Session-Token", sessionToken);

        const s = await agent.chatStream(message, sessionId);
        s.on("text", (text) => res.write(`data: ${JSON.stringify({ delta: text })}\n\n`));
        s.on("finalMessage", () => {
          res.write(`data: ${JSON.stringify({ sessionId, sessionToken })}\n\n`);
          res.write("data: [DONE]\n\n");
          res.end();
        });
        s.on("error", next);
      } else {
        const reply = await agent.chat(message, sessionId);
        res.json({ reply, sessionId, sessionToken, messageCount: agent.getSessionLength(sessionId) });
      }
    } catch (err) {
      next(err);
    }
  });

  return router;
}
