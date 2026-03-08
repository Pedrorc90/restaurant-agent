import { Router } from "express";
import express from "express";
import twilio from "twilio";
import { validate } from "../middleware/validate.js";
import { twilioWebhookSchema } from "../types/api.js";
import { getTenantByWhatsapp } from "../db.js";
import type { TenantRegistry } from "../tenant-registry.js";

export function whatsappRouter(registry: TenantRegistry) {
  const router = Router();
  router.use(express.urlencoded({ extended: false }));

  router.post("/", (req, res, next) => { console.log("WHATSAPP HIT", req.body); next(); }, validate(twilioWebhookSchema), async (req, res, next) => {
    const authToken = process.env.TWILIO_AUTH_TOKEN ?? "";
    const signature = req.headers["x-twilio-signature"] as string;
    const url = `${req.protocol}://${req.get("host")}/whatsapp`;

    if (process.env.NODE_ENV !== "development" && !twilio.validateRequest(authToken, signature, url, req.body)) {
      res.status(403).send("Forbidden");
      return;
    }

    const { From: fromNumber, Body: message } = req.body as { From: string; Body: string };

    // Resolve tenant by WhatsApp number (strip "whatsapp:" prefix for lookup)
    const phoneNumber = fromNumber.replace(/^whatsapp:/, "");
    const tenantConfig = getTenantByWhatsapp(phoneNumber) ?? getTenantByWhatsapp(fromNumber);

    if (!tenantConfig) {
      // Fallback to default tenant if no specific mapping found
      const fallbackTenant = registry.getAgent("la-cazuela");
      try {
        const reply = await fallbackTenant.chat(message, fromNumber);
        const twiml = new twilio.twiml.MessagingResponse();
        twiml.message(reply);
        res.type("text/xml").send(twiml.toString());
      } catch (err) {
        next(err);
      }
      return;
    }

    try {
      const agent = registry.getAgent(tenantConfig.id);
      const reply = await agent.chat(message, fromNumber);
      const twiml = new twilio.twiml.MessagingResponse();
      twiml.message(reply);
      res.type("text/xml").send(twiml.toString());
    } catch (err) {
      next(err);
    }
  });

  return router;
}
