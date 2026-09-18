import type { MemoryPin, MemoryPinKind, ArtifactType } from "./types.ts";
import { newId, nowIso, versionId } from "./ids.ts";

/**
 * Campaign memory is an index of facts pinned to artifact versions.
 * The conversation thread is not this index and must not be treated as truth.
 */
export class CampaignMemoryIndex {
  private readonly pins: MemoryPin[] = [];

  pin(input: {
    campaign_id: string;
    tenant_id: string;
    kind: MemoryPinKind;
    object_type: ArtifactType;
    object_id: string;
    object_version: number;
    note?: string;
  }): MemoryPin {
    const pin: MemoryPin = {
      pin_id: newId("pin"),
      campaign_id: input.campaign_id,
      tenant_id: input.tenant_id,
      kind: input.kind,
      object_type: input.object_type,
      object_id: input.object_id,
      object_version: input.object_version,
      version_id: versionId(input.object_id, input.object_version),
      recorded_at: nowIso(),
      note: input.note,
    };
    this.pins.push(pin);
    return pin;
  }

  /**
   * Active pin for a kind is the latest recorded pin of that kind in the campaign.
   * It still points at a specific version; it never means "read whatever is newest".
   */
  activePin(
    tenantId: string,
    campaignId: string,
    kind: MemoryPinKind,
  ): MemoryPin | undefined {
    const matches = this.pins.filter(
      (pin) =>
        pin.tenant_id === tenantId &&
        pin.campaign_id === campaignId &&
        pin.kind === kind,
    );
    return matches[matches.length - 1];
  }

  list(tenantId: string, campaignId: string): MemoryPin[] {
    return this.pins.filter(
      (pin) => pin.tenant_id === tenantId && pin.campaign_id === campaignId,
    );
  }
}
