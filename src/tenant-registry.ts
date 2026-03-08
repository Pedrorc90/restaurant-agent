import { RestaurantAgent } from "./agent.js";
import type { Model } from "./agent.js";
import { getTenant, listTenants } from "./db.js";

export class TenantNotFoundError extends Error {
  constructor(tenantId: string) {
    super(`Tenant not found: ${tenantId}`);
    this.name = "TenantNotFoundError";
  }
}

export class TenantRegistry {
  private agents = new Map<string, RestaurantAgent>();
  private model: Model;

  constructor(model: Model = "claude-haiku-4-5-20251001") {
    this.model = model;
  }

  getAgent(tenantId: string): RestaurantAgent {
    if (this.agents.has(tenantId)) {
      return this.agents.get(tenantId)!;
    }

    const config = getTenant(tenantId);
    if (!config) {
      throw new TenantNotFoundError(tenantId);
    }

    const agent = new RestaurantAgent({ tenantConfig: config, model: this.model });
    this.agents.set(tenantId, agent);
    return agent;
  }

  invalidate(tenantId: string): void {
    this.agents.delete(tenantId);
  }

  preloadAll(): void {
    const tenants = listTenants();
    for (const tenant of tenants) {
      if (tenant.active) {
        const agent = new RestaurantAgent({ tenantConfig: tenant, model: this.model });
        this.agents.set(tenant.id, agent);
      }
    }
    console.log(`Preloaded ${this.agents.size} tenant(s): ${[...this.agents.keys()].join(", ")}`);
  }
}
