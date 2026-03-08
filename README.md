# Restaurant Agent

AI-powered ordering assistant for restaurants, built as a multi-tenant REST API.

## Stack

- **Runtime**: Node.js + TypeScript (ESM)
- **Framework**: Express 5
- **Database**: SQLite (better-sqlite3)
- **AI**: Anthropic Claude (claude-haiku-4-5 by default)
- **Integrations**: WhatsApp via Twilio

## How it works

Each tenant (restaurant) has its own menu, business hours, and configuration. The agent handles conversations with customers, allowing them to browse the menu, place orders, and check order status — via REST or WhatsApp.

## Setup

```bash
npm install
cp .env.example .env   # fill in your values
npm run build
npm start
```

### Environment variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Required. Your Anthropic API key. |
| `ADMIN_API_KEY` | Required. Key for admin routes (`/tenants`). |
| `MODEL` | `haiku` / `sonnet` / `opus` (default: haiku) |
| `DATABASE_PATH` | SQLite file path (default: `./data/conversations.db`) |
| `PORT` | Server port (default: 3000) |
| `CORS_ORIGIN` | Allowed CORS origin (default: `*`) |
| `TWILIO_AUTH_TOKEN` | Required for WhatsApp integration |

## API

All chat endpoints require the `X-Tenant-ID` header. Admin routes require `X-Admin-Key`.

| Method | Route | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/chat` | Send a message to the agent |
| `GET` | `/session/:id` | Get conversation history |
| `GET` | `/orders` | List orders for a session |
| `POST` | `/whatsapp/webhook` | Twilio WhatsApp webhook |
| `GET/POST/PUT/DELETE` | `/tenants` | Manage tenants (admin) |

## CLI mode

Run an interactive session in the terminal:

```bash
node dist/index.js [model] [tenantId]
```
