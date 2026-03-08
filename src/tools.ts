import type Anthropic from "@anthropic-ai/sdk";
import { getMenuItemsForTenant, getOrderBySessionAndTenant, insertOrder } from "./db.js";
import type { TenantConfig } from "./types/tenant.js";

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_menu",
    description: "Fetch the current restaurant menu with all available items, categories, and prices. Call this whenever a customer asks about food, dishes, prices, or what is available.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_order_status",
    description: "Get the status of a customer's most recent order by their session ID. Call this when a customer asks about their order, delivery status, or where their food is.",
    input_schema: {
      type: "object" as const,
      properties: {
        session_id: {
          type: "string",
          description: "The session ID of the customer whose order to look up.",
        },
      },
      required: ["session_id"],
    },
  },
  {
    name: "place_order",
    description: "Save a confirmed order to the database when the customer has explicitly confirmed their order. Call this only after the customer clearly confirms what they want to order. Returns the order ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        items: {
          type: "array",
          description: "List of items in the order",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Item name" },
              qty: { type: "number", description: "Quantity" },
              price: { type: "number", description: "Unit price" },
            },
            required: ["name", "qty", "price"],
          },
        },
        total: {
          type: "number",
          description: "Total price",
        },
      },
      required: ["items", "total"],
    },
  },
  {
    name: "get_opening_hours",
    description: "Get the restaurant opening hours, business rules, delivery radius, and order deadlines.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

interface OrderItem {
  name: string;
  qty: number;
  price: number;
}

interface PlaceOrderInput {
  items: OrderItem[];
  total: number;
}

export function executeTool(
  name: string,
  input: Record<string, unknown>,
  sessionId: string,
  config: TenantConfig,
): string {
  const sym = config.currencySymbol;

  switch (name) {
    case "get_menu": {
      const items = getMenuItemsForTenant(config.id);
      if (items.length === 0) return "No menu items available at this time.";

      const byCategory: Record<string, typeof items> = {};
      for (const item of items) {
        if (!byCategory[item.category]) byCategory[item.category] = [];
        byCategory[item.category].push(item);
      }

      const lines: string[] = ["MENU:"];
      for (const [category, categoryItems] of Object.entries(byCategory)) {
        lines.push(`\n${category}:`);
        for (const item of categoryItems) {
          lines.push(`  - ${item.name}: ${item.price.toFixed(2)}${sym}`);
        }
      }
      return lines.join("\n");
    }

    case "place_order": {
      const { items, total } = input as unknown as PlaceOrderInput;
      const orderId = insertOrder(sessionId, config.id, JSON.stringify(items), total);
      return `Order #${orderId} placed successfully. Status: pending. Total: ${total.toFixed(2)}${sym}.`;
    }

    case "get_order_status": {
      const lookupSession = (input.session_id as string) ?? sessionId;
      const order = getOrderBySessionAndTenant(lookupSession, config.id);
      if (!order) {
        return "No order found for this session.";
      }
      const items = JSON.parse(order.items) as Array<{ name: string; qty: number }>;
      const itemList = items.map((i) => `${i.qty}x ${i.name}`).join(", ");
      const STATUS_LABELS: Record<string, string> = {
        pending: "Pending (received, not started yet)",
        preparing: "Being prepared",
        on_the_way: "On the way",
        delivered: "Delivered",
      };
      const statusLabel = STATUS_LABELS[order.status] ?? order.status;
      return `Order #${order.id}: ${statusLabel}. Items: ${itemList}. Total: ${order.total.toFixed(2)}${sym}.`;
    }

    case "get_opening_hours": {
      const lines: string[] = [`${config.name} hours:`];
      for (const [day, h] of Object.entries(config.hours)) {
        lines.push(h.closed ? `- ${day}: closed` : `- ${day}: ${h.open} – ${h.close}`);
      }
      lines.push("");
      lines.push("Business rules:");
      lines.push(`- Orders before closing time`);
      lines.push(`- Delivery radius: ${config.deliveryRadiusKm} km`);
      lines.push(`- Minimum order: ${config.minimumOrderAmount.toFixed(2)}${sym}`);
      lines.push(`- Payment: ${config.paymentMethods.join(", ")}`);
      lines.push(`- Estimated delivery time: ~${config.estimatedDeliveryMinutes} minutes`);
      return lines.join("\n");
    }

    default:
      return `Tool "${name}" not found.`;
  }
}
