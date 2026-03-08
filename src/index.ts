import "dotenv/config";
import * as readline from "readline";
import * as crypto from "crypto";
import { initDb, getTenant } from "./db.js";
import { RestaurantAgent } from "./agent.js";
import type { Model } from "./agent.js";

const AVAILABLE_MODELS: Record<string, Model> = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-6",
};

function parseModel(arg: string | undefined): Model {
  if (!arg) return "claude-haiku-4-5-20251001";
  const model = AVAILABLE_MODELS[arg.toLowerCase()];
  if (!model) {
    console.warn(`Unknown model "${arg}". Using haiku by default.`);
    return "claude-haiku-4-5-20251001";
  }
  return model;
}

async function main() {
  const modelArg = process.argv[2];
  const tenantArg = process.argv[3] ?? "la-cazuela";
  const model = parseModel(modelArg);

  initDb();

  const tenantConfig = getTenant(tenantArg);
  if (!tenantConfig) {
    console.error(`Tenant not found: ${tenantArg}`);
    process.exit(1);
  }

  const agent = new RestaurantAgent({ model, tenantConfig });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let sessionId = crypto.randomUUID();

  console.log(`\n${tenantConfig.name} - Restaurant Assistant`);
  console.log(`   Model: ${model}`);
  console.log(`   Tenant: ${tenantConfig.id}`);
  console.log(`   Session: ${sessionId}`);
  console.log(`   Type "exit" to quit, "reset" to start a new conversation.\n`);

  const ask = () => {
    rl.question("You: ", async (input) => {
      const text = input.trim();

      if (!text) return ask();

      if (text.toLowerCase() === "exit") {
        console.log("Goodbye!");
        rl.close();
        return;
      }

      if (text.toLowerCase() === "reset") {
        agent.clearSession(sessionId);
        sessionId = crypto.randomUUID();
        console.log(`--- New conversation started (session: ${sessionId}) ---\n`);
        return ask();
      }

      try {
        const response = await agent.chat(text, sessionId);
        console.log(`\nAssistant: ${response}\n`);
      } catch (err) {
        console.error("Error:", err);
      }

      ask();
    });
  };

  ask();
}

main().catch(console.error);
