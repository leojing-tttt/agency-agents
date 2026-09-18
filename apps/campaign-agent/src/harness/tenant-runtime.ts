import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PublishedAgentConfig, TenantRuntimeConfig } from "../campaign-core/types.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
export const APP_ROOT = path.resolve(here, "../..");
export const SKILLS_ROOT = path.join(APP_ROOT, "skills");

export const BEAUTY_CAMPAIGN_AGENT: PublishedAgentConfig = {
  agent_id: "beauty-essence-campaign",
  version: "1",
  display_name: "美妆精华战役 Agent",
  skills: [{ skill_id: "brief-parse", version: "1.0" }],
  mcp: [{ server_id: "talent-mdm", tool_names: ["search_talent"] }],
  kb_collection_ids: ["brand-kit-published"],
};

export const SUPPORT_AGENT: PublishedAgentConfig = {
  agent_id: "cs-faq",
  version: "1",
  display_name: "客服 Agent",
  skills: [],
  mcp: [{ server_id: "tickets", tool_names: ["read_ticket"] }],
  kb_collection_ids: ["public-faq"],
};

export function demoTenant(tenantId = "office-content-marketing"): TenantRuntimeConfig {
  return {
    tenant_id: tenantId,
    display_name: "内容营销中心",
    mcp_servers: [
      { server_id: "talent-mdm", tools: ["search_talent", "rate_card", "schedule"] },
      { server_id: "tickets", tools: ["read_ticket"] },
    ],
    published_agents: [BEAUTY_CAMPAIGN_AGENT, SUPPORT_AGENT],
  };
}

/**
 * Isolated runtime config for one tenant + one published agent.
 * Keys never go into the model; this object is the allowlist the loop sees.
 */
export type IsolatedRuntime = {
  tenant: TenantRuntimeConfig;
  agent: PublishedAgentConfig;
  skillsRoot: string;
};

export function isolateRuntime(
  tenant: TenantRuntimeConfig,
  agentId: string,
  skillsRoot = SKILLS_ROOT,
): IsolatedRuntime {
  const agent = tenant.published_agents.find((item) => item.agent_id === agentId);
  if (!agent) {
    throw new Error(`agent_not_published: ${agentId}`);
  }
  return { tenant, agent, skillsRoot };
}
