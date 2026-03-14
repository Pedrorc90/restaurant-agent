import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "./menu.js";
import { getMessages, insertMessage, trimSession, deleteSession, listSessionIds, countMessages } from "./db.js";
import { TOOLS, executeTool } from "./tools.js";
import type { TenantConfig } from "./types/tenant.js";

export type Model =
  | "claude-haiku-4-5-20251001"
  | "claude-sonnet-4-6"
  | "claude-opus-4-6";

export interface AgentConfig {
  tenantConfig: TenantConfig;
  model?: Model;
  maxSessionMessages?: number;
}

export class RestaurantAgent {
  private client: Anthropic;
  private model: Model;
  private readonly maxSessionMessages: number;
  private readonly tenantConfig: TenantConfig;

  constructor(config: AgentConfig) {
    this.client = new Anthropic({ timeout: 30_000 });
    this.model = config.model ?? "claude-haiku-4-5-20251001";
    this.maxSessionMessages = config.maxSessionMessages ?? 100;
    this.tenantConfig = config.tenantConfig;
  }

  async chat(userMessage: string, sessionId: string): Promise<string> {
    const tenantId = this.tenantConfig.id;
    insertMessage(sessionId, tenantId, "user", userMessage);
    trimSession(sessionId, tenantId, this.maxSessionMessages);

    const messages: Anthropic.MessageParam[] = getMessages(sessionId, tenantId);
    const systemPrompt = buildSystemPrompt(this.tenantConfig);

    while (true) {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: systemPrompt,
        tools: TOOLS,
        tool_choice: { type: "auto" },
        messages,
      });

      if (response.stop_reason === "tool_use") {
        messages.push({ role: "assistant", content: response.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type === "tool_use") {
            const result = executeTool(block.name, block.input as Record<string, unknown>, sessionId, this.tenantConfig);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result,
            });
          }
        }

        messages.push({ role: "user", content: toolResults });
        continue;
      }

      const assistantMessage =
        response.content[0]?.type === "text" ? response.content[0].text : "";
      insertMessage(sessionId, tenantId, "assistant", assistantMessage);
      return assistantMessage;
    }
  }

  async chatStream(userMessage: string, sessionId: string) {
    const tenantId = this.tenantConfig.id;
    insertMessage(sessionId, tenantId, "user", userMessage);
    trimSession(sessionId, tenantId, this.maxSessionMessages);

    let messages: Anthropic.MessageParam[] = getMessages(sessionId, tenantId);
    const systemPrompt = buildSystemPrompt(this.tenantConfig);

    while (true) {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: systemPrompt,
        tools: TOOLS,
        tool_choice: { type: "auto" },
        messages,
      });

      if (response.stop_reason === "tool_use") {
        messages.push({ role: "assistant", content: response.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type === "tool_use") {
            const result = executeTool(block.name, block.input as Record<string, unknown>, sessionId, this.tenantConfig);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: result,
            });
          }
        }

        messages.push({ role: "user", content: toolResults });
        continue;
      }

      break;
    }

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 1024,
      system: systemPrompt,
      tools: TOOLS,
      messages,
    });

    stream.on("finalMessage", (msg) => {
      const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
      insertMessage(sessionId, tenantId, "assistant", text);
    });

    return stream;
  }

  clearSession(sessionId: string): void       { deleteSession(sessionId, this.tenantConfig.id); }
  listSessions(page = 1, limit = 50)          { return listSessionIds(this.tenantConfig.id, page, limit); }
  getSessionLength(sessionId: string): number { return countMessages(sessionId, this.tenantConfig.id); }
}
