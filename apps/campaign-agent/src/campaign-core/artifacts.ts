import type { Artifact, ArtifactType } from "./types.ts";
import { nowIsoMonotonic, versionId } from "./ids.ts";

export class ArtifactStore {
  private readonly byObject = new Map<string, Artifact[]>();

  append<T>(input: {
    object_id: string;
    type: ArtifactType;
    tenant_id: string;
    campaign_id: string;
    gate_state: Artifact["gate_state"];
    payload: T;
    open_questions: Artifact["open_questions"];
    citations: Artifact["citations"];
    created_by: Artifact["created_by"];
  }): Artifact<T> {
    const history = this.byObject.get(input.object_id) ?? [];
    const previous = history[history.length - 1];
    if (previous && previous.tenant_id !== input.tenant_id) {
      throw new Error("tenant_isolation: artifact belongs to another tenant");
    }
    if (previous && previous.type !== input.type) {
      throw new Error("artifact type cannot change across versions");
    }
    const version = (previous?.version ?? 0) + 1;
    const artifact: Artifact<T> = {
      object_id: input.object_id,
      type: input.type,
      version,
      version_id: versionId(input.object_id, version),
      tenant_id: input.tenant_id,
      campaign_id: input.campaign_id,
      gate_state: input.gate_state,
      payload: input.payload,
      open_questions: input.open_questions,
      citations: input.citations,
      created_at: nowIsoMonotonic(previous?.created_at),
      created_by: input.created_by,
      supersedes_version: previous?.version,
    };
    this.byObject.set(input.object_id, [...history, artifact as Artifact]);
    return artifact;
  }

  getVersion<T = unknown>(
    tenantId: string,
    objectId: string,
    version: number,
  ): Artifact<T> {
    const history = this.byObject.get(objectId);
    if (!history?.length) {
      throw new Error(`artifact_not_found: ${objectId}`);
    }
    const first = history[0];
    if (first && first.tenant_id !== tenantId) {
      throw new Error("tenant_isolation: artifact belongs to another tenant");
    }
    const found = history.find((item) => item.version === version);
    if (!found) {
      throw new Error(`artifact_version_not_found: ${objectId}:v${version}`);
    }
    return found as Artifact<T>;
  }

  /**
   * Display helper only. Downstream jobs must resolve a memory pin, not "latest".
   */
  getLatestForDisplay<T = unknown>(tenantId: string, objectId: string): Artifact<T> {
    const history = this.byObject.get(objectId);
    if (!history?.length) {
      throw new Error(`artifact_not_found: ${objectId}`);
    }
    const latest = history[history.length - 1];
    if (!latest || latest.tenant_id !== tenantId) {
      throw new Error("tenant_isolation: artifact belongs to another tenant");
    }
    return latest as Artifact<T>;
  }

  history(tenantId: string, objectId: string): Artifact[] {
    const history = this.byObject.get(objectId) ?? [];
    if (history[0] && history[0].tenant_id !== tenantId) {
      throw new Error("tenant_isolation: artifact belongs to another tenant");
    }
    return [...history];
  }

  listForCampaign(tenantId: string, campaignId: string): Artifact[] {
    const out: Artifact[] = [];
    for (const history of this.byObject.values()) {
      for (const artifact of history) {
        if (artifact.tenant_id === tenantId && artifact.campaign_id === campaignId) {
          out.push(artifact);
        }
      }
    }
    return out.sort((a, b) => {
      const byTime = a.created_at.localeCompare(b.created_at);
      if (byTime !== 0) {
        return byTime;
      }
      if (a.object_id === b.object_id) {
        return a.version - b.version;
      }
      return a.object_id.localeCompare(b.object_id);
    });
  }
}
