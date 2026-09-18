import { describe, expect, it } from "vitest";
import { CampaignCore } from "../src/campaign-core/index.ts";
import { CONTENT_WAIT_MESSAGE } from "../src/campaign-core/gates.ts";

describe("no ungated content cards", () => {
  it("content surface is a wait message with zero cards before any lock", () => {
    const core = new CampaignCore();
    const campaign = core.createCampaign({
      tenant_id: "office-content-marketing",
      name: "美妆精华 Q3 种草",
    });
    core.upsertUnlockedRow(campaign.tenant_id, campaign.campaign_id, {
      row_id: "row_doctor",
      talent_name: "林医生说皮肤",
      platform: "抖音",
      placement: "口播",
      lock_state: "unlocked",
    });

    const surface = core.contentSurface(campaign.tenant_id, campaign.campaign_id);
    expect(surface.kind).toBe("wait_message");
    expect(surface.cards).toEqual([]);
    expect(surface.locked_row_count).toBe(0);
    expect(surface.wait_message).toBe(CONTENT_WAIT_MESSAGE);

    const thread = core.thread(campaign.tenant_id, campaign.campaign_id);
    expect(thread.some((msg) => msg.agent_name === "content" && msg.kind === "wait")).toBe(true);
    expect(thread.some((msg) => msg.kind === "artifact_card" && msg.agent_name === "content")).toBe(
      false,
    );
    expect(
      core.artifacts.listForCampaign(campaign.tenant_id, campaign.campaign_id).filter(
        (item) => item.type === "ContentPack",
      ),
    ).toHaveLength(0);
  });

  it("createContentPack is refused until the shortlist row is locked", () => {
    const core = new CampaignCore();
    const campaign = core.createCampaign({
      tenant_id: "office-content-marketing",
      name: "锁行前",
    });
    core.upsertUnlockedRow(campaign.tenant_id, campaign.campaign_id, {
      row_id: "row_open",
      talent_name: "阿柚实验室",
      platform: "抖音",
      placement: "口播",
      lock_state: "unlocked",
    });
    expect(() =>
      core.createContentPack({
        tenant_id: campaign.tenant_id,
        campaign_id: campaign.campaign_id,
        locked_row_id: "row_open",
      }),
    ).toThrow(/content_ungated/);

    core.lockTalentRow({
      tenant_id: campaign.tenant_id,
      campaign_id: campaign.campaign_id,
      row: {
        row_id: "row_open",
        talent_name: "阿柚实验室",
        platform: "抖音",
        placement: "口播",
      },
    });
    const pack = core.createContentPack({
      tenant_id: campaign.tenant_id,
      campaign_id: campaign.campaign_id,
      locked_row_id: "row_open",
      script: "先修屏障，再谈光泽",
    });
    expect(pack.type).toBe("ContentPack");
    expect(pack.payload.locked_row_id).toBe("row_open");
    const surface = core.contentSurface(campaign.tenant_id, campaign.campaign_id);
    expect(surface.kind).toBe("cards");
    expect(surface.cards).toHaveLength(1);
  });
});
