import type { McpAllow, PublishedAgentConfig, RegisteredMcpServer } from "../campaign-core/types.ts";

export type McpToolRef = {
  server_id: string;
  name: string;
  handle: string;
};

/**
 * Per-agent MCP whitelist. Tenant registry is not a dump into every agent.
 * OpenClaw analogue: session MCP catalog intersected with agents.entries tool allowlist.
 */
export function advertisedMcpTools(
  registry: RegisteredMcpServer[],
  agent: PublishedAgentConfig,
): McpToolRef[] {
  const allowByServer = new Map(agent.mcp.map((item: McpAllow) => [item.server_id, new Set(item.tool_names)]));
  const refs: McpToolRef[] = [];
  for (const server of registry) {
    const allow = allowByServer.get(server.server_id);
    if (!allow) {
      continue;
    }
    for (const tool of server.tools) {
      if (allow.has(tool)) {
        refs.push({
          server_id: server.server_id,
          name: tool,
          handle: `${server.server_id}/${tool}`,
        });
      }
    }
  }
  return refs;
}

export function assertMcpAllowed(tools: McpToolRef[], serverId: string, toolName: string): void {
  const ok = tools.some((tool) => tool.server_id === serverId && tool.name === toolName);
  if (!ok) {
    throw new Error(`mcp_not_allowed: ${serverId}/${toolName}`);
  }
}
