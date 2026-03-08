import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { initDb } from "./db.js";
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

initDb();

const registry = new TenantRegistry(model);
registry.preloadAll();

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ?? "*" }));
app.use(express.json({ limit: "10kb" }));
app.use(rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false }));

app.use("/health", healthRouter);
app.use("/tenants", tenantsRouter(registry));
app.use("/chat", chatRouter(registry));
app.use("/session", sessionRouter(registry));
app.use("/orders", ordersRouter(registry));
app.use("/whatsapp", whatsappRouter(registry));

app.use(errorHandler);

const PORT = Number(process.env.PORT ?? 3000);
app.listen(PORT, () => console.log(`Server running on :${PORT} (model: ${model})`));
