/** Domain types for campaign-core. Code and comments are English; UI copy may be Chinese. */

export type ArtifactType = "Brief" | "Proposal" | "TalentShortlist" | "ContentPack";

export type GateState =
  | "drafting"
  | "blocked"
  | "in_review"
  | "approved_internal"
  | "locked";

export type CampaignStatus = "draft" | "active" | "pending_client" | "closed" | "archived";

export type AssigneeRole = "AE" | "planner" | "talent_ops" | "media" | "content" | "commerce";

export type OpenQuestion = {
  id: string;
  assignee_role: AssigneeRole;
  field: string;
  question: string;
  blocking: boolean;
};

export type Citation = {
  source_filename: string;
  page?: number;
  quote: string;
};

export type BudgetBand = {
  /** Amounts are only set when present in the source. Never invented. */
  talent_fee?: number;
  production?: number;
  period_weeks?: number;
  currency?: string;
  raw: string;
};

export type BriefPayload = {
  objective: string | null;
  kpis: string[];
  budget_band: BudgetBand | null;
  platforms_include: string[];
  platforms_exclude: string[];
  talents_must_include: string[];
  talents_must_exclude: string[];
  selling_points: string[];
  ban_claims: string[];
  time_anchors: string[];
  notes: string | null;
};

export type PlatformPlay = {
  platform: string;
  format: string;
  role: string;
};

export type BudgetSplit = {
  /** Amounts are copied from the pinned Brief band only. Never invented. */
  talent_fee?: number;
  production?: number;
  media?: number;
  reserve?: number;
  currency?: string;
  raw: string;
  matches_brief_band: boolean;
};

export type ProposalPage = {
  title: string;
  purpose: string;
};

export type ProposalPayload = {
  insight: string | null;
  strategy_idea: string | null;
  comm_idea: string | null;
  audience: string | null;
  platform_play: PlatformPlay[];
  budget_split: BudgetSplit | null;
  phasing: string[];
  pages: ProposalPage[];
  sample_content_hooks: string[];
  source_brief_version_id: string;
};

export type Artifact<T = unknown> = {
  object_id: string;
  type: ArtifactType;
  version: number;
  version_id: string;
  tenant_id: string;
  campaign_id: string;
  gate_state: GateState;
  payload: T;
  open_questions: OpenQuestion[];
  citations: Citation[];
  created_at: string;
  created_by: "agent" | "human";
  supersedes_version?: number;
};

export type BriefArtifact = Artifact<BriefPayload>;
export type ProposalArtifact = Artifact<ProposalPayload>;

export type MemoryPinKind =
  | "parsed_brief"
  | "confirmed_brief"
  | "drafted_proposal"
  | "frozen_strategy"
  | "locked_row"
  | "rulepack";

/** Campaign memory records facts that already happened, always pinned to an artifact version. */
export type MemoryPin = {
  pin_id: string;
  campaign_id: string;
  tenant_id: string;
  kind: MemoryPinKind;
  object_type: ArtifactType;
  object_id: string;
  object_version: number;
  version_id: string;
  recorded_at: string;
  note?: string;
};

export type TalentRowLock = {
  row_id: string;
  talent_name: string;
  platform: string;
  placement: string;
  lock_state: "unlocked" | "locked";
  artifact_id?: string;
  artifact_version?: number;
};

export type ContentPackPayload = {
  talent_name: string;
  platform: string;
  placement: string;
  locked_row_id: string;
  script?: string;
};

export type ThreadMessageKind = "text" | "artifact_card" | "wait" | "open_questions";

export type ThreadMessage = {
  id: string;
  campaign_id: string;
  role: "user" | "agent" | "system";
  agent_name?: "brief_parse" | "plan" | "talent" | "content";
  kind: ThreadMessageKind;
  /** Projection text. Not source of truth for artifacts. */
  text: string;
  artifact_ref?: { object_id: string; version: number; version_id: string };
  created_at: string;
};

export type Campaign = {
  campaign_id: string;
  tenant_id: string;
  name: string;
  status: CampaignStatus;
  created_at: string;
  /** Job graph flags. Content node exists; cards still require locked rows. */
  nodes: { plan: boolean; talent: boolean; content: boolean };
};

export type SkillPin = {
  skill_id: string;
  version: string;
};

export type McpAllow = {
  server_id: string;
  tool_names: string[];
};

export type RegisteredMcpServer = {
  server_id: string;
  tools: string[];
};

export type PublishedAgentConfig = {
  agent_id: string;
  version: string;
  display_name: string;
  skills: SkillPin[];
  mcp: McpAllow[];
  kb_collection_ids: string[];
};

export type TenantRuntimeConfig = {
  tenant_id: string;
  display_name: string;
  /** Tenant-level MCP registry. Tools still must be checked on the agent. */
  mcp_servers: RegisteredMcpServer[];
  published_agents: PublishedAgentConfig[];
};

export type ContentSurface =
  | {
      kind: "wait_message";
      cards: [];
      wait_message: string;
      locked_row_count: 0;
    }
  | {
      kind: "cards";
      cards: Artifact<ContentPackPayload>[];
      wait_message: null;
      locked_row_count: number;
    };
