import { z } from "zod";

export const chatRequestSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().uuid().optional(),
  sessionToken: z.string().optional(),
  stream: z.boolean().optional().default(false),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export interface ChatResponse {
  reply: string;
  sessionId: string;
  sessionToken: string;
  messageCount: number;
}

export const orderItemSchema = z.object({
  name: z.string().min(1),
  qty: z.number().int().min(1),
  price: z.number().positive(),
});

export const createOrderSchema = z.object({
  sessionId: z.string().uuid(),
  sessionToken: z.string(),
  items: z.array(orderItemSchema).min(1),
  total: z.number().positive(),
});

export type CreateOrderRequest = z.infer<typeof createOrderSchema>;

export interface ErrorResponse {
  error: string;
  code: "VALIDATION_ERROR" | "RATE_LIMITED" | "INTERNAL_ERROR";
}

export const twilioWebhookSchema = z.object({
  From: z.string().startsWith("whatsapp:"),
  Body: z.string().min(1),
});
export type TwilioWebhook = z.infer<typeof twilioWebhookSchema>;

const businessHoursSchema = z.object({
  open: z.string(),
  close: z.string(),
  closed: z.boolean(),
});

export const tenantConfigSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, "id must be lowercase alphanumeric with dashes"),
  name: z.string().min(1),
  language: z.string().default("es"),
  currency: z.string().default("EUR"),
  currencySymbol: z.string().default("€"),
  deliveryRadiusKm: z.number().positive().default(5),
  minimumOrderAmount: z.number().positive().default(10),
  estimatedDeliveryMinutes: z.number().int().positive().default(45),
  paymentMethods: z.array(z.string()).default(["cash", "transfer"]),
  hours: z.record(z.string(), businessHoursSchema).default({}),
  whatsappNumber: z.string().nullable().default(null),
  systemPromptExtra: z.string().nullable().default(null),
});

export const tenantConfigUpdateSchema = tenantConfigSchema.partial().omit({ id: true });

export type TenantConfigInput = z.infer<typeof tenantConfigSchema>;

export const menuItemSchema = z.object({
  category: z.string().min(1),
  name: z.string().min(1),
  price: z.number().positive(),
});

export type MenuItemInput = z.infer<typeof menuItemSchema>;
