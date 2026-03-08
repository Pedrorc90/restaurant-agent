import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname } from "path";
import type Anthropic from "@anthropic-ai/sdk";
import type { TenantConfig } from "./types/tenant.js";

export interface MenuItem {
  id: number;
  tenant_id: string;
  category: string;
  name: string;
  price: number;
  active: number;
}

export interface Order {
  id: number;
  session_id: string;
  tenant_id: string;
  status: "pending" | "preparing" | "on_the_way" | "delivered";
  items: string;
  total: number;
  created_at: string;
}

interface ConversationRow {
  role: string;
  content: string;
}

interface TenantRow {
  id: string;
  name: string;
  language: string;
  currency: string;
  currency_symbol: string;
  delivery_radius_km: number;
  minimum_order_amount: number;
  estimated_delivery_minutes: number;
  payment_methods: string;
  hours: string;
  whatsapp_number: string | null;
  system_prompt_extra: string | null;
  active: number;
  created_at: string;
}

let db: Database.Database;

let stmtGetMessages: Database.Statement;
let stmtInsertMessage: Database.Statement;
let stmtCountMessages: Database.Statement;
let stmtTrimSession: Database.Statement;
let stmtDeleteSession: Database.Statement;
let stmtListSessions: Database.Statement;
let stmtGetMenuItems: Database.Statement;
let stmtGetMenuItemsForTenant: Database.Statement;
let stmtGetOrderBySession: Database.Statement;
let stmtGetOrderBySessionAndTenant: Database.Statement;

function hasColumn(tableName: string, columnName: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
  return rows.some((r) => r.name === columnName);
}

export function initDb(): void {
  const dbPath = process.env.DATABASE_PATH ?? "./data/conversations.db";
  mkdirSync(dirname(dbPath), { recursive: true });

  db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id                          TEXT PRIMARY KEY,
      name                        TEXT NOT NULL,
      language                    TEXT NOT NULL DEFAULT 'es',
      currency                    TEXT NOT NULL DEFAULT 'EUR',
      currency_symbol             TEXT NOT NULL DEFAULT '€',
      delivery_radius_km          REAL NOT NULL DEFAULT 5,
      minimum_order_amount        REAL NOT NULL DEFAULT 10,
      estimated_delivery_minutes  INTEGER NOT NULL DEFAULT 45,
      payment_methods             TEXT NOT NULL DEFAULT '["cash","transfer"]',
      hours                       TEXT NOT NULL DEFAULT '{}',
      whatsapp_number             TEXT,
      system_prompt_extra         TEXT,
      active                      INTEGER NOT NULL DEFAULT 1,
      created_at                  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role       TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content    TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_conversations_session
      ON conversations(session_id);

    CREATE TABLE IF NOT EXISTS menu_items (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      name     TEXT NOT NULL,
      price    REAL NOT NULL,
      active   INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS orders (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      status     TEXT NOT NULL CHECK(status IN ('pending','preparing','on_the_way','delivered')),
      items      TEXT NOT NULL,
      total      REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrations: add tenant_id columns if missing
  if (!hasColumn("conversations", "tenant_id")) {
    db.exec(`ALTER TABLE conversations ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'la-cazuela'`);
  }
  if (!hasColumn("menu_items", "tenant_id")) {
    db.exec(`ALTER TABLE menu_items ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'la-cazuela'`);
  }
  if (!hasColumn("orders", "tenant_id")) {
    db.exec(`ALTER TABLE orders ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'la-cazuela'`);
  }

  // Seed default tenant if missing
  const tenantExists = db.prepare("SELECT COUNT(*) as cnt FROM tenants WHERE id = 'la-cazuela'").get() as { cnt: number };
  if (tenantExists.cnt === 0) {
    db.prepare(`
      INSERT INTO tenants (id, name, language, currency, currency_symbol, delivery_radius_km,
        minimum_order_amount, estimated_delivery_minutes, payment_methods, hours)
      VALUES ('la-cazuela', 'La Cazuela', 'es', 'EUR', '€', 5, 10, 45,
        '["cash","transfer"]',
        '{"monday":{"open":"11:00","close":"19:00","closed":false},"tuesday":{"open":"11:00","close":"19:00","closed":false},"wednesday":{"open":"11:00","close":"19:00","closed":false},"thursday":{"open":"11:00","close":"19:00","closed":false},"friday":{"open":"11:00","close":"19:00","closed":false},"saturday":{"open":"11:00","close":"19:00","closed":false},"sunday":{"open":"11:00","close":"19:00","closed":true}}')
    `).run();
  }

  // Seed menu_items for la-cazuela if empty
  const menuCount = (db.prepare("SELECT COUNT(*) as cnt FROM menu_items WHERE tenant_id = 'la-cazuela'").get() as { cnt: number }).cnt;
  if (menuCount === 0) {
    const insertItem = db.prepare("INSERT INTO menu_items (tenant_id, category, name, price) VALUES ('la-cazuela', ?, ?, ?)");
    const seedMenu = db.transaction(() => {
      insertItem.run("Sopas y Caldos", "Sopa de pollo", 8.00);
      insertItem.run("Sopas y Caldos", "Estofado de res", 9.50);
      insertItem.run("Sopas y Caldos", "Sopa de lentejas", 7.00);
      insertItem.run("Platos Principales", "Pollo asado (medio)", 12.00);
      insertItem.run("Platos Principales", "Res con papas", 13.50);
      insertItem.run("Platos Principales", "Chuleta de cerdo a la plancha", 11.00);
      insertItem.run("Platos Principales", "Salteado de verduras", 9.00);
      insertItem.run("Acompañamientos", "Arroz blanco", 2.00);
      insertItem.run("Acompañamientos", "Ensalada mixta", 2.50);
      insertItem.run("Acompañamientos", "Pure de papas", 2.50);
      insertItem.run("Acompañamientos", "Platano frito", 1.50);
      insertItem.run("Bebidas", "Jugo natural (naranja/mango/guayaba)", 3.00);
      insertItem.run("Bebidas", "Agua", 1.00);
      insertItem.run("Bebidas", "Refresco", 2.00);
    });
    seedMenu();
  }

  stmtGetMessages   = db.prepare("SELECT role, content FROM conversations WHERE session_id = ? AND tenant_id = ? ORDER BY id");
  stmtInsertMessage = db.prepare("INSERT INTO conversations (session_id, tenant_id, role, content) VALUES (?, ?, ?, ?)");
  stmtCountMessages = db.prepare("SELECT COUNT(*) as cnt FROM conversations WHERE session_id = ? AND tenant_id = ?");
  stmtTrimSession   = db.prepare(`
    DELETE FROM conversations WHERE id IN (
      SELECT id FROM conversations WHERE session_id = ? AND tenant_id = ? ORDER BY id LIMIT 2
    )
  `);
  stmtDeleteSession = db.prepare("DELETE FROM conversations WHERE session_id = ? AND tenant_id = ?");
  stmtListSessions  = db.prepare("SELECT session_id FROM conversations WHERE tenant_id = ? GROUP BY session_id ORDER BY MIN(created_at)");
  stmtGetMenuItems      = db.prepare("SELECT id, tenant_id, category, name, price, active FROM menu_items WHERE active = 1 ORDER BY id");
  stmtGetMenuItemsForTenant = db.prepare("SELECT id, tenant_id, category, name, price, active FROM menu_items WHERE tenant_id = ? AND active = 1 ORDER BY id");
  stmtGetOrderBySession = db.prepare("SELECT id, session_id, tenant_id, status, items, total, created_at FROM orders WHERE session_id = ? ORDER BY id DESC LIMIT 1");
  stmtGetOrderBySessionAndTenant = db.prepare("SELECT id, session_id, tenant_id, status, items, total, created_at FROM orders WHERE session_id = ? AND tenant_id = ? ORDER BY id DESC LIMIT 1");
}

function rowToTenantConfig(row: TenantRow): TenantConfig {
  return {
    id: row.id,
    name: row.name,
    language: row.language,
    currency: row.currency,
    currencySymbol: row.currency_symbol,
    deliveryRadiusKm: row.delivery_radius_km,
    minimumOrderAmount: row.minimum_order_amount,
    estimatedDeliveryMinutes: row.estimated_delivery_minutes,
    paymentMethods: JSON.parse(row.payment_methods) as string[],
    hours: JSON.parse(row.hours) as TenantConfig["hours"],
    whatsappNumber: row.whatsapp_number,
    systemPromptExtra: row.system_prompt_extra,
    active: row.active,
    createdAt: row.created_at,
  };
}

// ── Tenant DB functions ────────────────────────────────────────────────────────

export function getTenant(tenantId: string): TenantConfig | undefined {
  const row = db.prepare("SELECT * FROM tenants WHERE id = ? AND active = 1").get(tenantId) as TenantRow | undefined;
  return row ? rowToTenantConfig(row) : undefined;
}

export function getTenantByWhatsapp(whatsappNumber: string): TenantConfig | undefined {
  const row = db.prepare("SELECT * FROM tenants WHERE whatsapp_number = ? AND active = 1").get(whatsappNumber) as TenantRow | undefined;
  return row ? rowToTenantConfig(row) : undefined;
}

export function listTenants(): TenantConfig[] {
  const rows = db.prepare("SELECT * FROM tenants ORDER BY created_at").all() as TenantRow[];
  return rows.map(rowToTenantConfig);
}

export function createTenant(input: {
  id: string; name: string; language: string; currency: string; currencySymbol: string;
  deliveryRadiusKm: number; minimumOrderAmount: number; estimatedDeliveryMinutes: number;
  paymentMethods: string[]; hours: TenantConfig["hours"];
  whatsappNumber: string | null; systemPromptExtra: string | null;
}): TenantConfig {
  db.prepare(`
    INSERT INTO tenants (id, name, language, currency, currency_symbol, delivery_radius_km,
      minimum_order_amount, estimated_delivery_minutes, payment_methods, hours,
      whatsapp_number, system_prompt_extra)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.id, input.name, input.language, input.currency, input.currencySymbol,
    input.deliveryRadiusKm, input.minimumOrderAmount, input.estimatedDeliveryMinutes,
    JSON.stringify(input.paymentMethods), JSON.stringify(input.hours),
    input.whatsappNumber, input.systemPromptExtra,
  );
  return getTenant(input.id)!;
}

export function updateTenant(tenantId: string, input: Partial<{
  name: string; language: string; currency: string; currencySymbol: string;
  deliveryRadiusKm: number; minimumOrderAmount: number; estimatedDeliveryMinutes: number;
  paymentMethods: string[]; hours: TenantConfig["hours"];
  whatsappNumber: string | null; systemPromptExtra: string | null; active: number;
}>): TenantConfig | undefined {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  const fieldMap: Record<string, string> = {
    name: "name", language: "language", currency: "currency",
    currencySymbol: "currency_symbol", deliveryRadiusKm: "delivery_radius_km",
    minimumOrderAmount: "minimum_order_amount", estimatedDeliveryMinutes: "estimated_delivery_minutes",
    whatsappNumber: "whatsapp_number", systemPromptExtra: "system_prompt_extra", active: "active",
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in input) {
      setClauses.push(`${col} = ?`);
      values.push((input as Record<string, unknown>)[key]);
    }
  }
  if (input.paymentMethods !== undefined) {
    setClauses.push("payment_methods = ?");
    values.push(JSON.stringify(input.paymentMethods));
  }
  if (input.hours !== undefined) {
    setClauses.push("hours = ?");
    values.push(JSON.stringify(input.hours));
  }

  if (setClauses.length === 0) return getTenant(tenantId);
  values.push(tenantId);
  db.prepare(`UPDATE tenants SET ${setClauses.join(", ")} WHERE id = ?`).run(...values);
  return getTenant(tenantId);
}

// ── Conversation functions (tenant-scoped) ────────────────────────────────────

export function getMessages(sessionId: string, tenantId: string): Anthropic.MessageParam[] {
  const rows = stmtGetMessages.all(sessionId, tenantId) as ConversationRow[];
  return rows.map((r) => ({ role: r.role as "user" | "assistant", content: r.content }));
}

export function insertMessage(sessionId: string, tenantId: string, role: "user" | "assistant", content: string): void {
  stmtInsertMessage.run(sessionId, tenantId, role, content);
}

export function trimSession(sessionId: string, tenantId: string, maxMessages: number): void {
  const row = stmtCountMessages.get(sessionId, tenantId) as { cnt: number };
  if (row.cnt > maxMessages) {
    stmtTrimSession.run(sessionId, tenantId);
  }
}

export function deleteSession(sessionId: string, tenantId: string): void {
  stmtDeleteSession.run(sessionId, tenantId);
}

export function listSessionIds(tenantId: string): string[] {
  const rows = stmtListSessions.all(tenantId) as { session_id: string }[];
  return rows.map((r) => r.session_id);
}

export function countMessages(sessionId: string, tenantId: string): number {
  const row = stmtCountMessages.get(sessionId, tenantId) as { cnt: number };
  return row.cnt;
}

// ── Menu functions (tenant-scoped) ───────────────────────────────────────────

export function getMenuItems(): MenuItem[] {
  return stmtGetMenuItems.all() as MenuItem[];
}

export function getMenuItemsForTenant(tenantId: string): MenuItem[] {
  return stmtGetMenuItemsForTenant.all(tenantId) as MenuItem[];
}

export function insertMenuItem(tenantId: string, category: string, name: string, price: number): MenuItem {
  const result = db.prepare(
    "INSERT INTO menu_items (tenant_id, category, name, price) VALUES (?, ?, ?, ?)"
  ).run(tenantId, category, name, price);
  return db.prepare("SELECT * FROM menu_items WHERE id = ?").get(result.lastInsertRowid) as MenuItem;
}

export function deleteMenuItem(tenantId: string, itemId: number): boolean {
  const result = db.prepare("DELETE FROM menu_items WHERE id = ? AND tenant_id = ?").run(itemId, tenantId);
  return result.changes > 0;
}

// ── Order functions (tenant-scoped) ──────────────────────────────────────────

export function getOrderBySession(sessionId: string): Order | undefined {
  return stmtGetOrderBySession.get(sessionId) as Order | undefined;
}

export function getOrderBySessionAndTenant(sessionId: string, tenantId: string): Order | undefined {
  return stmtGetOrderBySessionAndTenant.get(sessionId, tenantId) as Order | undefined;
}

export function insertOrder(sessionId: string, tenantId: string, items: string, total: number): number {
  const result = db.prepare(
    "INSERT INTO orders (session_id, tenant_id, status, items, total) VALUES (?, ?, 'pending', ?, ?)"
  ).run(sessionId, tenantId, items, total);
  return result.lastInsertRowid as number;
}
