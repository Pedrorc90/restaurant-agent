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
  price: z.number().min(0.01),
});

export const createOrderSchema = z.object({
  sessionId: z.string().uuid(),
  sessionToken: z.string(),
  items: z.array(orderItemSchema).min(1),
  total: z.number().min(0.01),
});

export type CreateOrderRequest = z.infer<typeof createOrderSchema>;

export interface ErrorResponse {
  error: string;
  code: "VALIDATION_ERROR" | "RATE_LIMITED" | "INTERNAL_ERROR" | "UNAUTHORIZED";
}

export const twilioWebhookSchema = z.object({
  From: z.string().startsWith("whatsapp:"),
  Body: z.string().min(1),
});
export type TwilioWebhook = z.infer<typeof twilioWebhookSchema>;

const XML_FORBIDDEN = ["</", "<instructions", "<system", "<restaurant_data", "<extra_context"] as const;
const rejectsXmlInjection = (v: string) => !XML_FORBIDDEN.some((p) => v.includes(p));
const xmlInjectionMsg = "Field contains a forbidden XML pattern";

const businessHoursSchema = z.object({
  open: z.string().regex(/^\d{2}:\d{2}$/, "open must be HH:MM format"),
  close: z.string().regex(/^\d{2}:\d{2}$/, "close must be HH:MM format"),
  closed: z.boolean(),
});

export const tenantConfigSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, "id must be lowercase alphanumeric with dashes"),
  name: z.string().min(1).max(100)
    .refine((v) => !/\n{3,}/.test(v), "name must not contain more than 2 consecutive newlines")
    .refine(rejectsXmlInjection, xmlInjectionMsg),
  language: z.string().default("es"),
  currency: z.string().default("EUR"),
  currencySymbol: z.string().default("€"),
  deliveryRadiusKm: z.number().positive().default(5),
  minimumOrderAmount: z.number().positive().default(10),
  estimatedDeliveryMinutes: z.number().int().positive().default(45),
  paymentMethods: z.array(
    z.string().max(50).regex(/^[^<>\n\r\x00-\x1f]+$/, "paymentMethod contains forbidden characters"),
  ).max(10).default(["cash", "transfer"]),
  hours: z.record(z.string(), businessHoursSchema).default({}),
  whatsappNumber: z.string().nullable().default(null),
  systemPromptExtra: z.string()
    .max(500, "systemPromptExtra must be 500 characters or less")
    .refine(rejectsXmlInjection, xmlInjectionMsg)
    .refine((v) => !/\n{6,}/.test(v), "systemPromptExtra must not contain more than 5 consecutive newlines")
    .nullable()
    .default(null),
});

export const tenantConfigUpdateSchema = tenantConfigSchema.partial().omit({ id: true });

export type TenantConfigInput = z.infer<typeof tenantConfigSchema>;

export const menuItemSchema = z.object({
  category: z.string().min(1).max(50).regex(/^[^\n\r]+$/, "category must not contain newlines"),
  name: z.string().min(1).max(100).regex(/^[^\n\r]+$/, "name must not contain newlines"),
  price: z.number().min(0.01),
});

export type MenuItemInput = z.infer<typeof menuItemSchema>;
