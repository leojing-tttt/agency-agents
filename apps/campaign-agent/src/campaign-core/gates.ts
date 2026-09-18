import type {
  Artifact,
  ContentPackPayload,
  ContentSurface,
  TalentRowLock,
} from "./types.ts";

export const CONTENT_WAIT_MESSAGE =
  "我在岗。规则：锁名单之前没有内容卡。未锁行对我不存在，也不会去建 CMS。等待你锁提报行 · 0 张卡 · 禁止预拆「达人×平台×坑位」。";

export function lockedRows(rows: TalentRowLock[]): TalentRowLock[] {
  return rows.filter((row) => row.lock_state === "locked");
}

export function assertContentPackAllowed(rows: TalentRowLock[], lockedRowId: string): TalentRowLock {
  const row = rows.find((item) => item.row_id === lockedRowId);
  if (!row || row.lock_state !== "locked") {
    throw new Error("content_ungated: ContentPack requires a locked shortlist row");
  }
  return row;
}

export function projectContentSurface(input: {
  rows: TalentRowLock[];
  cards: Artifact<ContentPackPayload>[];
}): ContentSurface {
  const locked = lockedRows(input.rows);
  if (locked.length === 0) {
    return {
      kind: "wait_message",
      cards: [],
      wait_message: CONTENT_WAIT_MESSAGE,
      locked_row_count: 0,
    };
  }
  const allowedIds = new Set(locked.map((row) => row.row_id));
  const cards = input.cards.filter((card) => allowedIds.has(card.payload.locked_row_id));
  return {
    kind: "cards",
    cards,
    wait_message: null,
    locked_row_count: locked.length,
  };
}
