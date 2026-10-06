/* 业财工时归集 demo — A3 SaaS UI
 * 执行单类型两级：CreateExecutionOrder/store.ts + type.ts
 * 品牌品线：CRM BrandDTO (brandName + productLines[]) + 品牌→品线级联
 */

/**
 * 品牌品线主数据（BrandDTO 形态）
 * 结构来源：
 * - system/…/src/api/v3/globals.d.ts → BrandDTO { brandName, productLines }
 * - system/…/src/pages/opinion/utils/productLineSelect.ts（品牌→品线级联）
 * - system/…/src/pages/oa/resource/brand/components/AddBrand.tsx（品线挂在品牌下）
 * - system/…/src/pages/opinion/tracking/task/components/create.tsx（示例：高洁丝 / 卫生巾）
 * 枚举值来自 A3 品牌/产品知识库（与业财客户品牌一致）：
 * - A3AI/小红书种草素人文知识库_开发交付版_v1.0/03_产品知识/{好奇,高洁丝,康王,拜耳,霞湖世家}/
 */
const BRAND_LINE_MASTER = [
  {
    brandName: "好奇",
    productLines: ["小森林", "深睡大师", "X系列", "屁屁面膜", "小桃裤", "小龙裤", "小黑洞"],
  },
  {
    brandName: "高洁丝",
    productLines: ["卫生巾", "蔓越莓益生力", "海岛奢宠纯棉", "阳光烘烘抑菌纯棉"],
  },
  {
    brandName: "康王",
    productLines: ["酮康唑洗发水"],
  },
  {
    brandName: "拜耳",
    productLines: ["One A Day高纯水晶鱼油", "氨糖液体钙", "心肝宝", "时光片Pro"],
  },
  {
    brandName: "霞湖世家",
    productLines: ["80支液氨棉T恤", "120支液氨棉T恤", "200支液氨棉T恤"],
  },
];

const BRANDS = BRAND_LINE_MASTER.map((b) => b.brandName);
const LINES = Object.fromEntries(
  BRAND_LINE_MASTER.map((b) => [b.brandName, b.productLines.slice()]),
);

/** 业务组：营销一部–九部（全站统一） */
const GROUPS = [
  "营销一部", "营销二部", "营销三部", "营销四部", "营销五部",
  "营销六部", "营销七部", "营销八部", "营销九部",
];

/**
 * 执行单类型 L1→L2（与 CreateExecutionOrder/store.ts initialDictData 对齐）
 * 无子类型的 L1：子类型下拉显示「—」且值为空
 */
const EXECUTE_TYPES = [
  { value: "INTERNAL_KOL", label: "KOL" },
  { value: "INTERNAL_DSP", label: "投流" },
  { value: "HARD_AD", label: "硬广" },
  { value: "PUBLIC_OPINION", label: "舆情" },
  { value: "GEO", label: "GEO" },
  { value: "SELF_MEDIA", label: "自媒体与其他" },
  { value: "OTHER", label: "策划与比稿费用" },
  { value: "CUSTOMER_RELATIONSHIP", label: "客情或其他费用" },
];

const EXECUTE_SUBTYPES = {
  INTERNAL_KOL: [
    { value: "KOL", label: "KOL（一口价）" },
    { value: "COMMON_KOL", label: "KOL（共创）" },
    { value: "KOL_OTHER", label: "KOL其他（授权/产品/差旅/线下费用等）" },
    { value: "KOL_SERVICE_PROVIDER", label: "KOL（执行服务商）" },
  ],
  INTERNAL_DSP: [
    { value: "INFLUENCER_PLATFORM_PAYMENT", label: "平台付款" },
    { value: "INFLUENCER_EXTERNAL_ORDER", label: "外部下单" },
  ],
  HARD_AD: [
    { value: "HARD_AD_PRICING", label: "定价类广告（自有牌照）" },
    { value: "HARD_AD_MEDIA_PHOTO", label: "非牌照类媒体广告" },
  ],
  PUBLIC_OPINION: [],
  GEO: [],
  SELF_MEDIA: [],
  OTHER: [],
  CUSTOMER_RELATIONSHIP: [],
};

const EXECUTE_LABEL = Object.fromEntries(EXECUTE_TYPES.map((t) => [t.value, t.label]));
function subLabel(type, sub) {
  if (!type) return "—";
  const list = EXECUTE_SUBTYPES[type] || [];
  if (!list.length) return "—";
  return (list.find((s) => s.value === sub) || {}).label || "—";
}

/** 周填报 mock：rows 含 group/brand/line/type/sub/pct，每周合计 100 */
const FILL_BY_WEEK = {
  "2026-W39": [
    { group: "营销一部", brand: "好奇", line: "小森林", type: "INTERNAL_KOL", sub: "KOL", pct: 25 },
    { group: "营销一部", brand: "好奇", line: "深睡大师", type: "INTERNAL_DSP", sub: "INFLUENCER_PLATFORM_PAYMENT", pct: 15 },
    { group: "营销三部", brand: "高洁丝", line: "卫生巾", type: "HARD_AD", sub: "HARD_AD_PRICING", pct: 20 },
    { group: "营销五部", brand: "拜耳", line: "心肝宝", type: "GEO", sub: "", pct: 15 },
    { group: "营销七部", brand: "康王", line: "酮康唑洗发水", type: "PUBLIC_OPINION", sub: "", pct: 12 },
    { group: "营销九部", brand: "霞湖世家", line: "120支液氨棉T恤", type: "OTHER", sub: "", pct: 13 },
  ],
  "2026-W38": [
    { group: "营销二部", brand: "好奇", line: "小桃裤", type: "INTERNAL_KOL", sub: "COMMON_KOL", pct: 30 },
    { group: "营销四部", brand: "高洁丝", line: "海岛奢宠纯棉", type: "INTERNAL_DSP", sub: "INFLUENCER_EXTERNAL_ORDER", pct: 25 },
    { group: "营销六部", brand: "拜耳", line: "氨糖液体钙", type: "SELF_MEDIA", sub: "", pct: 20 },
    { group: "营销八部", brand: "霞湖世家", line: "80支液氨棉T恤", type: "CUSTOMER_RELATIONSHIP", sub: "", pct: 15 },
    { group: "营销一部", brand: "好奇", line: "屁屁面膜", type: "HARD_AD", sub: "HARD_AD_MEDIA_PHOTO", pct: 10 },
  ],
};

/** Leader 归集：品牌|品线|type → 项目权重 */
const SPLIT_CATALOG = {
  "好奇|小森林|INTERNAL_KOL": [
    { project: "好奇小森林 Q3 种草", order: "ZX-一部-0918", w: 0.6 },
    { project: "好奇小森林 会员日", order: "ZX-一部-0922", w: 0.4 },
  ],
  "好奇|深睡大师|INTERNAL_DSP": [
    { project: "好奇深睡 日化战役", order: "ZX-一部-0908", w: 0.7 },
    { project: "好奇深睡 达人联投", order: "ZX-一部-0912", w: 0.3 },
  ],
  "好奇|屁屁面膜|HARD_AD": [
    { project: "好奇屁屁面膜 硬广档", order: "ZX-一部-0830", w: 1 },
  ],
};

const TEAM_DEPT1_EXTRAS = [
  {
    person: "陈屿", brand: "好奇", line: "小森林", type: "INTERNAL_KOL", sub: "KOL", filled: 20,
    parts: [{ project: "好奇小森林 Q3 种草", order: "ZX-一部-0918", w: 1 }],
  },
  {
    person: "苏晚", brand: "好奇", line: "深睡大师", type: "INTERNAL_DSP", sub: "INFLUENCER_PLATFORM_PAYMENT", filled: 10,
    parts: [
      { project: "好奇深睡 日化战役", order: "ZX-一部-0908", w: 0.5 },
      { project: "好奇深睡 达人联投", order: "ZX-一部-0912", w: 0.5 },
    ],
  },
];

const PROJECT_REPORT = [
  { project: "好奇小森林 Q3 种草", brand: "好奇 / 小森林", types: "KOL（一口价）", days: 6.8, cost: 27200 },
  { project: "好奇小森林 会员日", brand: "好奇 / 小森林", types: "KOL（一口价）", days: 1.8, cost: 7200 },
  { project: "好奇深睡 日化战役", brand: "好奇 / 深睡大师", types: "投流 / 平台付款", days: 2.4, cost: 9600 },
  { project: "好奇深睡 达人联投", brand: "好奇 / 深睡大师", types: "投流 / 平台付款", days: 1.1, cost: 4400 },
  { project: "高洁丝卫生巾 双11 预热", brand: "高洁丝 / 卫生巾", types: "硬广 / 定价类广告", days: 4.5, cost: 22500 },
  { project: "拜耳心肝宝 GEO 战役", brand: "拜耳 / 心肝宝", types: "GEO", days: 3.2, cost: 12800 },
  { project: "康王洗发水 舆情监测", brand: "康王 / 酮康唑洗发水", types: "舆情", days: 2.8, cost: 11200 },
  { project: "霞湖世家 液氨棉种草", brand: "霞湖世家 / 120支液氨棉T恤", types: "策划与比稿费用", days: 1.5, cost: 6000 },
];

/** 品牌品线人力：业务组 → 品牌 → 品线（媒介+投放+策划 = 人天） */
const BRAND_REPORT = [
  { group: "营销一部", brand: "好奇", line: "小森林", days: 5.2, media: 1.2, buy: 2.8, plan: 1.2, cost: 20800 },
  { group: "营销一部", brand: "好奇", line: "深睡大师", days: 2.1, media: 0.5, buy: 1.2, plan: 0.4, cost: 8400 },
  { group: "营销一部", brand: "好奇", line: "屁屁面膜", days: 1.0, media: 0.2, buy: 0.4, plan: 0.4, cost: 4000 },
  { group: "营销二部", brand: "好奇", line: "小桃裤", days: 2.0, media: 0.5, buy: 0.9, plan: 0.6, cost: 8000 },
  { group: "营销二部", brand: "高洁丝", line: "蔓越莓益生力", days: 1.2, media: 0.3, buy: 0.5, plan: 0.4, cost: 4800 },
  { group: "营销三部", brand: "高洁丝", line: "卫生巾", days: 3.5, media: 0.5, buy: 2.5, plan: 0.5, cost: 17500 },
  { group: "营销三部", brand: "高洁丝", line: "海岛奢宠纯棉", days: 1.0, media: 0.2, buy: 0.6, plan: 0.2, cost: 5000 },
  { group: "营销四部", brand: "高洁丝", line: "阳光烘烘抑菌纯棉", days: 1.6, media: 0.3, buy: 1.1, plan: 0.2, cost: 8000 },
  { group: "营销四部", brand: "拜耳", line: "氨糖液体钙", days: 0.8, media: 0.2, buy: 0.3, plan: 0.3, cost: 3200 },
  { group: "营销五部", brand: "拜耳", line: "心肝宝", days: 2.4, media: 0.8, buy: 0.6, plan: 1.0, cost: 9600 },
  { group: "营销六部", brand: "拜耳", line: "时光片Pro", days: 1.5, media: 0.4, buy: 0.5, plan: 0.6, cost: 6000 },
  { group: "营销七部", brand: "康王", line: "酮康唑洗发水", days: 2.8, media: 0.7, buy: 1.2, plan: 0.9, cost: 11200 },
  { group: "营销八部", brand: "霞湖世家", line: "80支液氨棉T恤", days: 1.0, media: 0.2, buy: 0.4, plan: 0.4, cost: 4000 },
  { group: "营销八部", brand: "好奇", line: "小龙裤", days: 0.8, media: 0.2, buy: 0.3, plan: 0.3, cost: 3200 },
  { group: "营销九部", brand: "霞湖世家", line: "120支液氨棉T恤", days: 1.5, media: 0.3, buy: 0.5, plan: 0.7, cost: 6000 },
  { group: "营销九部", brand: "霞湖世家", line: "200支液氨棉T恤", days: 0.6, media: 0.1, buy: 0.2, plan: 0.3, cost: 2400 },
];

const TITLES = {
  fill: "周填报",
  "fill-cmp": "填报对比",
  mine: "我的填报",
  leader: "待我确认",
  project: "项目人力",
  brand: "品牌品线人力",
  "fin-overview": "今日总览",
  "fin-revenue": "收入与贡献",
  "fin-cash": "回款与现金",
  "fin-margin": "成本与毛利",
  "admin-config": "配置面板",
  "admin-watch": "填报进度面板",
  master: "主数据来源",
};

/** 高管日报 · 脱敏日快照（方案 A；非正式财务数） */
const FIN_SNAPSHOT_DAY = "2026-10-05";
const FIN_KPIS = [
  { key: "revenue", label: "当日确认收入", value: 1864200, prev: 1720800, unit: "元", ceo: true, cfo: true, spark: [152, 148, 161, 170, 165, 172, 186] },
  { key: "cashin", label: "当日回款", value: 942500, prev: 1103200, unit: "元", ceo: true, cfo: true, spark: [110, 88, 121, 95, 105, 110, 94] },
  { key: "cost", label: "当日成本（可归）", value: 1126800, prev: 1084500, unit: "元", ceo: true, cfo: true, spark: [101, 104, 108, 106, 110, 108, 113] },
  { key: "gross", label: "当日毛利", value: 737400, prev: 636300, unit: "元", ceo: true, cfo: true, spark: [51, 44, 53, 64, 55, 64, 74] },
  { key: "margin", label: "当日毛利率", value: 39.6, prev: 37.0, unit: "%", ceo: true, cfo: true, spark: [33.5, 32, 34, 37, 36, 37, 39.6] },
  { key: "pending", label: "待确认 / 异常", value: 3, prev: 5, unit: "条", ceo: true, cfo: true, spark: [7, 6, 6, 5, 4, 5, 3] },
];

const FIN_ALERTS = [
  {
    level: "高",
    type: "逾期回款",
    summary: "客户 C-**87（拜耳线）逾期 18 天未回",
    impact: "应收 42.6 万",
    action: "催收 / 暂停新单",
  },
  {
    level: "中",
    type: "收入待确认",
    summary: "营销三部 · 高洁丝卫生巾硬广 2 单未财务确认",
    impact: "确认收入缺口 18.2 万",
    action: "财务复核",
  },
  {
    level: "中",
    type: "毛利下滑",
    summary: "康王线当日毛利率 22%，较昨日 −6.4pt",
    impact: "部门：营销七部",
    action: "查媒体成本",
  },
];

/** 部门→品牌→品线→L1 收入贡献（样例） */
const FIN_REVENUE_ROWS = [
  { group: "营销一部", brand: "好奇", line: "小森林", type: "INTERNAL_KOL", amount: 286000, prev: 251000, yoy: 238000 },
  { group: "营销一部", brand: "好奇", line: "深睡大师", type: "INTERNAL_DSP", amount: 198000, prev: 210000, yoy: 172000 },
  { group: "营销二部", brand: "好奇", line: "小桃裤", type: "INTERNAL_KOL", amount: 124000, prev: 98000, yoy: 105000 },
  { group: "营销三部", brand: "高洁丝", line: "卫生巾", type: "HARD_AD", amount: 312000, prev: 275000, yoy: 268000 },
  { group: "营销三部", brand: "高洁丝", line: "海岛奢宠纯棉", type: "INTERNAL_DSP", amount: 86000, prev: 92000, yoy: 74000 },
  { group: "营销四部", brand: "高洁丝", line: "阳光烘烘抑菌纯棉", type: "HARD_AD", amount: 72000, prev: 68000, yoy: 61000 },
  { group: "营销五部", brand: "拜耳", line: "心肝宝", type: "GEO", amount: 168000, prev: 155000, yoy: 142000 },
  { group: "营销六部", brand: "拜耳", line: "时光片Pro", type: "SELF_MEDIA", amount: 94000, prev: 88000, yoy: 81000 },
  { group: "营销七部", brand: "康王", line: "酮康唑洗发水", type: "PUBLIC_OPINION", amount: 156000, prev: 182000, yoy: 148000 },
  { group: "营销八部", brand: "霞湖世家", line: "80支液氨棉T恤", type: "CUSTOMER_RELATIONSHIP", amount: 48000, prev: 52000, yoy: 41000 },
  { group: "营销九部", brand: "霞湖世家", line: "120支液氨棉T恤", type: "OTHER", amount: 220000, prev: 195000, yoy: 186000 },
  { group: "营销九部", brand: "霞湖世家", line: "200支液氨棉T恤", type: "INTERNAL_KOL", amount: 100200, prev: 84800, yoy: 86000 },
];

/** 样例日数据覆盖去年同期，支撑同比；UI 自选区间仍从当年 8 月起 */
const FIN_DATA_MIN = "2025-08-01";
const FIN_UI_MIN = "2026-08-01";
const FIN_SAMPLE_MIN = FIN_UI_MIN;
const FIN_YOY_SCALE = 0.84;
const FIN_BRAND_DAY0 = {
  好奇: 608000,
  高洁丝: 470000,
  拜耳: 262000,
  康王: 156000,
  霞湖世家: 368200,
};
const FIN_COMPARE_KEY = "yecai-fin-compare-mode-v1";
const FIN_COMPARE_MODES = ["both", "mom", "yoy", "none"];
const FIN_FORMULA_OPEN_KEY = "yecai-fin-formula-open-v1";

/** 客户 → 品牌（业财合同主体；一客户可多品牌） */
const CLIENT_BRANDS = {
  金佰利: ["好奇", "高洁丝"],
  拜耳: ["拜耳"],
  滇虹药业: ["康王"],
  霞湖世家: ["霞湖世家"],
};
const BRAND_TO_CLIENT = Object.fromEntries(
  Object.entries(CLIENT_BRANDS).flatMap(([c, brands]) => brands.map((b) => [b, c])),
);

function clientOf(brand) {
  return BRAND_TO_CLIENT[brand] || brand;
}

function clientsFromBrands(brandMap) {
  const out = {};
  Object.entries(brandMap).forEach(([b, v]) => {
    const c = clientOf(b);
    out[c] = (out[c] || 0) + v;
  });
  return out;
}

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysISO(iso, n) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

function daysBetween(from, to) {
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  return Math.round((b - a) / 86400000);
}

function listIsoDays(from, to) {
  const out = [];
  if (!from || !to || from > to) return out;
  let d = from;
  while (d <= to) {
    out.push(d);
    d = addDaysISO(d, 1);
  }
  return out;
}

function dayMixFactor(iso) {
  const wd = new Date(`${iso}T00:00:00`).getDay();
  let f = 1;
  if (wd === 0 || wd === 6) f = 0.58;
  else if (wd === 1) f = 0.86;
  else if (wd === 5) f = 1.1;
  const n = daysBetween(FIN_DATA_MIN, iso);
  f *= 0.9 + 0.18 * Math.sin(n / 3.7);
  return f;
}

function shiftYearISO(iso, years) {
  const d = new Date(`${iso}T00:00:00`);
  d.setFullYear(d.getFullYear() + years);
  return isoDate(d);
}

/** 日快照样例：含去年同期（同比）+ 当年区间；快照日对齐 FIN_KPIS */
const FIN_DAILY = (() => {
  const map = {};
  const yoyAnchor = shiftYearISO(FIN_SNAPSHOT_DAY, -1);
  listIsoDays(FIN_DATA_MIN, FIN_SNAPSHOT_DAY).forEach((iso) => {
    const isSnap = iso === FIN_SNAPSHOT_DAY;
    const isYoyAnchor = iso === yoyAnchor;
    const isPriorYear = iso < "2026-01-01";
    // 去年同日用同年历波动的缩放，避免落在周末被压成接近空值
    const mixSrc = isPriorYear ? shiftYearISO(iso, 1) : iso;
    const yearScale = isPriorYear ? FIN_YOY_SCALE : 1;
    const f = (isSnap || isYoyAnchor) ? yearScale : dayMixFactor(mixSrc) * yearScale;
    const revenue = isSnap ? 1864200 : Math.round(1864200 * f);
    const cashin = isSnap ? 942500 : Math.round(942500 * f * 0.97);
    const cost = isSnap ? 1126800 : Math.round(1126800 * f * 1.01);
    const gross = revenue - cost;
    const n = daysBetween(FIN_DATA_MIN, iso);
    const pending = isSnap ? 3 : isYoyAnchor ? 5 : 2 + (n * 7) % 6;
    const brands = {};
    Object.entries(FIN_BRAND_DAY0).forEach(([b, v], i) => {
      if (isSnap) brands[b] = v;
      else if (isYoyAnchor) brands[b] = Math.round(v * FIN_YOY_SCALE);
      else brands[b] = Math.max(8000, Math.round(v * f * (1 + (i - 2) * 0.03 * (f - 1))));
    });
    const brandSum = Object.values(brands).reduce((s, x) => s + x, 0);
    if (brandSum && !isSnap) {
      Object.keys(brands).forEach((b) => {
        brands[b] = Math.round(brands[b] * (revenue / brandSum));
      });
    }
    map[iso] = { revenue, cashin, cost, gross, pending, brands };
  });
  return map;
})();

function clampIso(iso) {
  if (iso < FIN_UI_MIN) return FIN_UI_MIN;
  if (iso > FIN_SNAPSHOT_DAY) return FIN_SNAPSHOT_DAY;
  return iso;
}

function sumPeriod(from, to) {
  const days = listIsoDays(from, to).filter((d) => FIN_DAILY[d]);
  const empty = {
    days,
    revenue: 0, cashin: 0, cost: 0, gross: 0, margin: 0, pending: 0,
    brands: {}, clients: {}, sparks: { revenue: [], cashin: [], cost: [], gross: [], margin: [], pending: [] },
  };
  if (!days.length) return empty;
  const brands = {};
  days.forEach((iso) => {
    const row = FIN_DAILY[iso];
    empty.revenue += row.revenue;
    empty.cashin += row.cashin;
    empty.cost += row.cost;
    empty.gross += row.gross;
    Object.entries(row.brands).forEach(([b, v]) => { brands[b] = (brands[b] || 0) + v; });
    empty.sparks.revenue.push(row.revenue / 10000);
    empty.sparks.cashin.push(row.cashin / 10000);
    empty.sparks.cost.push(row.cost / 10000);
    empty.sparks.gross.push(row.gross / 10000);
    empty.sparks.margin.push(row.revenue ? (row.gross / row.revenue) * 100 : 0);
    empty.sparks.pending.push(row.pending);
  });
  empty.brands = brands;
  empty.clients = clientsFromBrands(brands);
  empty.pending = FIN_DAILY[days[days.length - 1]].pending;
  empty.margin = empty.revenue ? (empty.gross / empty.revenue) * 100 : 0;
  empty.days = days;
  return empty;
}

function previousWindow(from, to) {
  const n = daysBetween(from, to) + 1;
  const prevTo = addDaysISO(from, -1);
  const prevFrom = addDaysISO(prevTo, -(n - 1));
  if (prevFrom < FIN_DATA_MIN || !FIN_DAILY[prevFrom] || !FIN_DAILY[prevTo]) {
    return { from: null, to: null };
  }
  return { from: prevFrom, to: prevTo };
}

function yoyWindow(from, to) {
  const yFrom = shiftYearISO(from, -1);
  const yTo = shiftYearISO(to, -1);
  if (!FIN_DAILY[yFrom] || !FIN_DAILY[yTo]) return { from: null, to: null };
  return { from: yFrom, to: yTo };
}

function ovMomLabel(preset) {
  if (preset === "today") return "较昨日";
  if (preset === "7d") return "较前 7 天";
  if (preset === "30d") return "较前一个月";
  return "较前一同期";
}

function ovYoyLabel(preset) {
  if (preset === "today") return "较去年同日";
  if (preset === "7d") return "较去年同7天";
  if (preset === "30d") return "较去年同月";
  return "较去年同期";
}

function loadCompareMode() {
  try {
    const raw = localStorage.getItem(FIN_COMPARE_KEY);
    if (FIN_COMPARE_MODES.includes(raw)) return raw;
  } catch (_) { /* ignore */ }
  return "both";
}

function saveCompareMode(mode) {
  const next = FIN_COMPARE_MODES.includes(mode) ? mode : "both";
  state.compareMode = next;
  try { localStorage.setItem(FIN_COMPARE_KEY, next); } catch (_) { /* ignore */ }
}

function showMom() {
  return state.compareMode === "mom" || state.compareMode === "both";
}

function showYoy() {
  return state.compareMode === "yoy" || state.compareMode === "both";
}

function tipIcon(html, opts) {
  const side = opts && opts.side ? " yc-hint-side" : "";
  return `<span class="yc-hint${side}" aria-label="计算公式"><i class="far fa-circle-question" aria-hidden="true"></i><span class="yc-hint-pop" role="tooltip">${html}</span></span>`;
}

function loadFormulaOpen() {
  try {
    const raw = localStorage.getItem(FIN_FORMULA_OPEN_KEY);
    if (raw === "1") return true;
    if (raw === "0") return false;
  } catch (_) { /* ignore */ }
  return false; // default collapsed
}

function saveFormulaOpen(open) {
  try { localStorage.setItem(FIN_FORMULA_OPEN_KEY, open ? "1" : "0"); } catch (_) { /* ignore */ }
}

function syncFormulaPanels() {
  const open = state.formulaOpen;
  [
    ["fin-overview-formula-wrap", "fin-overview-formula-toggle", "fin-overview-formula"],
    ["fin-rev-formula-wrap", "fin-rev-formula-toggle", "fin-rev-formula"],
  ].forEach(([wrapId, toggleId, bodyId]) => {
    const wrap = document.getElementById(wrapId);
    const toggle = document.getElementById(toggleId);
    const body = document.getElementById(bodyId);
    if (!wrap || !toggle || !body) return;
    wrap.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    body.hidden = !open;
  });
}

function setFormulaOpen(open) {
  state.formulaOpen = !!open;
  saveFormulaOpen(state.formulaOpen);
  syncFormulaPanels();
}

function fillFormulaBody(page) {
  const id = page === "revenue" ? "fin-rev-formula" : "fin-overview-formula";
  const el = document.getElementById(id);
  if (el) el.innerHTML = pageFormulaHtml(page);
  syncFormulaPanels();
}

function fmtCompareStack(cur, momPrev, yoyPrev, unit, invert, momLabel, yoyLabel) {
  const lines = [];
  if (showMom()) {
    const d = fmtDelta(cur, momPrev, unit, invert, momLabel);
    lines.push(`<span class="${d.cls}">${d.text}</span>`);
  }
  if (showYoy()) {
    const d = fmtDelta(cur, yoyPrev, unit, invert, yoyLabel);
    lines.push(`<span class="${d.cls}">${d.text}</span>`);
  }
  if (!lines.length) return `<span class="yc-muted">—</span>`;
  return `<span class="yc-compare-stack">${lines.join("")}</span>`;
}

function metricTip(kind, preset) {
  const mom = ovMomLabel(preset);
  const yoy = ovYoyLabel(preset);
  const periodHint = preset === "today"
    ? "本期=快照日"
    : preset === "7d"
      ? "本期=近7日合计"
      : preset === "30d"
        ? "本期=近30日合计"
        : "本期=自选区间合计";
  const cmp = `环比（${mom}）=本期−前一等长区间<br>同比（${yoy}）=本期−去年同日/同区间`;
  const tips = {
    revenue: `确认收入=T+1已确认执行单金额<br>${periodHint}<br>${cmp}`,
    cashin: `回款=区间到账合计<br>${periodHint}<br>${cmp}`,
    cost: `可归成本=媒体+制作+其他<br>人力不拆日，见成本页周锁定<br>${cmp}`,
    gross: `毛利=确认收入−可归成本<br>${cmp}`,
    margin: `毛利率=毛利÷确认收入×100%<br>${cmp}`,
    pending: `待确认/异常=快照日时点条数<br>${cmp}`,
    contrib: `贡献=该品牌/客户确认收入<br>按客户：金佰利=好奇+高洁丝<br>${cmp}`,
    rev_total: `筛选后确认收入=快照日筛选合计<br>环比=本日−昨日 · 同比=本日−去年同日`,
    rev_row: `行金额=该品牌/客户快照日确认收入<br>环比=本日−昨日 · 同比=本日−去年同日`,
  };
  return tips[kind] || "";
}

function pageFormulaHtml(page) {
  if (page === "overview") {
    return [
      "确认收入 = T+1 已财务确认执行单金额（区间按日加总）",
      "回款 = 区间到账合计 · 可归成本 = 媒体 + 制作 + 其他（人力不拆日）",
      "毛利 = 确认收入 − 可归成本 · 毛利率 = 毛利 ÷ 确认收入 × 100%",
      "环比 = 本期 − 等长前一区间（今日→昨日；近7天→前7天；近一个月→前30天；自定义→等长前段）",
      "同比 = 本期 − 去年同日/同区间（起止日期整体减一年）",
      "贡献：按品牌=品牌确认收入；按客户=客户下品牌之和",
    ].map((line) => `· ${line}`).join("<br>");
  }
  return [
    "明细确认收入 = 快照日、筛选后执行单确认金额（按品牌或按客户加总）",
    "按客户：金佰利 = 好奇 + 高洁丝（与按品牌分列不同口径）",
    "环比（较昨日）= 本日 − 昨日 · 同比（较去年同日）= 本日 − 去年同日",
  ].map((line) => `· ${line}`).join("<br>");
}

function applyOvPreset(preset, fromCustom, toCustom) {
  state.ovPreset = preset;
  if (preset === "today") {
    state.ovFrom = FIN_SNAPSHOT_DAY;
    state.ovTo = FIN_SNAPSHOT_DAY;
  } else if (preset === "7d") {
    state.ovTo = FIN_SNAPSHOT_DAY;
    state.ovFrom = addDaysISO(FIN_SNAPSHOT_DAY, -6);
  } else if (preset === "30d") {
    state.ovTo = FIN_SNAPSHOT_DAY;
    state.ovFrom = addDaysISO(FIN_SNAPSHOT_DAY, -29);
  } else {
    let from = clampIso(fromCustom || state.ovFrom);
    let to = clampIso(toCustom || state.ovTo);
    if (from > to) { const t = from; from = to; to = t; }
    state.ovFrom = from;
    state.ovTo = to;
  }
}

function ovAlerts(preset, from, to) {
  const span = daysBetween(from, to) + 1;
  if (preset === "today" || span === 1) return FIN_ALERTS;
  if (span <= 7) {
    return [
      { level: "高", type: "逾期回款", summary: "近 7 天拜耳线客户 C-**87 仍未回", impact: "应收 42.6 万", action: "催收 / 暂停新单" },
      { level: "中", type: "收入待确认", summary: "营销三部硬广 4 单待财务确认", impact: "确认缺口 41.0 万", action: "财务复核" },
      { level: "中", type: "毛利下滑", summary: "康王近 7 天毛利率低于公司均值", impact: "营销七部", action: "查媒体成本" },
    ];
  }
  return [
    { level: "高", type: "逾期回款", summary: "近一个月高风险逾期集中在拜耳线", impact: "逾期累计偏高", action: "催收清单" },
    { level: "中", type: "收入待确认", summary: "高洁丝硬广待确认单跨周未关", impact: "确认进度落后", action: "财务复核" },
    { level: "中", type: "毛利下滑", summary: "康王期间毛利率持续偏低", impact: "营销七部", action: "查媒体成本" },
  ];
}

const FIN_AGING = [
  { bucket: "未到期", clients: 28, amount: 3860000, focus: "正常" },
  { bucket: "1–30 天", clients: 9, amount: 920000, focus: "跟进" },
  { bucket: "31–60 天", clients: 4, amount: 540000, focus: "催收" },
  { bucket: "60 天以上", clients: 2, amount: 426000, focus: "高风险" },
];

const FIN_CASH_FLOWS = [
  { client: "客户 A-**12", brand: "好奇", amount: 286000, method: "电汇", status: "已入账" },
  { client: "客户 B-**45", brand: "高洁丝", amount: 312000, method: "电汇", status: "已入账" },
  { client: "客户 C-**87", brand: "拜耳", amount: 0, method: "—", status: "逾期未回" },
  { client: "客户 D-**03", brand: "霞湖世家", amount: 220000, method: "承兑", status: "已入账" },
  { client: "客户 E-**61", brand: "康王", amount: 124500, method: "电汇", status: "待核销" },
];

const FIN_COST_MIX = [
  { name: "媒体采买", amount: 682000, prev: 648000, note: "投流/硬广当日确认成本" },
  { name: "制作与内容", amount: 268000, prev: 255000, note: "KOL 制作 / 素材" },
  { name: "其他直接成本", amount: 176800, prev: 181500, note: "客情 / 比稿 / 差旅等" },
  { name: "人力（日）", amount: null, prev: null, note: "工时周锁定，不拆日成本 — 见下表" },
];

const FIN_BRAND_MARGIN = [
  { brand: "好奇", revenue: 608000, cost: 352000 },
  { brand: "高洁丝", revenue: 470000, cost: 298000 },
  { brand: "拜耳", revenue: 262000, cost: 168000 },
  { brand: "康王", revenue: 156000, cost: 121680 },
  { brand: "霞湖世家", revenue: 368200, cost: 187120 },
];

/** 人力周对照：仅已锁定周可出人天；不发明日人力成本 */
const FIN_LABOR_WEEK = [
  {
    week: "2026-W38",
    status: "locked",
    days: 28.4,
    weekRevenue: 9200000,
    note: "已锁定 · 可做人效对照",
  },
  {
    week: "2026-W39",
    status: "open",
    days: null,
    weekRevenue: 6120000,
    note: "填报中 · 人天未锁定，不展示日成本",
  },
];

const ADMIN_STORAGE_KEY = "yecai-workhour-admin-config-v2";
const ADMIN_DRAFT_KEY = "yecai-workhour-admin-config-draft-v2";

const DEFAULT_STAFF_BY_DEPT = {
  营销一部: 12,
  营销二部: 10,
  营销三部: 11,
  营销四部: 9,
  营销五部: 8,
  营销六部: 10,
  营销七部: 7,
  营销八部: 9,
  营销九部: 8,
};

/** 部门 → 品牌（可多选）；默认覆盖 BRAND_LINE_MASTER */
const DEFAULT_DEPT_BRANDS = {
  营销一部: ["好奇"],
  营销二部: ["好奇", "高洁丝"],
  营销三部: ["高洁丝"],
  营销四部: ["高洁丝", "拜耳"],
  营销五部: ["拜耳"],
  营销六部: ["拜耳"],
  营销七部: ["康王"],
  营销八部: ["霞湖世家", "好奇"],
  营销九部: ["霞湖世家"],
};

function defaultDeptBrands() {
  const out = {};
  GROUPS.forEach((g) => {
    out[g] = (DEFAULT_DEPT_BRANDS[g] || []).filter((b) => BRANDS.includes(b));
    if (!out[g].length) out[g] = [BRANDS[0]];
  });
  return out;
}

function brandsForGroup(group) {
  const mapped = (state.adminConfig?.deptBrands && state.adminConfig.deptBrands[group]) || [];
  const valid = mapped.filter((b) => BRANDS.includes(b));
  return valid.length ? valid : BRANDS.slice();
}

/** 填报进度面板：各周已提交人数 mock（应填 = 配置员工数） */
const WATCH_WEEKS = ["2026-W36", "2026-W37", "2026-W38", "2026-W39"];
const WATCH_SUBMITTED = {
  "2026-W36": { 营销一部: 12, 营销二部: 10, 营销三部: 11, 营销四部: 9, 营销五部: 8, 营销六部: 10, 营销七部: 7, 营销八部: 9, 营销九部: 8 },
  "2026-W37": { 营销一部: 10, 营销二部: 7, 营销三部: 9, 营销四部: 6, 营销五部: 5, 营销六部: 8, 营销七部: 4, 营销八部: 6, 营销九部: 5 },
  "2026-W38": { 营销一部: 12, 营销二部: 10, 营销三部: 11, 营销四部: 9, 营销五部: 8, 营销六部: 10, 营销七部: 7, 营销八部: 9, 营销九部: 8 },
  "2026-W39": { 营销一部: 8, 营销二部: 4, 营销三部: 6, 营销四部: 3, 营销五部: 5, 营销六部: 2, 营销七部: 3, 营销八部: 4, 营销九部: 1 },
};

const LEADER_GROUP = "营销一部";

function cloneRows(week) {
  return FILL_BY_WEEK[week].map((r) => ({ ...r }));
}

function emptyRow(group) {
  const brands = brandsForGroup(group);
  const brand = brands[0] || BRANDS[0];
  return {
    group: group || "",
    brand,
    line: (LINES[brand] || [])[0] || "",
    type: EXECUTE_TYPES[0].value,
    sub: (EXECUTE_SUBTYPES[EXECUTE_TYPES[0].value][0] || {}).value || "",
    pct: 0,
  };
}

function normalizeAdminConfig(raw) {
  const staffByDept = { ...DEFAULT_STAFF_BY_DEPT, ...(raw?.staffByDept || {}) };
  const baseBrands = defaultDeptBrands();
  const deptBrands = { ...baseBrands };
  if (raw?.deptBrands && typeof raw.deptBrands === "object") {
    GROUPS.forEach((g) => {
      if (Array.isArray(raw.deptBrands[g])) {
        const valid = raw.deptBrands[g].filter((b) => BRANDS.includes(b));
        deptBrands[g] = valid.length ? valid : baseBrands[g];
      }
    });
  }
  return { staffByDept, deptBrands, savedAt: raw?.savedAt || null };
}

function loadAdminConfig() {
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (raw) return normalizeAdminConfig(JSON.parse(raw));
  } catch (_) { /* ignore */ }
  return normalizeAdminConfig(null);
}

function loadAdminDraft() {
  try {
    const raw = localStorage.getItem(ADMIN_DRAFT_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) { /* ignore */ }
  return null;
}

const state = {
  role: "filler",
  locked: false,
  submitted: true,
  week: "2026-W39",
  rows: cloneRows("2026-W39"),
  cmpWeek: "2026-W39",
  cmpRows: cloneRows("2026-W39"),
  history: [
    { week: "2026-W38", status: "locked", rows: cloneRows("2026-W38") },
    { week: "2026-W39", status: "submitted", rows: cloneRows("2026-W39") },
  ],
  adminConfig: loadAdminConfig(),
  adminDraftMeta: null,
  watchWeek: "2026-W39",
  ovPreset: "today",
  ovFrom: "2026-10-05",
  ovTo: "2026-10-05",
  contribCut: "brand",
  compareMode: loadCompareMode(),
  formulaOpen: loadFormulaOpen(),
};

const draftBoot = loadAdminDraft();
if (draftBoot) {
  state.adminConfig = normalizeAdminConfig({
    ...state.adminConfig,
    staffByDept: draftBoot.staffByDept,
    deptBrands: draftBoot.deptBrands,
  });
  state.adminDraftMeta = draftBoot.draftedAt || "草稿已恢复";
}

// 清掉旧版项目人力配置残留
try {
  localStorage.removeItem("yecai-workhour-admin-config-v1");
  localStorage.removeItem("yecai-workhour-admin-config-draft-v1");
} catch (_) { /* ignore */ }

const roleMeta = {
  filler: { name: "林可 · 媒介", showCost: false, fin: false },
  leader: { name: "周衡 · 营销一部 Leader", showCost: false, fin: false },
  finance: { name: "沈岚 · 财务", showCost: true, fin: true },
  ceo: { name: "顾岑 · CEO", showCost: true, fin: true },
  cfo: { name: "沈岚 · CFO", showCost: true, fin: true },
  admin: { name: "顾澄 · 管理员", showCost: true, fin: true },
};

const FIN_PAGES = ["fin-overview", "fin-revenue", "fin-cash", "fin-margin"];

function fmtMoney(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString("zh-CN");
}

function fmtDelta(cur, prev, unit, invert, vsLabel) {
  const vs = vsLabel || "较昨日";
  if (prev == null || cur == null) return { text: "—", cls: "yc-delta-flat" };
  const d = cur - prev;
  if (Math.abs(d) < 1e-9) return { text: `${vs}持平`, cls: "yc-delta-flat" };
  const up = d > 0;
  const abs = unit === "%" ? Math.abs(d).toFixed(1) : Math.abs(d);
  const absText = unit === "%" ? `${abs}pt` : unit === "条" ? `${abs}` : fmtMoney(abs);
  const goodUp = invert ? !up : up;
  return {
    text: `${vs} ${up ? "+" : "−"}${absText}${unit === "元" ? "" : unit === "条" ? " 条" : ""}`,
    cls: goodUp ? "yc-delta-up" : "yc-delta-down",
  };
}

function isExecRole(role) {
  return role === "ceo" || role === "cfo" || role === "finance" || role === "admin";
}

function toast(type, text) {
  const root = document.getElementById("toast-root");
  const el = document.createElement("div");
  el.className = `a3-message a3-message-${type}`;
  const icon =
    type === "success" ? "fa-check-circle" :
    type === "warning" ? "fa-exclamation-circle" :
    type === "danger" ? "fa-times-circle" : "fa-info-circle";
  el.innerHTML = `<i class="fas ${icon}"></i><span>${text}</span>`;
  root.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

function opts(list, selected) {
  return list.map((v) => `<option ${v === selected ? "selected" : ""}>${v}</option>`).join("");
}

function optsObj(list, selected, valueKey = "value", labelKey = "label") {
  return list.map((v) =>
    `<option value="${v[valueKey]}" ${v[valueKey] === selected ? "selected" : ""}>${v[labelKey]}</option>`
  ).join("");
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function sumPct(rows) {
  return round1(rows.reduce((s, r) => s + (Number(r.pct) || 0), 0));
}

function setSumDisplay(sumEl, wrapEl, total) {
  sumEl.textContent = total;
  const ok = Math.abs(total - 100) < 0.05;
  wrapEl.classList.toggle("yc-sum-ok", ok);
  wrapEl.classList.toggle("yc-sum-bad", !ok);
}

function defaultSub(type) {
  const list = EXECUTE_SUBTYPES[type] || [];
  return list.length ? list[0].value : "";
}

function typeSelectHtml(selected) {
  return optsObj(EXECUTE_TYPES, selected);
}

function subSelectHtml(type, selected) {
  const list = EXECUTE_SUBTYPES[type] || [];
  if (!list.length) {
    return `<option value="" selected>—</option>`;
  }
  return optsObj(list, selected);
}

function syncRoleMenus() {
  const isAdmin = state.role === "admin";
  const canFin = isExecRole(state.role);
  document.body.classList.toggle("yc-role-admin", isAdmin);
  document.body.classList.toggle("yc-role-fin", canFin);
  document.body.classList.toggle("yc-role-ceo", state.role === "ceo");
  document.body.classList.toggle("yc-role-cfo", state.role === "cfo" || state.role === "finance");
}

function updateFinBreadcrumb(page) {
  const crumbs = document.getElementById("yc-breadcrumb") || document.querySelector(".a3-breadcrumb");
  if (!crumbs) return;
  if (FIN_PAGES.includes(page)) {
    crumbs.innerHTML = `
      <span class="a3-breadcrumb-item"><a href="#fin-overview">观测台</a></span>
      <span class="a3-breadcrumb-separator">/</span>
      <span class="a3-breadcrumb-item" id="crumb">${TITLES[page] || page}</span>
    `;
  } else {
    crumbs.innerHTML = `
      <span class="a3-breadcrumb-item"><a>人效</a></span>
      <span class="a3-breadcrumb-separator">/</span>
      <span class="a3-breadcrumb-item"><a>工时</a></span>
      <span class="a3-breadcrumb-separator">/</span>
      <span class="a3-breadcrumb-item" id="crumb">${TITLES[page] || page}</span>
    `;
  }
}

function syncObsChrome(page) {
  const onObs = FIN_PAGES.includes(page);
  const rail = document.getElementById("obs-rail");
  if (rail) rail.hidden = !onObs;
  document.querySelectorAll(".yc-obs-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.page === page);
  });
  document.body.classList.toggle("yc-fin-active", onObs);
}

function go(page) {
  if ((page === "admin-config" || page === "admin-watch") && state.role !== "admin") {
    toast("warning", "请先切换为管理员身份");
    page = "fill";
  }
  if (FIN_PAGES.includes(page) && !isExecRole(state.role)) {
    toast("warning", "请切换为 CEO / CFO（或财务）后进入观测台");
    page = "fill";
  }
  document.querySelectorAll(".page").forEach((p) => p.classList.toggle("active", p.id === "page-" + page));
  document.querySelectorAll(".a3-menu-item[data-page]").forEach((m) => m.classList.toggle("active", m.dataset.page === page));
  syncObsChrome(page);
  updateFinBreadcrumb(page);
  if (page === "fill") renderFill();
  if (page === "fill-cmp") renderFillCmp();
  if (page === "mine") renderMine();
  if (page === "leader") renderLeader();
  if (page === "project") renderProject();
  if (page === "brand") renderBrand();
  if (page === "fin-overview") renderFinOverview();
  if (page === "fin-revenue") renderFinRevenue();
  if (page === "fin-cash") renderFinCash();
  if (page === "fin-margin") renderFinMargin();
  if (page === "admin-config") renderAdminConfig();
  if (page === "admin-watch") renderAdminWatch();
  if (page === "master") renderMaster();
  const pageHashes = {
    "fill-cmp": "fill-cmp",
    "admin-config": "admin-config",
    "admin-watch": "admin-progress",
    brand: "brand",
    "fin-overview": "fin-overview",
    "fin-revenue": "fin-revenue",
    "fin-cash": "fin-cash",
    "fin-margin": "fin-margin",
  };
  if (pageHashes[page]) location.hash = pageHashes[page];
  else if (location.hash && location.hash !== "#") history.replaceState(null, "", location.pathname + location.search);
}

document.querySelectorAll(".a3-menu-item[data-page]").forEach((m) => {
  m.addEventListener("click", () => go(m.dataset.page));
});

document.querySelectorAll(".yc-obs-tab[data-page]").forEach((tab) => {
  tab.addEventListener("click", () => go(tab.dataset.page));
});

document.getElementById("obs-entry")?.addEventListener("click", () => {
  if (!isExecRole(state.role)) {
    toast("warning", "请切换为 CEO / CFO（或财务）后进入观测台");
    return;
  }
  go("fin-overview");
});

document.getElementById("obs-exit")?.addEventListener("click", () => {
  go(state.role === "admin" ? "admin-config" : "fill");
});

document.getElementById("role-select").addEventListener("change", (e) => {
  state.role = e.target.value;
  document.getElementById("user-chip").innerHTML = `<i class="fas fa-user"></i> ${roleMeta[state.role].name}`;
  syncRoleMenus();
  const active = document.querySelector(".page.active");
  const activePage = active ? active.id.replace(/^page-/, "") : "fill";
  const onAdminPage = activePage === "admin-config" || activePage === "admin-watch";
  const onFinPage = FIN_PAGES.includes(activePage);
  /* CEO / CFO 打开观测台 → 一律落在 elevated 总览 */
  if (state.role === "ceo" || state.role === "cfo") go("fin-overview");
  else if (state.role === "finance") go("fin-overview");
  else if (state.role === "admin") go(onAdminPage ? activePage : "admin-config");
  else if (onAdminPage || (onFinPage && !isExecRole(state.role))) go("fill");
  else go(activePage || "fill");
});

document.getElementById("fill-week").addEventListener("change", (e) => {
  const week = e.target.value.startsWith("2026-W38") ? "2026-W38" : "2026-W39";
  if (week === state.week) return;
  FILL_BY_WEEK[state.week] = state.rows.map((r) => ({ ...r }));
  state.week = week;
  state.rows = cloneRows(week);
  state.locked = week === "2026-W38";
  renderFill();
});

function syncHistoryCurrentWeek() {
  const idx = state.history.findIndex((h) => h.week === state.week);
  const entry = {
    week: state.week,
    status: state.locked ? "locked" : "submitted",
    rows: state.rows.map((r) => ({ ...r })),
  };
  if (idx >= 0) state.history[idx] = entry;
  else state.history.push(entry);
  state.history.sort((a, b) => (a.week < b.week ? 1 : -1));
}

function groupsInOrder(rows) {
  const seen = [];
  rows.forEach((r) => {
    if (r.group && !seen.includes(r.group)) seen.push(r.group);
  });
  return seen;
}

function bindRowControls(root, getRows, setRows, rerender) {
  root.querySelectorAll("select, input").forEach((el) => {
    el.addEventListener("change", () => {
      const rows = getRows();
      const i = +el.dataset.i;
      const k = el.dataset.k;
      if (k === "pct") rows[i].pct = Number(el.value);
      else rows[i][k] = el.value;
      if (k === "brand") {
        rows[i].line = (LINES[el.value] || [])[0] || "";
        setRows(rows);
        rerender();
      } else if (k === "type") {
        rows[i].sub = defaultSub(el.value);
        setRows(rows);
        rerender();
      } else if (k === "group") {
        const allowed = brandsForGroup(el.value);
        if (!allowed.includes(rows[i].brand)) {
          rows[i].brand = allowed[0] || BRANDS[0];
          rows[i].line = (LINES[rows[i].brand] || [])[0] || "";
        }
        setRows(rows);
        rerender();
      } else if (k === "pct") {
        setRows(rows);
        rerender();
      } else {
        setRows(rows);
        if (rerender === renderFill) updateFillSum();
        else updateCmpSum();
      }
    });
  });
  root.querySelectorAll("[data-rm]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const rows = getRows();
      rows.splice(+btn.dataset.rm, 1);
      setRows(rows);
      rerender();
    });
  });
}

function rowCellsHtml(row, i, { includeGroup }) {
  const brandOpts = brandsForGroup(row.group);
  const brand = brandOpts.includes(row.brand) ? row.brand : (brandOpts[0] || BRANDS[0]);
  if (brand !== row.brand) {
    row.brand = brand;
    row.line = (LINES[brand] || [])[0] || "";
  }
  const lines = LINES[row.brand] || [];
  const subDisabled = !(EXECUTE_SUBTYPES[row.type] || []).length;
  const groupCell = includeGroup
    ? `<td><div class="a3-select-wrapper"><select class="a3-select" data-i="${i}" data-k="group">${opts(GROUPS, row.group)}</select><i class="fas fa-chevron-down a3-select-arrow"></i></div></td>`
    : "";
  return `
    ${groupCell}
    <td><div class="a3-select-wrapper"><select class="a3-select" data-i="${i}" data-k="brand">${opts(brandOpts, row.brand)}</select><i class="fas fa-chevron-down a3-select-arrow"></i></div></td>
    <td><div class="a3-select-wrapper"><select class="a3-select" data-i="${i}" data-k="line">${opts(lines, row.line)}</select><i class="fas fa-chevron-down a3-select-arrow"></i></div></td>
    <td><div class="a3-select-wrapper"><select class="a3-select" data-i="${i}" data-k="type">${typeSelectHtml(row.type)}</select><i class="fas fa-chevron-down a3-select-arrow"></i></div></td>
    <td><div class="a3-select-wrapper"><select class="a3-select" data-i="${i}" data-k="sub" ${subDisabled ? "disabled" : ""}>${subSelectHtml(row.type, row.sub)}</select><i class="fas fa-chevron-down a3-select-arrow"></i></div></td>
    <td><div class="a3-input-wrapper yc-pct-cell"><input class="a3-input" type="number" min="0" max="100" step="1" value="${row.pct}" data-i="${i}" data-k="pct" /><span class="yc-pct-suffix">%</span></div></td>
    <td><button type="button" class="a3-btn a3-btn-text a3-table-link" style="color:var(--a3-danger)" data-rm="${i}">删除</button></td>
  `;
}

function updateFillSum() {
  setSumDisplay(
    document.getElementById("fill-sum"),
    document.getElementById("fill-sum-wrap"),
    sumPct(state.rows),
  );
}

function renderFill() {
  const root = document.getElementById("fill-sections");
  const groups = groupsInOrder(state.rows);
  if (!groups.length) {
    root.innerHTML = `<div class="a3-empty"><i class="fas fa-inbox"></i><div class="a3-empty-text">暂无营销部，请点击「添加营销部」</div></div>`;
    updateFillSum();
    return;
  }
  root.innerHTML = groups.map((g) => {
    const indices = state.rows.map((r, i) => (r.group === g ? i : -1)).filter((i) => i >= 0);
    const deptPct = round1(indices.reduce((s, i) => s + (Number(state.rows[i].pct) || 0), 0));
    const mappedBrands = brandsForGroup(g).join("、");
    const rowsHtml = indices.map((i) => `<tr>${rowCellsHtml(state.rows[i], i, { includeGroup: false })}</tr>`).join("");
    return `
      <div class="yc-dept a3-card a3-mb-16" data-dept="${g}">
        <div class="yc-dept-head">
          <div class="yc-dept-title">
            <i class="fas fa-building a3-text-brand"></i>
            <strong class="a3-text-primary">${g}</strong>
            <span class="a3-tag a3-tag-default">本部门 ${deptPct}%</span>
            <span class="yc-dept-brands">可填品牌：${mappedBrands}</span>
          </div>
          <div class="a3-flex" style="gap:8px">
            <button type="button" class="a3-btn a3-btn-default a3-btn-sm" data-add-line="${g}"><i class="fas fa-plus"></i> 添加行</button>
            <button type="button" class="a3-btn a3-btn-text" style="color:var(--a3-danger)" data-rm-dept="${g}">移除部门</button>
          </div>
        </div>
        <div class="a3-table-wrapper">
          <table class="a3-table">
            <thead>
              <tr>
                <th>品牌</th><th>品线</th><th>执行单类型</th><th>子类型</th><th>占比(%)</th><th>操作</th>
              </tr>
            </thead>
            <tbody>${rowsHtml || `<tr><td colspan="6"><div class="a3-table-empty">该部门暂无明细，请添加行</div></td></tr>`}</tbody>
          </table>
        </div>
      </div>
    `;
  }).join("");

  bindRowControls(
    root,
    () => state.rows,
    (rows) => { state.rows = rows; },
    renderFill,
  );

  root.querySelectorAll("[data-add-line]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.rows.push(emptyRow(btn.dataset.addLine));
      renderFill();
    });
  });
  root.querySelectorAll("[data-rm-dept]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.rows = state.rows.filter((r) => r.group !== btn.dataset.rmDept);
      renderFill();
    });
  });
  updateFillSum();
}

document.getElementById("add-dept").addEventListener("click", () => {
  const used = new Set(state.rows.map((r) => r.group));
  const next = GROUPS.find((g) => !used.has(g));
  if (!next) return toast("warning", "九个营销部均已添加");
  state.rows.push(emptyRow(next));
  renderFill();
});

document.getElementById("save-draft").addEventListener("click", () => toast("info", "已暂存"));
document.getElementById("submit-fill").addEventListener("click", () => {
  if (!state.rows.length) return toast("warning", "请至少添加一行");
  const incomplete = state.rows.some((r) => !r.group || !r.brand || !r.line || !r.type);
  if (incomplete) return toast("warning", "请完善业务组、品牌品线与执行单类型");
  const needSub = state.rows.some((r) => (EXECUTE_SUBTYPES[r.type] || []).length && !r.sub);
  if (needSub) return toast("warning", "请选择执行单子类型");
  const total = sumPct(state.rows);
  if (Math.abs(total - 100) >= 0.05) return toast("warning", `本周占比合计须为 100%，当前为 ${total}%`);
  if (state.week === "2026-W38") return toast("warning", "历史周已锁定，不可再次提交");
  state.submitted = true;
  state.locked = false;
  FILL_BY_WEEK[state.week] = state.rows.map((r) => ({ ...r }));
  syncHistoryCurrentWeek();
  toast("success", "提交成功。拆分结果仅业务组 Leader 可见。");
  go("mine");
});

function updateCmpSum() {
  setSumDisplay(
    document.getElementById("fill-cmp-sum"),
    document.getElementById("fill-cmp-sum-wrap"),
    sumPct(state.cmpRows),
  );
}

function renderFillCmp() {
  const tbody = document.querySelector("#fill-cmp-table tbody");
  tbody.innerHTML = state.cmpRows.map((row, i) =>
    `<tr>${rowCellsHtml(row, i, { includeGroup: true })}</tr>`
  ).join("") || `<tr><td colspan="7"><div class="a3-table-empty"><i class="fas fa-inbox"></i>暂无行，请添加</div></td></tr>`;

  bindRowControls(
    tbody,
    () => state.cmpRows,
    (rows) => { state.cmpRows = rows; },
    renderFillCmp,
  );
  updateCmpSum();
}

document.getElementById("fill-cmp-week").addEventListener("change", (e) => {
  const week = e.target.value.startsWith("2026-W38") ? "2026-W38" : "2026-W39";
  if (week === state.cmpWeek) return;
  state.cmpWeek = week;
  state.cmpRows = cloneRows(week);
  renderFillCmp();
});

document.getElementById("add-cmp-row").addEventListener("click", () => {
  state.cmpRows.push(emptyRow(GROUPS[0]));
  renderFillCmp();
});
document.getElementById("save-cmp-draft").addEventListener("click", () => toast("info", "已暂存（平铺变体）"));
document.getElementById("submit-cmp-fill").addEventListener("click", () => {
  if (!state.cmpRows.length) return toast("warning", "请至少添加一行");
  const incomplete = state.cmpRows.some((r) => !r.group || !r.brand || !r.line || !r.type);
  if (incomplete) return toast("warning", "请完善业务组、品牌品线与执行单类型");
  const needSub = state.cmpRows.some((r) => (EXECUTE_SUBTYPES[r.type] || []).length && !r.sub);
  if (needSub) return toast("warning", "请选择执行单子类型");
  const total = sumPct(state.cmpRows);
  if (Math.abs(total - 100) >= 0.05) return toast("warning", `本周占比合计须为 100%，当前为 ${total}%`);
  toast("success", "平铺变体已提交（演示）。可切回「周填报」对照分块交互。");
});

function statusTag(status) {
  if (status === "locked") {
    return '<span class="a3-tag a3-tag-success"><span class="a3-tag-dot"></span>已锁定</span>';
  }
  return '<span class="a3-tag a3-tag-info"><span class="a3-tag-dot"></span>已提交</span>';
}

function renderMine() {
  const tbody = document.querySelector("#mine-table tbody");
  const entries = state.history.length
    ? state.history
    : state.submitted
      ? [{ week: state.week, status: state.locked ? "locked" : "submitted", rows: state.rows }]
      : [];
  if (!entries.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="a3-empty"><i class="fas fa-inbox"></i><div class="a3-empty-text">暂无提交记录，请先在「周填报」提交</div></div></td></tr>`;
    return;
  }
  tbody.innerHTML = entries.flatMap((h) =>
    h.rows.map((r) => `
      <tr>
        <td>${h.week}</td>
        <td>${r.group}</td>
        <td>${r.brand}</td>
        <td>${r.line}</td>
        <td>${EXECUTE_LABEL[r.type] || r.type}</td>
        <td>${subLabel(r.type, r.sub)}</td>
        <td>${r.pct}%</td>
        <td>${statusTag(h.status)}</td>
      </tr>
    `)
  ).join("");
}

function expandParts(person, brand, line, typeLabel, filled, parts) {
  return parts.map((p) => ({
    person,
    brand: `${brand} / ${line}`,
    type: typeLabel,
    filled: filled + "%",
    project: p.project,
    order: p.order,
    pct: Math.round(p.w * 100) + "%",
    hours: round1(filled * p.w) + "%",
  }));
}

function buildSplits() {
  const dept = state.rows.filter((r) => r.group === LEADER_GROUP);
  const out = [];
  dept.forEach((r) => {
    const typeLabel = `${EXECUTE_LABEL[r.type] || r.type}${r.sub ? " / " + subLabel(r.type, r.sub) : ""}`;
    const parts = SPLIT_CATALOG[`${r.brand}|${r.line}|${r.type}`] || [{ project: "待匹配项目", order: "—", w: 1 }];
    out.push(...expandParts("林可", r.brand, r.line, typeLabel, r.pct, parts));
  });
  if (state.week === "2026-W39") {
    TEAM_DEPT1_EXTRAS.forEach((m) => {
      const typeLabel = `${EXECUTE_LABEL[m.type] || m.type}${m.sub ? " / " + subLabel(m.type, m.sub) : ""}`;
      out.push(...expandParts(m.person, m.brand, m.line, typeLabel, m.filled, m.parts));
    });
  }
  return out;
}

function renderLeader() {
  const isLeader = state.role === "leader";
  document.getElementById("leader-gate").style.display = isLeader ? "none" : "flex";
  document.getElementById("leader-body").style.display = isLeader ? "block" : "none";
  if (!isLeader) return;
  const splits = buildSplits();
  const hours = round1(splits.reduce((s, r) => s + parseFloat(r.hours), 0));
  document.getElementById("leader-hours").textContent = hours + "%";
  document.getElementById("leader-projects").textContent = new Set(splits.map((r) => r.project)).size;
  document.getElementById("leader-status").className = state.locked ? "a3-tag a3-tag-success" : "a3-tag a3-tag-warning";
  document.getElementById("leader-status").innerHTML = state.locked
    ? '<span class="a3-tag-dot"></span>已锁定'
    : '<span class="a3-tag-dot"></span>待确认';
  const lockBtn = document.getElementById("lock-btn");
  lockBtn.disabled = state.locked;
  lockBtn.innerHTML = state.locked
    ? '<i class="fas fa-lock"></i> 本周已锁定'
    : '<i class="fas fa-lock"></i> 确认并锁定本周';
  document.querySelector("#leader-table tbody").innerHTML = splits.length
    ? splits.map((r) => `
      <tr>
        <td>${r.person}</td><td>${r.brand}</td><td>${r.type}</td><td>${r.filled}</td>
        <td>${r.project}</td><td>${r.order}</td><td>${r.pct}</td><td>${r.hours}</td>
      </tr>`).join("")
    : `<tr><td colspan="8"><div class="a3-table-empty"><i class="fas fa-inbox"></i>本组本周暂无待确认工时</div></td></tr>`;
}

document.getElementById("lock-btn").addEventListener("click", () => {
  state.locked = true;
  syncHistoryCurrentWeek();
  toast("success", "已确认锁定，纳入人效统计");
  renderLeader();
});

function renderProject() {
  const showCost = roleMeta[state.role].showCost;
  document.querySelectorAll("#project-table .cost-col").forEach((el) => {
    el.style.display = showCost ? "" : "none";
  });
  document.querySelector("#project-table tbody").innerHTML = PROJECT_REPORT.map((r) => `
    <tr>
      <td>${r.project}</td><td>${r.brand}</td><td>${r.types}</td><td>${r.days}</td>
      <td class="cost-col" style="display:${showCost ? "" : "none"}">${r.cost.toLocaleString()}</td>
    </tr>`).join("");
}

function renderBrand() {
  const showCost = roleMeta[state.role].showCost;
  document.querySelectorAll("#brand-table .cost-col").forEach((el) => {
    el.style.display = showCost ? "" : "none";
  });
  const bf = document.getElementById("brand-filter");
  if (bf.options.length <= 1) {
    GROUPS.forEach((g) => {
      const o = document.createElement("option");
      o.value = g;
      o.textContent = g;
      bf.appendChild(o);
    });
  }
  const filter = bf.value;
  const rows = (filter ? BRAND_REPORT.filter((r) => r.group === filter) : BRAND_REPORT)
    .slice()
    .sort((a, b) =>
      a.group.localeCompare(b.group, "zh") ||
      a.brand.localeCompare(b.brand, "zh") ||
      a.line.localeCompare(b.line, "zh")
    );

  let lastGroup = "";
  let lastBrand = "";
  document.querySelector("#brand-table tbody").innerHTML = rows.map((r) => {
    const showGroup = r.group !== lastGroup;
    const showBrand = showGroup || r.brand !== lastBrand;
    lastGroup = r.group;
    lastBrand = r.brand;
    return `
    <tr>
      <td>${showGroup ? r.group : ""}</td>
      <td>${showBrand ? r.brand : ""}</td>
      <td>${r.line}</td>
      <td>${r.days}</td>
      <td>${r.media}</td><td>${r.buy}</td><td>${r.plan}</td>
      <td class="cost-col" style="display:${showCost ? "" : "none"}">${r.cost.toLocaleString()}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="8"><div class="a3-table-empty">无匹配数据</div></td></tr>`;
}

document.getElementById("brand-filter").addEventListener("change", () => {
  if (document.getElementById("page-brand").classList.contains("active")) renderBrand();
});
document.getElementById("brand-query").addEventListener("click", () => renderBrand());

function renderMaster() {
  document.getElementById("md-brands").textContent =
    BRANDS.join("、") + "（CRM BrandDTO.brandName；知识库品牌）";
  document.getElementById("md-lines").textContent =
    Object.entries(LINES).map(([b, ls]) => `${b}→${ls.join("/")}`).join("；") +
    "（BrandDTO.productLines；品牌→品线级联同 productLineSelect.ts）";
  document.getElementById("md-groups").textContent = GROUPS.join("、");
  const typeText = EXECUTE_TYPES.map((t) => {
    const subs = EXECUTE_SUBTYPES[t.value] || [];
    return subs.length
      ? `${t.label}→${subs.map((s) => s.label).join("/")}`
      : `${t.label}（无子类型）`;
  }).join("；");
  document.getElementById("md-types").textContent = typeText + "（=执行单类型，两级；源自 CreateExecutionOrder/store.ts）";
}

function progressBarHtml(pct, success) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return `
    <div class="a3-progress ${success ? "success" : ""}">
      <div class="a3-progress-track"><div class="a3-progress-inner" style="width:${p}%"></div></div>
      <span class="a3-progress-text">${p}%</span>
    </div>
  `;
}

function staffTotal() {
  return GROUPS.reduce((s, g) => s + (Number(state.adminConfig.staffByDept[g]) || 0), 0);
}

function updateCfgMeta() {
  const el = document.getElementById("cfg-save-meta");
  const parts = [];
  if (state.adminConfig.savedAt) parts.push("已保存 " + state.adminConfig.savedAt);
  if (state.adminDraftMeta) parts.push("草稿 " + state.adminDraftMeta);
  el.textContent = parts.length ? parts.join(" · ") : "尚未保存";
  document.getElementById("cfg-staff-total").textContent = staffTotal();
}

function renderAdminConfig() {
  const isAdmin = state.role === "admin";
  document.getElementById("admin-config-gate").style.display = isAdmin ? "none" : "flex";
  document.getElementById("admin-config-body").style.display = isAdmin ? "block" : "none";
  if (!isAdmin) return;

  const filterEl = document.getElementById("cfg-dept-filter");
  if (filterEl.options.length <= 1) {
    GROUPS.forEach((g) => {
      const o = document.createElement("option");
      o.value = g;
      o.textContent = g;
      filterEl.appendChild(o);
    });
  }
  const filter = filterEl.value;
  const depts = filter ? [filter] : GROUPS;
  document.querySelector("#cfg-staff-table tbody").innerHTML = depts.map((g) => `
    <tr>
      <td>${g}</td>
      <td><div class="a3-input-wrapper" style="max-width:120px">
        <input class="a3-input" type="number" min="0" max="999" step="1" value="${state.adminConfig.staffByDept[g] || 0}" data-staff="${g}" />
      </div></td>
      <td class="a3-text-secondary">应填人数基准（填报进度面板）</td>
    </tr>
  `).join("");

  const mapDepts = filter ? [filter] : GROUPS;
  document.querySelector("#cfg-dept-brand-table tbody").innerHTML = mapDepts.map((g) => {
    const selected = new Set(state.adminConfig.deptBrands[g] || []);
    const tags = BRANDS.map((b) => `
      <label class="yc-brand-tag">
        <input type="checkbox" data-dept-brand="${g}" value="${b}" ${selected.has(b) ? "checked" : ""} />
        ${b}
      </label>
    `).join("");
    return `<tr><td>${g}</td><td><div class="yc-brand-tags">${tags}</div></td></tr>`;
  }).join("");

  document.querySelectorAll("[data-staff]").forEach((el) => {
    el.addEventListener("change", () => {
      state.adminConfig.staffByDept[el.dataset.staff] = Number(el.value) || 0;
      updateCfgMeta();
    });
  });
  document.querySelectorAll("[data-dept-brand]").forEach((el) => {
    el.addEventListener("change", () => {
      const dept = el.dataset.deptBrand;
      const checked = [...document.querySelectorAll(`[data-dept-brand="${dept}"]:checked`)].map((c) => c.value);
      state.adminConfig.deptBrands[dept] = checked.length ? checked : [BRANDS[0]];
      if (!checked.length) {
        const fallback = document.querySelector(`[data-dept-brand="${dept}"][value="${BRANDS[0]}"]`);
        if (fallback) fallback.checked = true;
        toast("warning", `${dept} 至少保留一个品牌`);
      }
    });
  });
  updateCfgMeta();
}

document.getElementById("cfg-dept-filter").addEventListener("change", () => {
  if (document.getElementById("page-admin-config").classList.contains("active")) renderAdminConfig();
});

document.getElementById("cfg-draft").addEventListener("click", () => {
  if (state.role !== "admin") return toast("warning", "仅管理员可暂存");
  const draftedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  localStorage.setItem(ADMIN_DRAFT_KEY, JSON.stringify({
    staffByDept: state.adminConfig.staffByDept,
    deptBrands: state.adminConfig.deptBrands,
    draftedAt,
  }));
  state.adminDraftMeta = draftedAt;
  updateCfgMeta();
  toast("info", "配置草稿已暂存到本机");
});

document.getElementById("cfg-save").addEventListener("click", () => {
  if (state.role !== "admin") return toast("warning", "仅管理员可保存");
  const savedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  state.adminConfig.savedAt = savedAt;
  localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify({
    staffByDept: state.adminConfig.staffByDept,
    deptBrands: state.adminConfig.deptBrands,
    savedAt,
  }));
  localStorage.removeItem(ADMIN_DRAFT_KEY);
  state.adminDraftMeta = null;
  updateCfgMeta();
  toast("success", "配置已保存：员工数与部门品牌映射已生效");
});

function weekProgress(week) {
  const submittedMap = WATCH_SUBMITTED[week] || {};
  let submitted = 0;
  let expected = 0;
  const byDept = GROUPS.map((g) => {
    const exp = Number(state.adminConfig.staffByDept[g]) || 0;
    const sub = Math.min(Number(submittedMap[g]) || 0, exp || 999);
    submitted += sub;
    expected += exp;
    const pct = exp ? Math.round((sub / exp) * 100) : 0;
    return { group: g, submitted: sub, expected: exp, pct };
  });
  const overall = expected ? Math.round((submitted / expected) * 100) : 0;
  return { week, submitted, expected, overall, byDept };
}

function watchStatusTag(pct) {
  if (pct >= 100) return '<span class="a3-tag a3-tag-success"><span class="a3-tag-dot"></span>已完成</span>';
  if (pct >= 60) return '<span class="a3-tag a3-tag-warning"><span class="a3-tag-dot"></span>进行中</span>';
  return '<span class="a3-tag a3-tag-danger"><span class="a3-tag-dot"></span>滞后</span>';
}

function shiftWatchWeek(delta) {
  const idx = WATCH_WEEKS.indexOf(state.watchWeek);
  const cur = idx < 0 ? WATCH_WEEKS.length - 1 : idx;
  const next = (cur + delta + WATCH_WEEKS.length) % WATCH_WEEKS.length;
  state.watchWeek = WATCH_WEEKS[next];
  renderAdminWatch();
}

function renderAdminWatch() {
  const isAdmin = state.role === "admin";
  document.getElementById("admin-watch-gate").style.display = isAdmin ? "none" : "flex";
  document.getElementById("admin-watch-body").style.display = isAdmin ? "block" : "none";
  if (!isAdmin) return;

  if (!WATCH_WEEKS.includes(state.watchWeek)) state.watchWeek = WATCH_WEEKS[WATCH_WEEKS.length - 1];

  const weekSelect = document.getElementById("watch-week-select");
  if (weekSelect.options.length !== WATCH_WEEKS.length) {
    weekSelect.innerHTML = WATCH_WEEKS.map((w) =>
      `<option value="${w}" ${w === state.watchWeek ? "selected" : ""}>${w}</option>`
    ).join("");
  } else {
    weekSelect.value = state.watchWeek;
  }

  const cur = weekProgress(state.watchWeek);
  const doneDepts = cur.byDept.filter((d) => d.pct >= 100).length;
  const lagDepts = cur.byDept.filter((d) => d.pct < 60).length;
  const weekIdx = WATCH_WEEKS.indexOf(state.watchWeek) + 1;

  document.getElementById("watch-week-label").textContent = cur.week;
  document.getElementById("watch-week-hint").textContent = `${weekIdx} / ${WATCH_WEEKS.length} · 左键下一周 · 右键上一周`;
  document.getElementById("watch-table-week").textContent = `· ${cur.week}`;

  document.getElementById("watch-week-cards").innerHTML = `
    <div class="a3-card yc-stat yc-watch-stat"><div class="a3-card-body">
      <div class="a3-text-secondary" style="font-size:12px">整体进度</div>
      <div class="a3-text-brand a3-mt-8" style="font-size:22px;font-weight:600">${cur.overall}%</div>
      <div class="a3-mt-8">${progressBarHtml(cur.overall, cur.overall >= 100)}</div>
    </div></div>
    <div class="a3-card yc-stat yc-watch-stat"><div class="a3-card-body">
      <div class="a3-text-secondary" style="font-size:12px">已提交</div>
      <div class="a3-text-primary a3-mt-8" style="font-size:22px;font-weight:600">${cur.submitted}</div>
      <div class="a3-text-secondary a3-mt-8" style="font-size:12px">人</div>
    </div></div>
    <div class="a3-card yc-stat yc-watch-stat"><div class="a3-card-body">
      <div class="a3-text-secondary" style="font-size:12px">应填</div>
      <div class="a3-text-primary a3-mt-8" style="font-size:22px;font-weight:600">${cur.expected}</div>
      <div class="a3-text-secondary a3-mt-8" style="font-size:12px">人（配置员工数）</div>
    </div></div>
    <div class="a3-card yc-stat yc-watch-stat"><div class="a3-card-body">
      <div class="a3-text-secondary" style="font-size:12px">部门完成 / 滞后</div>
      <div class="a3-text-primary a3-mt-8" style="font-size:22px;font-weight:600">${doneDepts} / ${lagDepts}</div>
      <div class="a3-mt-8">${watchStatusTag(cur.overall)}</div>
    </div></div>
  `;

  document.getElementById("watch-overall-bar").innerHTML = `
    <div class="a3-flex-between a3-mb-8" style="justify-content:space-between">
      <span class="a3-text-primary" style="font-weight:600">${cur.week} 整体进度</span>
      <span class="a3-text-secondary">${cur.submitted} / ${cur.expected} 人 · ${watchStatusTag(cur.overall)}</span>
    </div>
    ${progressBarHtml(cur.overall, cur.overall >= 100)}
  `;

  document.querySelector("#watch-dept-table tbody").innerHTML = cur.byDept.map((d) => `
    <tr>
      <td>${d.group}</td>
      <td>${d.submitted}</td>
      <td>${d.expected}</td>
      <td style="min-width:180px">${progressBarHtml(d.pct, d.pct >= 100)}</td>
      <td>${watchStatusTag(d.pct)}</td>
    </tr>
  `).join("");
}

document.getElementById("watch-week-prev").addEventListener("click", () => shiftWatchWeek(-1));
document.getElementById("watch-week-next").addEventListener("click", () => shiftWatchWeek(1));

const watchCardsEl = document.getElementById("watch-week-cards");
watchCardsEl.addEventListener("click", () => shiftWatchWeek(1));
watchCardsEl.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  shiftWatchWeek(-1);
});

document.getElementById("watch-week-select").addEventListener("change", (e) => {
  state.watchWeek = e.target.value;
  renderAdminWatch();
});

function sparkline(values, invert) {
  if (!values || values.length < 2) return "";
  const w = 72;
  const h = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / span) * (h - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const up = values[values.length - 1] >= values[0];
  const good = invert ? !up : up;
  const color = good ? "#52C41A" : "#ff4d4f";
  return `<svg class="yc-spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline fill="none" stroke="${color}" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" points="${pts}"/></svg>`;
}

function shareBar(pct, showPct) {
  const n = Math.max(0, Math.min(100, Number(pct) || 0));
  const lab = showPct === false ? "" : `<em>${n.toFixed(1)}%</em>`;
  return `<span class="yc-share"><span class="yc-share-track"><i style="width:${n}%"></i></span>${lab}</span>`;
}

function syncContribCut() {
  document.querySelectorAll("[data-contrib-cut]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.contribCut === state.contribCut);
  });
}

function setContribCut(cut) {
  state.contribCut = cut === "client" ? "client" : "brand";
  syncContribCut();
  const ov = document.getElementById("page-fin-overview");
  const rev = document.getElementById("page-fin-revenue");
  if (ov && ov.classList.contains("active")) renderFinOverview();
  if (rev && rev.classList.contains("active")) renderFinRevenue();
}

function contribHead(periodWord) {
  return `${periodWord}贡献 · ${state.contribCut === "client" ? "按客户" : "按品牌"}`;
}

function renderContribRows(brandMap, prevBrandMap, yoyBrandMap, momLabel, yoyLabel, preset) {
  const byClient = state.contribCut === "client";
  const map = byClient ? clientsFromBrands(brandMap) : brandMap;
  const prevMap = byClient ? clientsFromBrands(prevBrandMap || {}) : (prevBrandMap || {});
  const yoyMap = byClient ? clientsFromBrands(yoyBrandMap || {}) : (yoyBrandMap || {});
  const tip = metricTip("contrib", preset);
  return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, amt]) => {
    const sub = byClient
      ? `品牌 ${(CLIENT_BRANDS[name] || []).join("、")}`
      : `客户 ${clientOf(name)}`;
    const compare = fmtCompareStack(
      amt,
      prevMap[name] == null ? null : prevMap[name],
      yoyMap[name] == null ? null : yoyMap[name],
      "元",
      false,
      momLabel,
      yoyLabel,
    );
    return `<div class="yc-conc-row yc-conc-nums">
      <div class="yc-conc-name">
        <b>${name}</b>
        <span class="yc-conc-sub">${sub}</span>
      </div>
      <div class="yc-conc-amt">¥ ${fmtMoney(amt)} ${tipIcon(tip, { side: true })}</div>
      <div class="yc-conc-delta">${compare}</div>
    </div>`;
  }).join("");
}

function kpiCell(opts) {
  const { label, main, compareHtml, delta, spark, invert, tip } = opts;
  const deltaHtml = compareHtml != null
    ? compareHtml
    : (delta ? `<span class="${delta.cls}">${delta.text}</span>` : "");
  return `<div class="yc-kpi-cell">
    <div class="yc-kpi-label"><span class="yc-kpi-label-text">${label}</span>${tip ? tipIcon(tip, { side: true }) : ""}</div>
    <div class="yc-kpi-value">${main}</div>
    <div class="yc-kpi-foot">
      ${deltaHtml}
      ${sparkline(spark, invert)}
    </div>
  </div>`;
}

function kpiMain(k) {
  if (k.unit === "%") return `${k.value.toFixed(1)}%`;
  if (k.unit === "条") return String(k.value);
  return `¥ ${fmtMoney(k.value)}`;
}

function levelTag(level) {
  if (level === "高") return `<span class="a3-tag a3-tag-danger"><span class="a3-tag-dot"></span>高</span>`;
  if (level === "中") return `<span class="a3-tag a3-tag-warning"><span class="a3-tag-dot"></span>中</span>`;
  return `<span class="a3-tag a3-tag-default"><span class="a3-tag-dot"></span>${level}</span>`;
}

function syncCompareModeUi() {
  document.querySelectorAll("[data-fin-compare-select]").forEach((el) => {
    el.value = state.compareMode;
  });
}

function setCompareMode(mode) {
  saveCompareMode(mode);
  syncCompareModeUi();
  const ov = document.getElementById("page-fin-overview");
  const rev = document.getElementById("page-fin-revenue");
  if (ov && ov.classList.contains("active")) renderFinOverview();
  if (rev && rev.classList.contains("active")) renderFinRevenue();
}

function renderFinOverview() {
  const isCeo = state.role === "ceo";
  const from = state.ovFrom;
  const to = state.ovTo;
  const preset = state.ovPreset;
  const isDay = from === to;
  const momLabel = ovMomLabel(preset);
  const yoyLabel = ovYoyLabel(preset);
  const cur = sumPeriod(from, to);
  const prevWin = previousWindow(from, to);
  const yoyWin = yoyWindow(from, to);
  const emptyPrev = {
    revenue: null, cashin: null, cost: null, gross: null, margin: null, pending: null, brands: {},
  };
  const prev = (prevWin.from && prevWin.to) ? sumPeriod(prevWin.from, prevWin.to) : emptyPrev;
  const yoy = (yoyWin.from && yoyWin.to) ? sumPeriod(yoyWin.from, yoyWin.to) : emptyPrev;
  const periodWord = isDay ? "当日" : "期间";

  const titles = {
    today: "今日总览",
    "7d": "近 7 天总览",
    "30d": "近一个月总览",
    custom: "区间总览",
  };
  const kickers = {
    today: "观测台 · T+1 确认 · 今日",
    "7d": "观测台 · T+1 确认 · 近 7 天",
    "30d": "观测台 · T+1 确认 · 近一个月",
    custom: "观测台 · T+1 确认 · 自选区间",
  };
  const titleText = document.querySelector("#fin-overview-title .yc-cockpit-title-text");
  if (titleText) titleText.textContent = titles[preset] || "总览";
  document.getElementById("fin-overview-kicker").textContent = kickers[preset] || kickers.custom;
  document.getElementById("fin-overview-asof").textContent = isDay ? `截至 ${to}` : `${from} – ${to}`;
  document.getElementById("fin-overview-role-hint").textContent = isCeo ? "CEO 视角" : (state.role === "cfo" ? "CFO 视角" : "高管视角");
  const cmpBits = [];
  if (showMom()) cmpBits.push(momLabel);
  if (showYoy()) cmpBits.push(yoyLabel);
  const cmpText = cmpBits.length ? cmpBits.join(" · ") : "不显示比较";
  document.getElementById("fin-overview-lead").textContent = isDay
    ? `执行单确认收入 · ${cmpText} · 异常最多 3 条。`
    : `执行单确认收入 · ${from} 至 ${to} 合计 · ${cmpText} · 异常最多 3 条。`;
  document.getElementById("fin-conc-head").textContent = contribHead(periodWord);
  fillFormulaBody("overview");
  const titleTip = document.getElementById("fin-overview-title-tip");
  if (titleTip) titleTip.textContent = "展开下方「口径 / 计算公式」查看完整公式";
  syncContribCut();
  syncCompareModeUi();

  const fromEl = document.getElementById("fin-ov-from");
  const toEl = document.getElementById("fin-ov-to");
  if (fromEl.value !== from) fromEl.value = from;
  if (toEl.value !== to) toEl.value = to;
  document.querySelectorAll("#fin-ov-presets .yc-seg-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.ovPreset === preset);
  });
  document.getElementById("fin-ov-range").classList.toggle("is-custom", preset === "custom");

  const sparkOrTrail = (key) => {
    if (cur.days.length > 1) return cur.sparks[key];
    const trailFrom = addDaysISO(to, -6);
    return sumPeriod(clampIso(trailFrom), to).sparks[key];
  };

  const yoyMargin = yoy.margin == null ? null : Math.round(yoy.margin * 10) / 10;
  const momMargin = prev.margin == null ? null : Math.round(prev.margin * 10) / 10;
  const kpis = [
    { key: "revenue", label: `${periodWord}确认收入`, value: cur.revenue, prev: prev.revenue, yoy: yoy.revenue, unit: "元", invert: false, spark: sparkOrTrail("revenue") },
    { key: "cashin", label: `${periodWord}回款`, value: cur.cashin, prev: prev.cashin, yoy: yoy.cashin, unit: "元", invert: false, spark: sparkOrTrail("cashin") },
    { key: "cost", label: `${periodWord}成本（可归）`, value: cur.cost, prev: prev.cost, yoy: yoy.cost, unit: "元", invert: true, spark: sparkOrTrail("cost") },
    { key: "gross", label: `${periodWord}毛利`, value: cur.gross, prev: prev.gross, yoy: yoy.gross, unit: "元", invert: false, spark: sparkOrTrail("gross") },
    { key: "margin", label: `${periodWord}毛利率`, value: Math.round(cur.margin * 10) / 10, prev: momMargin, yoy: yoyMargin, unit: "%", invert: false, spark: sparkOrTrail("margin") },
    { key: "pending", label: "待确认 / 异常", value: cur.pending, prev: prev.pending, yoy: yoy.pending, unit: "条", invert: true, spark: sparkOrTrail("pending") },
  ];
  document.getElementById("fin-kpi-grid").innerHTML = kpis.map((k) => kpiCell({
    label: k.label,
    main: kpiMain(k),
    compareHtml: fmtCompareStack(k.value, k.prev, k.yoy, k.unit, k.invert, momLabel, yoyLabel),
    spark: k.spark,
    invert: k.invert,
    tip: metricTip(k.key, preset),
  })).join("");

  document.getElementById("fin-conc-list").innerHTML = renderContribRows(
    cur.brands, prev.brands, yoy.brands, momLabel, yoyLabel, preset,
  );

  const alerts = ovAlerts(preset, from, to);
  document.getElementById("fin-alert-list").innerHTML = alerts.map((a) => {
    const goto = a.type.includes("回款") ? "fin-cash" : a.type.includes("毛利") ? "fin-margin" : "fin-revenue";
    return `<button type="button" class="yc-alert-row" data-fin-goto="${goto}">
      ${levelTag(a.level)}
      <span class="yc-alert-body">
        <b>${a.type}</b>
        <span>${a.summary}</span>
      </span>
      <span class="yc-alert-impact">${a.impact}</span>
      <span class="yc-alert-act">${a.action}</span>
    </button>`;
  }).join("");
  document.querySelectorAll("#fin-alert-list [data-fin-goto]").forEach((btn) => {
    btn.addEventListener("click", () => go(btn.getAttribute("data-fin-goto")));
  });
  const hiddenTbody = document.querySelector("#fin-alert-table tbody");
  if (hiddenTbody) {
    hiddenTbody.innerHTML = alerts.map((a) => `<tr><td>${a.type}</td></tr>`).join("");
  }
}

function ensureFinRevFilters() {
  const typeSel = document.getElementById("fin-rev-type");
  const groupSel = document.getElementById("fin-rev-group");
  if (typeSel && typeSel.options.length <= 1) {
    EXECUTE_TYPES.forEach((t) => {
      const o = document.createElement("option");
      o.value = t.value;
      o.textContent = t.label;
      typeSel.appendChild(o);
    });
  }
  if (groupSel && groupSel.options.length <= 1) {
    GROUPS.forEach((g) => {
      const o = document.createElement("option");
      o.value = g;
      o.textContent = g;
      groupSel.appendChild(o);
    });
  }
}

function renderFinRevenue() {
  ensureFinRevFilters();
  syncContribCut();
  syncCompareModeUi();
  const byClient = state.contribCut === "client";
  const type = document.getElementById("fin-rev-type").value;
  const group = document.getElementById("fin-rev-group").value;
  let rows = FIN_REVENUE_ROWS.map((r) => ({ ...r, client: clientOf(r.brand) }));
  if (type) rows = rows.filter((r) => r.type === type);
  if (group) rows = rows.filter((r) => r.group === group);
  if (byClient) {
    rows.sort((a, b) => a.client.localeCompare(b.client, "zh") || b.amount - a.amount);
  } else {
    rows.sort((a, b) => a.brand.localeCompare(b.brand, "zh") || b.amount - a.amount);
  }
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const prevTotal = rows.reduce((s, r) => s + r.prev, 0);
  const yoyTotal = rows.reduce((s, r) => s + (r.yoy || 0), 0);
  const depts = new Set(rows.map((r) => r.group)).size;
  const brands = new Set(rows.map((r) => r.brand)).size;
  const clients = new Set(rows.map((r) => r.client)).size;
  const cutLabel = byClient ? "按客户" : "按品牌";
  const groups = {};
  rows.forEach((r) => {
    const key = byClient ? r.client : r.brand;
    if (!groups[key]) {
      groups[key] = { name: key, client: r.client, brands: new Set(), amount: 0, prev: 0, yoy: 0 };
    }
    groups[key].amount += r.amount;
    groups[key].prev += r.prev;
    groups[key].yoy += r.yoy || 0;
    groups[key].brands.add(r.brand);
    groups[key].client = clientOf(r.brand);
  });
  const agg = Object.values(groups).sort((a, b) => b.amount - a.amount);
  fillFormulaBody("revenue");
  const titleTip = document.getElementById("fin-rev-title-tip");
  if (titleTip) titleTip.textContent = "展开下方「口径 / 计算公式」查看完整公式";
  document.getElementById("fin-rev-cut-label").textContent = `明细 · ${cutLabel}`;
  document.getElementById("fin-rev-lead").textContent = byClient
    ? "当前切片：按客户。金佰利含好奇+高洁丝；与按品牌加总不同口径。"
    : "当前切片：按品牌。同一客户下的品牌分开计；可切到按客户。";
  document.getElementById("fin-rev-summary").innerHTML = [
    kpiCell({
      label: "筛选后确认收入",
      main: `¥ ${fmtMoney(total)}`,
      compareHtml: fmtCompareStack(total, prevTotal, yoyTotal, "元", false, "较昨日", "较去年同日"),
      spark: [12, 13, 12.5, 14, 15, 16, total / 100000],
      invert: false,
      tip: metricTip("rev_total", "today"),
    }),
    `<div class="yc-kpi-cell"><div class="yc-kpi-label">涉及营销部</div><div class="yc-kpi-value">${depts}</div><div class="yc-kpi-foot"><span class="yc-muted">一部–九部</span></div></div>`,
    `<div class="yc-kpi-cell"><div class="yc-kpi-label">${byClient ? "涉及客户" : "涉及品牌"}</div><div class="yc-kpi-value">${byClient ? clients : brands}</div><div class="yc-kpi-foot"><span class="yc-muted">${byClient ? "合同主体" : "BRAND_LINE_MASTER"}</span></div></div>`,
    `<div class="yc-kpi-cell"><div class="yc-kpi-label">明细行</div><div class="yc-kpi-value">${agg.length}</div><div class="yc-kpi-foot"><span class="yc-muted">${cutLabel}</span></div></div>`,
  ].join("");
  const headLeft = byClient
    ? `<th>客户</th><th>覆盖品牌</th><th class="yc-num">确认收入 ${tipIcon(metricTip("rev_row", "today"), { side: true })}</th>`
    : `<th>品牌</th><th>客户</th><th class="yc-num">确认收入 ${tipIcon(metricTip("rev_row", "today"), { side: true })}</th>`;
  const headCmp = [
    showMom() ? `<th class="yc-num">环比</th>` : "",
    showYoy() ? `<th class="yc-num">同比</th>` : "",
  ].join("");
  document.getElementById("fin-rev-thead-row").innerHTML = `${headLeft}${headCmp}`;
  const colSpan = 3 + (showMom() ? 1 : 0) + (showYoy() ? 1 : 0);
  document.querySelector("#fin-rev-table tbody").innerHTML = agg.length ? agg.map((r) => {
    const second = byClient ? [...r.brands].join("、") : r.client;
    const mom = fmtDelta(r.amount, r.prev, "元", false, "较昨日");
    const yoy = fmtDelta(r.amount, r.yoy, "元", false, "较去年同日");
    const cmpCells = [
      showMom() ? `<td class="yc-num ${mom.cls}">${mom.text.replace("较昨日 ", "")}</td>` : "",
      showYoy() ? `<td class="yc-num ${yoy.cls}">${yoy.text.replace("较去年同日 ", "")}</td>` : "",
    ].join("");
    return `
      <tr>
        <td>${r.name}</td>
        <td>${second}</td>
        <td class="yc-num">¥ ${fmtMoney(r.amount)}</td>
        ${cmpCells}
      </tr>
    `;
  }).join("") : `<tr><td colspan="${colSpan}" class="a3-text-secondary">无匹配数据</td></tr>`;
}

function renderFinCash() {
  const isCfo = state.role === "cfo" || state.role === "finance" || state.role === "admin";
  document.getElementById("fin-cash-role-hint").textContent = isCfo ? "CFO 视角" : "CEO 摘要";
  const cashIn = FIN_KPIS.find((k) => k.key === "cashin");
  const notDue = FIN_AGING.find((a) => a.bucket === "未到期");
  const overdue = FIN_AGING.filter((a) => a.bucket !== "未到期").reduce((s, a) => s + a.amount, 0);
  const overduePrev = 1680000;
  document.getElementById("fin-cash-kpis").innerHTML = [
    kpiCell({ label: "当日回款", main: `¥ ${fmtMoney(cashIn.value)}`, delta: fmtDelta(cashIn.value, cashIn.prev, "元"), spark: cashIn.spark }),
    `<div class="yc-kpi-cell"><div class="yc-kpi-label">未到期应收</div><div class="yc-kpi-value">¥ ${fmtMoney(notDue.amount)}</div><div class="yc-kpi-foot"><span class="yc-muted">${notDue.clients} 家客户</span></div></div>`,
    kpiCell({ label: "逾期合计", main: `¥ ${fmtMoney(overdue)}`, delta: fmtDelta(overdue, overduePrev, "元", true), spark: [15, 16, 16.5, 17, 16.8, 17.2, 18.9], invert: true }),
    `<div class="yc-kpi-cell"><div class="yc-kpi-label">DSO（占位）</div><div class="yc-kpi-value">42<span class="yc-kpi-unit">天</span></div><div class="yc-kpi-foot"><span class="yc-muted">需财务公式 / 真接口</span></div></div>`,
  ].join("");
  const agingTotal = FIN_AGING.reduce((s, a) => s + a.amount, 0);
  const tones = ["#52C41A", "#FAAD14", "#c9677d", "#ff4d4f"];
  document.getElementById("fin-aging-bars").innerHTML = `<div class="yc-stack">${FIN_AGING.map((a, i) => {
    const pct = agingTotal ? (a.amount / agingTotal) * 100 : 0;
    return `<i style="width:${pct}%;background:${tones[i]}" title="${a.bucket}"></i>`;
  }).join("")}</div>
  <div class="yc-stack-legend">${FIN_AGING.map((a, i) => `<span><i style="background:${tones[i]}"></i>${a.bucket}</span>`).join("")}</div>`;
  document.querySelector("#fin-aging-table tbody").innerHTML = FIN_AGING.map((a) => `
    <tr>
      <td>${a.bucket}</td>
      <td class="yc-num">${a.clients}</td>
      <td class="yc-num">¥ ${fmtMoney(a.amount)}</td>
      <td>${shareBar(agingTotal ? (a.amount / agingTotal) * 100 : 0)}</td>
      <td class="cfo-only">${a.focus}</td>
    </tr>
  `).join("");
  document.querySelector("#fin-cash-flow-table tbody").innerHTML = FIN_CASH_FLOWS.map((f) => {
    const st = f.status.includes("逾期")
      ? `<span class="a3-tag a3-tag-danger"><span class="a3-tag-dot"></span>${f.status}</span>`
      : f.status.includes("待")
        ? `<span class="a3-tag a3-tag-warning"><span class="a3-tag-dot"></span>${f.status}</span>`
        : `<span class="a3-tag a3-tag-success"><span class="a3-tag-dot"></span>${f.status}</span>`;
    return `
      <tr>
        <td>${f.client}</td>
        <td>${f.brand}</td>
        <td class="yc-num">${f.amount ? `¥ ${fmtMoney(f.amount)}` : "—"}</td>
        <td>${f.method}</td>
        <td>${st}</td>
      </tr>
    `;
  }).join("");
  document.querySelectorAll("#page-fin-cash .cfo-only").forEach((el) => {
    if (isCfo) el.style.removeProperty("display");
    else el.style.display = "none";
  });
}

function renderFinMargin() {
  const gross = FIN_KPIS.find((k) => k.key === "gross");
  const margin = FIN_KPIS.find((k) => k.key === "margin");
  const cost = FIN_KPIS.find((k) => k.key === "cost");
  document.getElementById("fin-margin-kpis").innerHTML = [
    kpiCell({ label: "当日可归成本", main: `¥ ${fmtMoney(cost.value)}`, delta: fmtDelta(cost.value, cost.prev, "元", true), spark: cost.spark, invert: true }),
    kpiCell({ label: "当日毛利", main: `¥ ${fmtMoney(gross.value)}`, delta: fmtDelta(gross.value, gross.prev, "元"), spark: gross.spark }),
    kpiCell({ label: "当日毛利率", main: `${margin.value.toFixed(1)}%`, delta: fmtDelta(margin.value, margin.prev, "%"), spark: margin.spark }),
    `<div class="yc-kpi-cell"><div class="yc-kpi-label">人力日成本</div><div class="yc-kpi-value">不拆日</div><div class="yc-kpi-foot"><span class="yc-muted">见已锁定周工时</span></div></div>`,
  ].join("");
  const mixSum = FIN_COST_MIX.filter((c) => c.amount != null).reduce((s, c) => s + c.amount, 0);
  document.getElementById("fin-cost-bars").innerHTML = FIN_COST_MIX.filter((c) => c.amount != null).map((c) => {
    const pct = mixSum ? (c.amount / mixSum) * 100 : 0;
    return `<div class="yc-conc-row">
      <div class="yc-conc-name">${c.name}</div>
      <div class="yc-conc-amt">¥ ${fmtMoney(c.amount)}</div>
      ${shareBar(pct)}
    </div>`;
  }).join("");
  document.querySelector("#fin-cost-mix-table tbody").innerHTML = FIN_COST_MIX.map((c) => {
    if (c.amount == null) {
      return `<tr>
        <td>${c.name}</td>
        <td class="yc-num yc-muted">—</td>
        <td class="yc-num yc-muted">—</td>
        <td class="yc-muted">${c.note}</td>
      </tr>`;
    }
    const d = fmtDelta(c.amount, c.prev, "元", true);
    return `<tr>
      <td>${c.name}</td>
      <td class="yc-num">¥ ${fmtMoney(c.amount)}</td>
      <td class="yc-num ${d.cls}">${d.text.replace("较昨日 ", "")}</td>
      <td>${shareBar(mixSum ? (c.amount / mixSum) * 100 : 0)}</td>
    </tr>`;
  }).join("");
  document.querySelector("#fin-brand-margin-table tbody").innerHTML = FIN_BRAND_MARGIN.map((b) => {
    const g = b.revenue - b.cost;
    const rate = b.revenue ? (g / b.revenue) * 100 : 0;
    const warn = rate < 25;
    return `<tr class="${warn ? "yc-row-warn" : ""}">
      <td>${b.brand}</td>
      <td class="yc-num">¥ ${fmtMoney(b.revenue)}</td>
      <td class="yc-num">¥ ${fmtMoney(b.cost)}</td>
      <td class="yc-num">¥ ${fmtMoney(g)}</td>
      <td>${rate.toFixed(1)}%${warn ? " <span class=\"yc-muted\">偏低</span>" : ""}</td>
    </tr>`;
  }).join("");
  document.querySelector("#fin-labor-week-table tbody").innerHTML = FIN_LABOR_WEEK.map((w) => {
    const locked = w.status === "locked";
    const tag = locked
      ? `<span class="a3-tag a3-tag-success"><span class="a3-tag-dot"></span>已锁定</span>`
      : `<span class="a3-tag a3-tag-warning"><span class="a3-tag-dot"></span>填报中</span>`;
    const days = locked ? w.days : "—";
    const efficiency = locked && w.days
      ? `¥ ${fmtMoney(Math.round(w.weekRevenue / w.days))} / 人天`
      : "人天未锁定";
    return `<tr>
      <td>${w.week}</td>
      <td>${tag}</td>
      <td class="yc-num">${days}</td>
      <td class="yc-num">¥ ${fmtMoney(w.weekRevenue)}</td>
      <td>${efficiency}</td>
      <td class="yc-muted">${w.note}</td>
    </tr>`;
  }).join("");
}

document.getElementById("fin-ov-presets").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-ov-preset]");
  if (!btn) return;
  applyOvPreset(btn.dataset.ovPreset);
  renderFinOverview();
});
document.getElementById("fin-ov-from").addEventListener("change", (e) => {
  applyOvPreset("custom", e.target.value, document.getElementById("fin-ov-to").value);
  renderFinOverview();
});
document.getElementById("fin-ov-to").addEventListener("change", (e) => {
  applyOvPreset("custom", document.getElementById("fin-ov-from").value, e.target.value);
  renderFinOverview();
});
document.querySelectorAll("[data-contrib-cut]").forEach((btn) => {
  btn.addEventListener("click", () => setContribCut(btn.dataset.contribCut));
});
document.querySelectorAll("[data-fin-compare-select]").forEach((el) => {
  el.addEventListener("change", (e) => setCompareMode(e.target.value));
});
["fin-overview-formula-toggle", "fin-rev-formula-toggle"].forEach((id) => {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener("click", () => setFormulaOpen(!state.formulaOpen));
});
syncFormulaPanels();

document.getElementById("fin-rev-query").addEventListener("click", () => renderFinRevenue());
document.getElementById("fin-rev-type").addEventListener("change", () => renderFinRevenue());
document.getElementById("fin-rev-group").addEventListener("change", () => renderFinRevenue());
document.querySelectorAll("[data-fin-goto]").forEach((btn) => {
  btn.addEventListener("click", () => go(btn.getAttribute("data-fin-goto")));
});

document.querySelectorAll(".cost-col").forEach((el) => { el.style.display = "none"; });
syncRoleMenus();
const bootHash = (location.hash || "").replace("#", "");
const adminBoot = bootHash === "admin-config" || bootHash === "admin-watch" || bootHash === "admin-progress";
const obsBoot = bootHash === "obs" || bootHash === "observatory";
const finBoot = FIN_PAGES.includes(bootHash) || obsBoot;
if (adminBoot) {
  state.role = "admin";
  document.getElementById("role-select").value = "admin";
  document.getElementById("user-chip").innerHTML = `<i class="fas fa-user"></i> ${roleMeta.admin.name}`;
  syncRoleMenus();
  go(bootHash === "admin-config" ? "admin-config" : "admin-watch");
} else if (finBoot) {
  const land = obsBoot ? "fin-overview" : bootHash;
  state.role = land === "fin-cash" || land === "fin-margin" ? "cfo" : "ceo";
  document.getElementById("role-select").value = state.role;
  document.getElementById("user-chip").innerHTML = `<i class="fas fa-user"></i> ${roleMeta[state.role].name}`;
  syncRoleMenus();
  go(land);
} else if (bootHash === "fill-cmp" || bootHash === "brand") go(bootHash);
else renderFill();

window.addEventListener("hashchange", () => {
  const h = (location.hash || "").replace("#", "");
  if (h === "obs" || h === "observatory") {
    if (!isExecRole(state.role)) {
      state.role = "ceo";
      document.getElementById("role-select").value = state.role;
      document.getElementById("user-chip").innerHTML = `<i class="fas fa-user"></i> ${roleMeta[state.role].name}`;
      syncRoleMenus();
    }
    go("fin-overview");
  } else if (FIN_PAGES.includes(h)) {
    if (!isExecRole(state.role)) {
      state.role = h === "fin-cash" || h === "fin-margin" ? "cfo" : "ceo";
      document.getElementById("role-select").value = state.role;
      document.getElementById("user-chip").innerHTML = `<i class="fas fa-user"></i> ${roleMeta[state.role].name}`;
      syncRoleMenus();
    }
    go(h);
  } else if (h === "fill-cmp" || h === "brand") go(h);
  else if (h === "admin-config" || h === "admin-watch" || h === "admin-progress") {
    if (state.role !== "admin") {
      state.role = "admin";
      document.getElementById("role-select").value = "admin";
      document.getElementById("user-chip").innerHTML = `<i class="fas fa-user"></i> ${roleMeta.admin.name}`;
      syncRoleMenus();
    }
    go(h === "admin-config" ? "admin-config" : "admin-watch");
  }
});
