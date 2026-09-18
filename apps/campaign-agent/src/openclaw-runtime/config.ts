import path from "node:path";
import { advertisedMcpTools } from "../harness/mcp-whitelist.ts";
import type { TenantRuntimeConfig } from "../campaign-core/types.ts";

/**
 * Isolated OpenClaw-shaped config for one tenant Gateway process.
 * Matches documented OpenClaw keys: gateway.*, skills.load.extraDirs,
 * agents.defaults.skills, agents.entries.*.skills, mcp.servers.
 *
 * One tenant per process. Agents do not inherit a shared tool dump —
 * each entry sets an explicit skills list (possibly empty) and MCP allowlist.
 */
export type OpenClawDevConfig = {
  gateway: {
    mode: "local";
    port: number;
    bind: "loopback";
    auth: { mode: "token"; token: string };
    controlUi: { enabled: false };
  };
  skills: {
    allowBundled: [];
    load: { extraDirs: string[] };
  };
  agents: {
    defaults: { skills: [] };
    entries: Record<
      string,
      {
        name: string;
        workspace: string;
        skills: string[];
        skillPins: { skill_id: string; version: string }[];
        tools: { allow: string[] };
      }
    >;
  };
  mcp: {
    servers: Record<string, { tools: string[] }>;
  };
  tenant: { tenant_id: string; display_name: string };
};

export function buildOpenClawDevConfig(input: {
  tenant: TenantRuntimeConfig;
  skillsRoot: string;
  workspace: string;
  port: number;
  token: string;
}): OpenClawDevConfig {
  const entries: OpenClawDevConfig["agents"]["entries"] = {};
  for (const agent of input.tenant.published_agents) {
    const mcp = advertisedMcpTools(input.tenant.mcp_servers, agent);
    entries[agent.agent_id] = {
      name: agent.display_name,
      workspace: path.join(input.workspace, "agents", agent.agent_id),
      skills: agent.skills.map((item) => item.skill_id),
      skillPins: agent.skills.map((item) => ({ skill_id: item.skill_id, version: item.version })),
      tools: { allow: mcp.map((tool) => tool.handle) },
    };
  }
  const servers: Record<string, { tools: string[] }> = {};
  for (const server of input.tenant.mcp_servers) {
    servers[server.server_id] = { tools: [...server.tools] };
  }
  return {
    gateway: {
      mode: "local",
      port: input.port,
      bind: "loopback",
      auth: { mode: "token", token: input.token },
      controlUi: { enabled: false },
    },
    skills: {
      allowBundled: [],
      load: { extraDirs: [input.skillsRoot] },
    },
    agents: {
      defaults: { skills: [] },
      entries,
    },
    mcp: { servers },
    tenant: {
      tenant_id: input.tenant.tenant_id,
      display_name: input.tenant.display_name,
    },
  };
}
