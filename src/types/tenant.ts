export interface BusinessHours {
  open: string;    // "11:00"
  close: string;   // "19:00"
  closed: boolean;
}

export interface TenantConfig {
  id: string;
  name: string;
  language: string;
  currency: string;
  currencySymbol: string;
  deliveryRadiusKm: number;
  minimumOrderAmount: number;
  estimatedDeliveryMinutes: number;
  paymentMethods: string[];
  hours: Record<string, BusinessHours>;
  whatsappNumber: string | null;
  systemPromptExtra: string | null;
  active: number;
  createdAt: string;
}
