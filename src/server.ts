import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { initDb } from "./db.js";
import { logger } from "./logger.js";
import { TenantRegistry } from "./tenant-registry.js";
import type { Model } from "./agent.js";
import { chatRouter } from "./routes/chat.js";
import { sessionRouter } from "./routes/session.js";
import { healthRouter } from "./routes/health.js";
import { ordersRouter } from "./routes/orders.js";
import { whatsappRouter } from "./routes/whatsapp.js";
import { tenantsRouter } from "./routes/tenants.js";
import { errorHandler } from "./middleware/errorHandler.js";

const AVAILABLE_MODELS: Record<string, Model> = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-6",
};

const model = AVAILABLE_MODELS[process.env.MODEL ?? ""] ?? "claude-haiku-4-5-20251001";

if (!process.env.SESSION_SECRET) {
  console.error("FATAL: SESSION_SECRET env var is required");
  process.exit(1);
}

if (process.env.NODE_ENV !== "development" && !process.env.TWILIO_AUTH_TOKEN) {
  console.error("FATAL: TWILIO_AUTH_TOKEN env var is required in production");
  process.exit(1);
}

initDb();

const registry = new TenantRegistry(model);

const app = express();

app.set("trust proxy", 1);

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ?? "*" }));
app.use(express.json({ limit: "10kb" }));
app.use(rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false }));

const adminRateLimit = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false });

app.use("/health", healthRouter);
app.use("/v1/tenants", adminRateLimit, tenantsRouter(registry));
app.use("/v1/chat", chatRouter(registry));
app.use("/v1/session", sessionRouter(registry));
app.use("/v1/orders", ordersRouter(registry));
app.use("/v1/whatsapp", whatsappRouter(registry));

app.use(errorHandler);

const PORT = Number(process.env.PORT ?? 3000);
app.listen(PORT, () => logger.info({ port: PORT, model }, "Server running"));
