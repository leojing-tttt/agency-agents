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

/** 部门负责人默认（来源：人事系统 HR 同步样例） */
const DEFAULT_DEPT_OWNERS = {
  营销一部: "周衡",
  营销二部: "陈予安",
  营销三部: "韩若溪",
  营销四部: "陆景明",
  营销五部: "苏念初",
  营销六部: "叶知秋",
  营销七部: "江澄",
  营销八部: "白叙",
  营销九部: "唐小满",
};

const DEPT_OWNER_STORAGE_KEY = "yecai-workhour-dept-owners-v1";
const DEPT_OWNER_DRAFT_KEY = "yecai-workhour-dept-owners-draft-v1";
const FILL_SCOPE_STORAGE_KEY = "yecai-workhour-fill-scope-v1";

/**
 * 公司组织架构 mock（多级部门树）
 * 字段对齐 A3 DepartmentDTO + getDeptTree：
 * - system/a3-expert-square-…/commons/dto/DepartmentDTO.java
 *   { name, departmentId, openDepartmentId, parentDepartmentId, leaderUserId, status, children }
 * - talent-lib API：GET /api/v1/sys/getDeptTree → BaseResponseResultListDepartmentDTO
 * Demo 将营销一部–九部挂在「营销中心」下，供财务勾选填报范围。
 */
function deptNode(name, departmentId, parentDepartmentId, children = [], leaderUserId = "") {
  return {
    name,
    departmentId,
    openDepartmentId: `od_${departmentId}`,
    parentDepartmentId: parentDepartmentId || "",
    leaderUserId: leaderUserId || "",
    status: 0,
    children,
  };
}

const ORG_DEPT_TREE = [
  deptNode("觉联集团", "root", "", [
    deptNode("营销中心", "mkt", "root", [
      deptNode("营销一部", "mkt_1", "mkt", [], "ou_zhouheng"),
      deptNode("营销二部", "mkt_2", "mkt", [], "ou_chenyuan"),
      deptNode("营销三部", "mkt_3", "mkt", [], "ou_hanruoxi"),
      deptNode("营销四部", "mkt_4", "mkt", [], "ou_lujingming"),
      deptNode("营销五部", "mkt_5", "mkt", [], "ou_sunianchu"),
      deptNode("营销六部", "mkt_6", "mkt", [], "ou_yezhiqiu"),
      deptNode("营销七部", "mkt_7", "mkt", [], "ou_jiangcheng"),
      deptNode("营销八部", "mkt_8", "mkt", [], "ou_baixu"),
      deptNode("营销九部", "mkt_9", "mkt", [], "ou_tangxiaoman"),
      deptNode("媒介策略组", "mkt_media", "mkt", [
        deptNode("媒介一组", "mkt_media_1", "mkt_media"),
        deptNode("媒介二组", "mkt_media_2", "mkt_media"),
      ]),
    ]),
    deptNode("产品与技术中心", "tech", "root", [
      deptNode("产品部", "tech_prod", "tech", [
        deptNode("产品设计组", "tech_prod_design", "tech_prod"),
        deptNode("产品运营组", "tech_prod_ops", "tech_prod"),
      ]),
      deptNode("技术部", "tech_eng", "tech", [
        deptNode("前端组", "tech_fe", "tech_eng"),
        deptNode("后端组", "tech_be", "tech_eng"),
      ]),
    ]),
    deptNode("职能中心", "fn", "root", [
      deptNode("财务部", "fn_fin", "fn"),
      deptNode("人事部", "fn_hr", "fn"),
      deptNode("行政部", "fn_admin", "fn"),
    ]),
  ]),
];

const DEFAULT_FILL_SCOPE_IDS = [
  "mkt_1", "mkt_2", "mkt_3", "mkt_4", "mkt_5",
  "mkt_6", "mkt_7", "mkt_8", "mkt_9",
  "mkt_media_1", "mkt_media_2",
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

/** 工时填报可选周：以 2026-W36（周一 09/01）为锚，生成可横滑的历史/近期周 */
function buildFillWeekOptions(startWeek = 20, endWeek = 44) {
  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (d) => `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
  const anchorMon = new Date(2026, 8, 1); // 2026-09-01 = W36 Mon
  const anchorWeek = 36;
  const out = [];
  for (let w = startWeek; w <= endWeek; w++) {
    const mon = new Date(anchorMon);
    mon.setDate(anchorMon.getDate() + (w - anchorWeek) * 7);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    out.push({
      id: `2026-W${pad(w)}`,
      short: `W${w}`,
      range: `${fmt(mon)}–${fmt(sun)}`,
      weekNum: w,
    });
  }
  return out;
}
const FILL_WEEK_OPTIONS = buildFillWeekOptions(20, 44);

/** 工时填报 mock：rows 含 group/brand/line/type/sub/pct，每周合计 100 */
const FILL_BY_WEEK = {
  "2026-W36": [
    { group: "营销一部", brand: "好奇", line: "小森林", type: "INTERNAL_KOL", sub: "KOL", pct: 40 },
    { group: "营销三部", brand: "高洁丝", line: "卫生巾", type: "HARD_AD", sub: "HARD_AD_PRICING", pct: 35 },
    { group: "营销五部", brand: "拜耳", line: "心肝宝", type: "GEO", sub: "", pct: 25 },
  ],
  "2026-W37": [
    { group: "营销一部", brand: "好奇", line: "深睡大师", type: "INTERNAL_DSP", sub: "INFLUENCER_PLATFORM_PAYMENT", pct: 50 },
    { group: "营销二部", brand: "好奇", line: "小桃裤", type: "INTERNAL_KOL", sub: "COMMON_KOL", pct: 30 },
  ],
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
  "2026-W40": [],
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

/** 基础报表种子行（按周展开为全年 mock） */
const BASIC_SEED = [
  { group: "营销一部", brand: "好奇", line: "小森林", type: "INTERNAL_KOL", days: 5.2, cost: 20800 },
  { group: "营销一部", brand: "好奇", line: "深睡大师", type: "INTERNAL_DSP", days: 2.1, cost: 8400 },
  { group: "营销一部", brand: "好奇", line: "屁屁面膜", type: "HARD_AD", days: 1.0, cost: 4000 },
  { group: "营销二部", brand: "好奇", line: "小桃裤", type: "INTERNAL_KOL", days: 2.0, cost: 8000 },
  { group: "营销二部", brand: "高洁丝", line: "蔓越莓益生力", type: "INTERNAL_DSP", days: 1.2, cost: 4800 },
  { group: "营销三部", brand: "高洁丝", line: "卫生巾", type: "HARD_AD", days: 3.5, cost: 17500 },
  { group: "营销三部", brand: "高洁丝", line: "海岛奢宠纯棉", type: "HARD_AD", days: 1.0, cost: 5000 },
  { group: "营销四部", brand: "高洁丝", line: "阳光烘烘抑菌纯棉", type: "INTERNAL_DSP", days: 1.6, cost: 8000 },
  { group: "营销四部", brand: "拜耳", line: "氨糖液体钙", type: "SELF_MEDIA", days: 0.8, cost: 3200 },
  { group: "营销五部", brand: "拜耳", line: "心肝宝", type: "GEO", days: 2.4, cost: 9600 },
  { group: "营销六部", brand: "拜耳", line: "时光片Pro", type: "SELF_MEDIA", days: 1.5, cost: 6000 },
  { group: "营销七部", brand: "康王", line: "酮康唑洗发水", type: "PUBLIC_OPINION", days: 2.8, cost: 11200 },
  { group: "营销八部", brand: "霞湖世家", line: "80支液氨棉T恤", type: "CUSTOMER_RELATIONSHIP", days: 1.0, cost: 4000 },
  { group: "营销八部", brand: "好奇", line: "小龙裤", type: "INTERNAL_KOL", days: 0.8, cost: 3200 },
  { group: "营销九部", brand: "霞湖世家", line: "120支液氨棉T恤", type: "OTHER", days: 1.5, cost: 6000 },
  { group: "营销九部", brand: "霞湖世家", line: "200支液氨棉T恤", type: "OTHER", days: 0.6, cost: 2400 },
];

/** 2026 ISO 周 → 月份（以该周周四所在月为准，便于年/月快捷筛选） */
function isoWeekMeta(year, week) {
  const pad = (n) => String(n).padStart(2, "0");
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay();
  const ISOweekStart = new Date(simple);
  ISOweekStart.setUTCDate(simple.getUTCDate() - ((dow + 6) % 7));
  const thu = new Date(ISOweekStart);
  thu.setUTCDate(ISOweekStart.getUTCDate() + 3);
  const month = thu.getUTCMonth() + 1;
  const mon = new Date(ISOweekStart);
  const sun = new Date(ISOweekStart);
  sun.setUTCDate(mon.getUTCDate() + 6);
  const fmt = (d) => `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}`;
  const id = `${year}-W${pad(week)}`;
  return {
    id,
    week,
    year,
    month,
    label: id,
    labelFull: `${id} · ${month}月 · ${fmt(mon)}–${fmt(sun)}`,
  };
}

const BASIC_PERIODS = Array.from({ length: 52 }, (_, i) => isoWeekMeta(2026, i + 1));

/** 全年按周展开：每周含种子行，人天/成本随周次略有波动，便于年/月合计演示 */
const BASIC_REPORT = BASIC_PERIODS.flatMap((p) =>
  BASIC_SEED.map((seed, si) => {
    const wave = 0.72 + ((p.week + si) % 7) * 0.06;
    const days = Math.round(seed.days * wave * 10) / 10;
    const cost = Math.round(seed.cost * wave);
    return {
      ...seed,
      period: p.id,
      periodLabel: p.label,
      periodFull: p.labelFull,
      year: p.year,
      month: p.month,
      week: p.week,
      days,
      cost,
    };
  }),
);

/** 基础报表人天下钻：填报人 + 占其本周工时%（mock，与行人天合计对齐） */
const BASIC_FILLERS = {
  "营销一部|好奇|小森林|INTERNAL_KOL": [
    { person: "林可", role: "媒介", days: 2.0, pctOfSelf: 40 },
    { person: "陈屿", role: "投放", days: 2.2, pctOfSelf: 55 },
    { person: "周衡", role: "策划", days: 1.0, pctOfSelf: 20 },
  ],
  "营销一部|好奇|深睡大师|INTERNAL_DSP": [
    { person: "苏晚", role: "投放", days: 1.4, pctOfSelf: 35 },
    { person: "林可", role: "媒介", days: 0.7, pctOfSelf: 15 },
  ],
  "营销一部|好奇|屁屁面膜|HARD_AD": [
    { person: "韩叙", role: "媒介", days: 0.6, pctOfSelf: 12 },
    { person: "陈屿", role: "投放", days: 0.4, pctOfSelf: 10 },
  ],
  "营销二部|好奇|小桃裤|INTERNAL_KOL": [
    { person: "陈予安", role: "媒介", days: 1.2, pctOfSelf: 30 },
    { person: "顾青", role: "投放", days: 0.8, pctOfSelf: 20 },
  ],
  "营销二部|高洁丝|蔓越莓益生力|INTERNAL_DSP": [
    { person: "顾青", role: "投放", days: 0.8, pctOfSelf: 20 },
    { person: "陈予安", role: "媒介", days: 0.4, pctOfSelf: 10 },
  ],
  "营销三部|高洁丝|卫生巾|HARD_AD": [
    { person: "韩若溪", role: "媒介", days: 1.5, pctOfSelf: 30 },
    { person: "陆泽", role: "投放", days: 1.5, pctOfSelf: 40 },
    { person: "沈知", role: "策划", days: 0.5, pctOfSelf: 10 },
  ],
  "营销三部|高洁丝|海岛奢宠纯棉|HARD_AD": [
    { person: "韩若溪", role: "媒介", days: 0.6, pctOfSelf: 12 },
    { person: "陆泽", role: "投放", days: 0.4, pctOfSelf: 10 },
  ],
  "营销四部|高洁丝|阳光烘烘抑菌纯棉|INTERNAL_DSP": [
    { person: "陆景明", role: "投放", days: 1.0, pctOfSelf: 25 },
    { person: "姜辞", role: "媒介", days: 0.6, pctOfSelf: 15 },
  ],
  "营销四部|拜耳|氨糖液体钙|SELF_MEDIA": [
    { person: "姜辞", role: "媒介", days: 0.5, pctOfSelf: 12 },
    { person: "陆景明", role: "投放", days: 0.3, pctOfSelf: 8 },
  ],
  "营销五部|拜耳|心肝宝|GEO": [
    { person: "苏念初", role: "媒介", days: 1.2, pctOfSelf: 30 },
    { person: "何远", role: "策划", days: 0.8, pctOfSelf: 20 },
    { person: "林可", role: "媒介", days: 0.4, pctOfSelf: 8 },
  ],
  "营销六部|拜耳|时光片Pro|SELF_MEDIA": [
    { person: "叶知秋", role: "媒介", days: 0.9, pctOfSelf: 22 },
    { person: "何远", role: "策划", days: 0.6, pctOfSelf: 15 },
  ],
  "营销七部|康王|酮康唑洗发水|PUBLIC_OPINION": [
    { person: "江澄", role: "媒介", days: 1.4, pctOfSelf: 35 },
    { person: "唐岚", role: "策划", days: 0.9, pctOfSelf: 22 },
    { person: "沈知", role: "策划", days: 0.5, pctOfSelf: 10 },
  ],
  "营销八部|霞湖世家|80支液氨棉T恤|CUSTOMER_RELATIONSHIP": [
    { person: "白叙", role: "媒介", days: 0.6, pctOfSelf: 15 },
    { person: "顾青", role: "投放", days: 0.4, pctOfSelf: 10 },
  ],
  "营销八部|好奇|小龙裤|INTERNAL_KOL": [
    { person: "白叙", role: "媒介", days: 0.5, pctOfSelf: 12 },
    { person: "陈屿", role: "投放", days: 0.3, pctOfSelf: 8 },
  ],
  "营销九部|霞湖世家|120支液氨棉T恤|OTHER": [
    { person: "唐小满", role: "策划", days: 0.9, pctOfSelf: 22 },
    { person: "白叙", role: "媒介", days: 0.6, pctOfSelf: 15 },
  ],
  "营销九部|霞湖世家|200支液氨棉T恤|OTHER": [
    { person: "唐小满", role: "策划", days: 0.4, pctOfSelf: 10 },
    { person: "沈知", role: "策划", days: 0.2, pctOfSelf: 5 },
  ],
};

function basicRowKey(r) {
  return `${r.group}|${r.brand}|${r.line}|${r.type}`;
}

function fillersForBasicRow(r) {
  const key = basicRowKey(r);
  if (BASIC_FILLERS[key]) return BASIC_FILLERS[key];
  /* fallback：按人天拆两人，保证抽屉有内容 */
  const a = Math.round(r.days * 0.6 * 10) / 10;
  const b = Math.round((r.days - a) * 10) / 10;
  return [
    { person: "林可", role: "媒介", days: a, pctOfSelf: Math.min(80, Math.round(a * 20)) },
    { person: "陈屿", role: "投放", days: b, pctOfSelf: Math.min(80, Math.round(b * 20)) },
  ].filter((x) => x.days > 0);
}

const TITLES = {
  fill: "工时填报",
  review: "部门审核",
  leader: "部门审核",
  config: "部门负责人",
  "fill-scope": "填报范围",
  basic: "基础报表",
  project: "项目人力",
  brand: "基础报表",
  "fin-overview": "今日总览",
  "fin-revenue": "收入与贡献",
  "fin-cash": "回款与现金",
  "fin-margin": "成本与毛利",
  "admin-config": "配置面板",
  "admin-watch": "填报进度面板",
  master: "主数据来源",
};

const CFG_PAGES = ["config", "fill-scope"];

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
const THEME_KEY = "yecai-theme-v1";

function currentTheme() {
  const t = document.documentElement.getAttribute("data-yc-theme");
  return t === "warm" ? "warm" : "cool";
}

function syncThemeControls() {
  const t = currentTheme();
  document.querySelectorAll(".yc-theme-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-yc-theme") === t);
  });
}

function setTheme(next) {
  const t = next === "warm" ? "warm" : "cool";
  document.documentElement.setAttribute("data-yc-theme", t);
  try { localStorage.setItem(THEME_KEY, t); } catch (_) { /* ignore */ }
  syncThemeControls();
  const active = document.querySelector(".page.active");
  const page = active ? active.id.replace(/^page-/, "") : "";
  if (page && typeof go === "function") go(page);
}

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

function defaultDeptOwners() {
  const out = {};
  GROUPS.forEach((g) => {
    out[g] = DEFAULT_DEPT_OWNERS[g] || "—";
  });
  return out;
}

function normalizeDeptOwners(raw) {
  const base = defaultDeptOwners();
  if (!raw || typeof raw !== "object") return { owners: base, savedAt: null, source: "hr" };
  const owners = { ...base };
  GROUPS.forEach((g) => {
    if (typeof raw.owners?.[g] === "string" && raw.owners[g].trim()) owners[g] = raw.owners[g].trim();
    else if (typeof raw[g] === "string" && raw[g].trim()) owners[g] = raw[g].trim();
  });
  return {
    owners,
    savedAt: raw.savedAt || null,
    source: raw.source === "local" ? "local" : "hr",
  };
}

function loadDeptOwners() {
  try {
    const draft = localStorage.getItem(DEPT_OWNER_DRAFT_KEY);
    if (draft) {
      const parsed = normalizeDeptOwners(JSON.parse(draft));
      parsed.fromDraft = true;
      return parsed;
    }
  } catch (_) { /* ignore */ }
  try {
    const raw = localStorage.getItem(DEPT_OWNER_STORAGE_KEY);
    if (raw) return normalizeDeptOwners(JSON.parse(raw));
  } catch (_) { /* ignore */ }
  return normalizeDeptOwners(null);
}

function ownerOf(group) {
  return (state.deptOwners?.owners && state.deptOwners.owners[group]) || DEFAULT_DEPT_OWNERS[group] || "—";
}

function walkOrgTree(nodes, visit) {
  (nodes || []).forEach((n) => {
    visit(n);
    if (n.children && n.children.length) walkOrgTree(n.children, visit);
  });
}

function collectOrgIds(nodes) {
  const ids = [];
  walkOrgTree(nodes, (n) => {
    if (n.departmentId) ids.push(n.departmentId);
  });
  return ids;
}

function findOrgNode(nodes, id) {
  let found = null;
  walkOrgTree(nodes, (n) => {
    if (!found && n.departmentId === id) found = n;
  });
  return found;
}

function defaultFillScope() {
  return {
    selectedIds: DEFAULT_FILL_SCOPE_IDS.slice(),
    leaderMustFill: true,
    savedAt: null,
    source: "org",
  };
}

function normalizeFillScope(raw) {
  const base = defaultFillScope();
  if (!raw || typeof raw !== "object") return base;
  const all = new Set(collectOrgIds(ORG_DEPT_TREE));
  const selectedIds = Array.isArray(raw.selectedIds)
    ? raw.selectedIds.filter((id) => typeof id === "string" && all.has(id))
    : base.selectedIds.slice();
  return {
    selectedIds,
    leaderMustFill: raw.leaderMustFill !== false,
    savedAt: raw.savedAt || null,
    source: raw.source === "local" ? "local" : "org",
  };
}

function loadFillScope() {
  try {
    const raw = localStorage.getItem(FILL_SCOPE_STORAGE_KEY);
    if (raw) return normalizeFillScope(JSON.parse(raw));
  } catch (_) { /* ignore */ }
  return defaultFillScope();
}

function canConfigRole(role) {
  return role === "finance" || role === "admin" || role === "cfo";
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
  return (FILL_BY_WEEK[week] || []).map((r) => ({ ...r }));
}

function weekMeta(weekId) {
  return FILL_WEEK_OPTIONS.find((w) => w.id === weekId) || { id: weekId, short: weekId, range: "—" };
}

function weekNumOf(weekId) {
  const m = /^2026-W(\d+)$/.exec(weekId);
  return m ? Number(m[1]) : 0;
}

function weekFillStatus(weekId) {
  const hist = state.history.find((h) => h.week === weekId);
  if (hist?.status === "locked" || weekId === "2026-W38") return "locked";
  if (hist?.status === "submitted") return "submitted";
  /* 演示用历史样例：更早周有锁定/已提交，便于左右滑动查看 */
  const n = weekNumOf(weekId);
  if (n >= 20 && n <= 29) return "locked";
  if (n >= 30 && n <= 35) return "submitted";
  if (state.draftWeeks && state.draftWeeks.has(weekId)) return "draft";
  if (weekId === state.week) {
    if (state.rows.length && sumPct(state.rows) > 0) return "draft";
    return "empty";
  }
  const rows = FILL_BY_WEEK[weekId] || [];
  if (rows.length && sumPct(rows) > 0) return "draft";
  return "empty";
}

const WEEK_STATUS_LABEL = {
  empty: "未填",
  draft: "暂存",
  submitted: "已提交",
  locked: "已锁定",
};

function selectFillWeek(weekId, { force } = {}) {
  if (!FILL_WEEK_OPTIONS.some((w) => w.id === weekId)) return;
  if (!force && weekId === state.week) return;
  FILL_BY_WEEK[state.week] = state.rows.map((r) => ({ ...r }));
  state.week = weekId;
  state.rows = cloneRows(weekId);
  const status = weekFillStatus(weekId);
  state.locked = status === "locked";
  state.submitted = status === "submitted" || status === "locked";
  renderFill();
}

function scrollFillWeekStrip(dir) {
  const strip = document.getElementById("fill-week-strip");
  if (!strip) return;
  const step = Math.max(240, Math.floor(strip.clientWidth * 0.75));
  strip.scrollBy({ left: dir * step, behavior: "smooth" });
}

function syncFillWeekNav() {
  const strip = document.getElementById("fill-week-strip");
  const prev = document.getElementById("fill-week-prev");
  const next = document.getElementById("fill-week-next");
  if (!strip || !prev || !next) return;
  const max = strip.scrollWidth - strip.clientWidth - 2;
  prev.disabled = strip.scrollLeft <= 2;
  next.disabled = strip.scrollLeft >= max;
}

function scrollActiveWeekIntoView({ smooth } = {}) {
  const strip = document.getElementById("fill-week-strip");
  const active = strip && strip.querySelector(".yc-week-chip.is-active");
  if (!strip || !active) return;
  const left = active.offsetLeft - (strip.clientWidth - active.offsetWidth) / 2;
  strip.scrollTo({ left: Math.max(0, left), behavior: smooth ? "smooth" : "auto" });
  syncFillWeekNav();
}

function renderFillWeekStrip() {
  const strip = document.getElementById("fill-week-strip");
  const current = document.getElementById("fill-week-current");
  if (!strip) return;
  const meta = weekMeta(state.week);
  if (current) current.textContent = `${state.week} · ${meta.range}`;
  const keepScroll = strip.scrollLeft;
  strip.innerHTML = FILL_WEEK_OPTIONS.map((w) => {
    const status = weekFillStatus(w.id);
    const active = w.id === state.week ? " is-active" : "";
    return `
      <button type="button" class="yc-week-chip status-${status}${active}" role="option" aria-selected="${w.id === state.week}" data-week="${w.id}" title="${w.id} ${w.range} · ${WEEK_STATUS_LABEL[status]}">
        <span class="yc-week-chip-top">
          <strong>${w.short}</strong>
          <i class="yc-week-dot is-${status}" aria-hidden="true"></i>
        </span>
        <span class="yc-week-chip-range">${w.range}</span>
        <span class="yc-week-chip-status">${WEEK_STATUS_LABEL[status]}</span>
      </button>
    `;
  }).join("");
  strip.querySelectorAll("[data-week]").forEach((btn) => {
    btn.addEventListener("click", () => selectFillWeek(btn.getAttribute("data-week")));
  });
  if (!strip.dataset.navBound) {
    strip.dataset.navBound = "1";
    strip.addEventListener("scroll", () => syncFillWeekNav(), { passive: true });
    document.getElementById("fill-week-prev")?.addEventListener("click", () => scrollFillWeekStrip(-1));
    document.getElementById("fill-week-next")?.addEventListener("click", () => scrollFillWeekStrip(1));
  }
  requestAnimationFrame(() => {
    if (keepScroll > 0) strip.scrollLeft = keepScroll;
    scrollActiveWeekIntoView({ smooth: false });
  });
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
  draftWeeks: new Set(["2026-W37"]),
  history: [
    { week: "2026-W36", status: "submitted", rows: cloneRows("2026-W36") },
    { week: "2026-W38", status: "locked", rows: cloneRows("2026-W38") },
    { week: "2026-W39", status: "submitted", rows: cloneRows("2026-W39") },
  ],
  adminConfig: loadAdminConfig(),
  adminDraftMeta: null,
  deptOwners: loadDeptOwners(),
  fillScope: loadFillScope(),
  fillScopeCollapsed: {},
  watchWeek: "2026-W39",
  reviewWeek: "2026-W39",
  reviewTab: "audit",
  /** 部门审核：personKey → pending|confirmed|rejected */
  reviewStatus: {},
  /** 工时分配：week → { status: draft|confirmed, ratios: {sourceKey|project|order: pct} } */
  allocByWeek: {},
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
  owner: { name: "韩叙 · 业务一号位", showCost: false, fin: false },
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
  const canCfg = canConfigRole(state.role);
  document.body.classList.toggle("yc-role-admin", isAdmin);
  document.body.classList.toggle("yc-role-fin", canFin);
  document.body.classList.toggle("yc-role-cfg", canCfg);
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
  } else if (CFG_PAGES.includes(page)) {
    crumbs.innerHTML = `
      <span class="a3-breadcrumb-item"><a>配置</a></span>
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
  if (page === "brand") page = "basic";
  if (page === "leader" || page === "mine") page = "review";
  if (page === "review-alloc") {
    page = "review";
    state.reviewTab = "alloc";
  }
  if ((page === "admin-config" || page === "admin-watch") && state.role !== "admin") {
    toast("warning", "请先切换为管理员身份");
    page = "fill";
  }
  if (CFG_PAGES.includes(page) && !canConfigRole(state.role)) {
    toast("warning", "请切换为财务 / 管理员后进入配置");
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
  if (page === "review") renderReview();
  if (page === "config") renderDeptOwnerConfig();
  if (page === "fill-scope") renderFillScope();
  if (page === "basic") renderBasic();
  if (page === "project") renderProject();
  if (page === "fin-overview") renderFinOverview();
  if (page === "fin-revenue") renderFinRevenue();
  if (page === "fin-cash") renderFinCash();
  if (page === "fin-margin") renderFinMargin();
  if (page === "admin-config") renderAdminConfig();
  if (page === "admin-watch") renderAdminWatch();
  if (page === "master") renderMaster();
  const pageHashes = {
    fill: "fill",
    config: "config",
    "fill-scope": "fill-scope",
    basic: "basic",
    review: state.reviewTab === "alloc" ? "review-alloc" : "review",
    "admin-config": "admin-config",
    "admin-watch": "admin-progress",
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

document.querySelectorAll(".yc-theme-btn").forEach((btn) => {
  btn.addEventListener("click", () => setTheme(btn.getAttribute("data-yc-theme")));
});
syncThemeControls();

document.getElementById("obs-entry")?.addEventListener("click", () => {
  if (!isExecRole(state.role)) {
    state.role = "ceo";
    document.getElementById("role-select").value = "ceo";
    document.getElementById("user-chip").innerHTML = `<i class="fas fa-user"></i> ${roleMeta.ceo.name}`;
    syncRoleMenus();
    toast("info", "已切换为 CEO 演示身份，进入观测台");
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
  const onCfgPage = CFG_PAGES.includes(activePage);
  const onFinPage = FIN_PAGES.includes(activePage);
  /* CEO / CFO 打开观测台 → 一律落在 elevated 总览 */
  if (state.role === "ceo") go("fin-overview");
  else if (state.role === "cfo") go(onCfgPage ? activePage : "fin-overview");
  else if (state.role === "finance") go(onCfgPage ? activePage : "fin-overview");
  else if (state.role === "admin") go(onAdminPage || onCfgPage ? activePage : "admin-config");
  else if (state.role === "leader") {
    state.reviewTab = "audit";
    go("review");
  } else if (state.role === "owner") {
    state.reviewTab = "alloc";
    go("review");
  } else if (onAdminPage || onCfgPage || (onFinPage && !isExecRole(state.role))) go("fill");
  else go(activePage || "fill");
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
        if (rerender === renderFill) {
          updateFillSum();
          renderFillWeekStrip();
        }
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
  renderFillWeekStrip();
  const root = document.getElementById("fill-sections");
  const locked = state.locked;
  const addDeptBtn = document.getElementById("add-dept");
  const saveBtn = document.getElementById("save-draft");
  const submitBtn = document.getElementById("submit-fill");
  if (addDeptBtn) addDeptBtn.disabled = locked;
  if (saveBtn) saveBtn.disabled = locked;
  if (submitBtn) submitBtn.disabled = locked;
  const groups = groupsInOrder(state.rows);
  if (!groups.length) {
    root.innerHTML = locked
      ? `<div class="a3-empty"><i class="fas fa-lock"></i><div class="a3-empty-text">该周已锁定，仅可查看</div></div>`
      : `<div class="a3-empty"><i class="fas fa-inbox"></i><div class="a3-empty-text">暂无营销部，请点击「添加营销部」</div></div>`;
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

function closeAddDeptModal() {
  const mask = document.getElementById("add-dept-modal");
  if (!mask) return;
  mask.classList.remove("show");
  mask.setAttribute("aria-hidden", "true");
}

function syncAddDeptConfirmLabel() {
  const confirmBtn = document.getElementById("add-dept-confirm");
  if (!confirmBtn) return;
  const n = document.querySelectorAll('input[name="add-dept-pick"]:checked:not(:disabled)').length;
  confirmBtn.disabled = n === 0;
  confirmBtn.innerHTML =
    n > 0
      ? `<i class="fas fa-plus"></i> 添加所选部门（${n}）`
      : `<i class="fas fa-plus"></i> 添加所选部门`;
}

function openAddDeptModal() {
  if (state.locked) return toast("warning", "该周已锁定，不可添加营销部");
  const mask = document.getElementById("add-dept-modal");
  const list = document.getElementById("add-dept-options");
  if (!mask || !list) return;
  const used = new Set(state.rows.map((r) => r.group).filter(Boolean));
  list.innerHTML = GROUPS.map((g) => {
    const added = used.has(g);
    return `
      <label class="yc-dept-pick${added ? " is-added" : ""}">
        <input type="checkbox" name="add-dept-pick" value="${g}" ${added ? "disabled" : ""} />
        <span class="yc-dept-pick-main">
          <span class="yc-dept-pick-title">
            <strong>${g}</strong>
            ${added ? '<span class="yc-dept-pick-badge">已添加</span>' : ""}
          </span>
          <span class="yc-dept-pick-owner">负责人 · ${ownerOf(g)}</span>
        </span>
      </label>`;
  }).join("");
  list.querySelectorAll('input[name="add-dept-pick"]').forEach((el) => {
    el.addEventListener("change", () => {
      const label = el.closest(".yc-dept-pick");
      if (label && !label.classList.contains("is-added")) {
        label.classList.toggle("is-checked", el.checked);
      }
      syncAddDeptConfirmLabel();
    });
  });
  syncAddDeptConfirmLabel();
  mask.classList.add("show");
  mask.setAttribute("aria-hidden", "false");
}

function confirmAddDeptFromModal() {
  const picked = [...document.querySelectorAll('input[name="add-dept-pick"]:checked:not(:disabled)')].map(
    (el) => el.value,
  );
  if (!picked.length) return toast("warning", "请至少选择一个营销部");
  const used = new Set(state.rows.map((r) => r.group).filter(Boolean));
  const toAdd = picked.filter((g) => !used.has(g));
  if (!toAdd.length) return toast("warning", "所选部门均已添加");
  toAdd.forEach((g) => state.rows.push(emptyRow(g)));
  closeAddDeptModal();
  renderFill();
  const names = toAdd.map((g) => `${g}（${ownerOf(g)}）`).join("、");
  toast("success", `已添加 ${toAdd.length} 个部门：${names}`);
}

document.getElementById("add-dept").addEventListener("click", () => openAddDeptModal());
document.getElementById("add-dept-confirm")?.addEventListener("click", () => confirmAddDeptFromModal());
document.getElementById("add-dept-cancel")?.addEventListener("click", () => closeAddDeptModal());
document.getElementById("add-dept-modal-close")?.addEventListener("click", () => closeAddDeptModal());
document.getElementById("add-dept-modal")?.addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeAddDeptModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.getElementById("add-dept-modal")?.classList.contains("show")) {
    closeAddDeptModal();
  }
});

document.getElementById("save-draft").addEventListener("click", () => {
  if (state.locked) return toast("warning", "该周已锁定，不可暂存");
  FILL_BY_WEEK[state.week] = state.rows.map((r) => ({ ...r }));
  state.draftWeeks.add(state.week);
  state.submitted = false;
  renderFillWeekStrip();
  toast("info", "已暂存");
});
document.getElementById("submit-fill").addEventListener("click", () => {
  if (state.locked) return toast("warning", "该周已锁定，不可再次提交");
  if (!state.rows.length) return toast("warning", "请至少添加一行");
  const incomplete = state.rows.some((r) => !r.group || !r.brand || !r.line || !r.type);
  if (incomplete) return toast("warning", "请完善业务组、品牌品线与执行单类型");
  const needSub = state.rows.some((r) => (EXECUTE_SUBTYPES[r.type] || []).length && !r.sub);
  if (needSub) return toast("warning", "请选择执行单子类型");
  const total = sumPct(state.rows);
  if (Math.abs(total - 100) >= 0.05) return toast("warning", `本周占比合计须为 100%，当前为 ${total}%`);
  state.submitted = true;
  state.locked = false;
  state.draftWeeks.delete(state.week);
  FILL_BY_WEEK[state.week] = state.rows.map((r) => ({ ...r }));
  syncHistoryCurrentWeek();
  renderFillWeekStrip();
  toast("success", "已提交，待部门 Leader 审核确认后生效");
});

function reviewPersonKey(week, person, brand, line, type) {
  return `${week}|${person}|${brand}|${line}|${type}`;
}

function sourceKey(brand, line, type) {
  return `${brand}|${line}|${type}`;
}

/** 本组按周填报人列表（mock：林可 + W39 额外成员） */
function buildReviewPeople(week) {
  const rows = (FILL_BY_WEEK[week] || []).filter((r) => r.group === LEADER_GROUP);
  const people = [];
  rows.forEach((r) => {
    people.push({
      person: "林可",
      role: "媒介",
      brand: r.brand,
      line: r.line,
      type: r.type,
      sub: r.sub,
      pct: r.pct,
    });
  });
  if (week === "2026-W39") {
    TEAM_DEPT1_EXTRAS.forEach((m) => {
      people.push({
        person: m.person,
        role: m.person === "陈屿" ? "投放" : "投放",
        brand: m.brand,
        line: m.line,
        type: m.type,
        sub: m.sub,
        pct: m.filled,
      });
    });
  }
  return people.map((p) => {
    const key = reviewPersonKey(week, p.person, p.brand, p.line, p.type);
    const st = state.reviewStatus[key] || "pending";
    return { ...p, key, status: st };
  });
}

function reviewStatusTag(st) {
  if (st === "confirmed") return '<span class="a3-tag a3-tag-success"><span class="a3-tag-dot"></span>已确认生效</span>';
  if (st === "rejected") return '<span class="a3-tag a3-tag-danger"><span class="a3-tag-dot"></span>已驳回</span>';
  return '<span class="a3-tag a3-tag-warning"><span class="a3-tag-dot"></span>待审核</span>';
}

function weekReviewEffective(week) {
  const people = buildReviewPeople(week);
  if (!people.length) return false;
  return people.every((p) => p.status === "confirmed");
}

function ensureReviewWeekSelects() {
  ["review-week", "alloc-week"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el || el.options.length) return;
    const weeks = ["2026-W36", "2026-W37", "2026-W38", "2026-W39", "2026-W40"];
    weeks.forEach((w) => {
      const o = document.createElement("option");
      o.value = w;
      o.textContent = w;
      el.appendChild(o);
    });
  });
  const rw = document.getElementById("review-week");
  const aw = document.getElementById("alloc-week");
  if (rw) rw.value = state.reviewWeek;
  if (aw) aw.value = state.reviewWeek;
}

function setReviewTab(tab) {
  state.reviewTab = tab === "alloc" ? "alloc" : "audit";
  document.querySelectorAll("[data-review-tab]").forEach((btn) => {
    const on = btn.getAttribute("data-review-tab") === state.reviewTab;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  const audit = document.getElementById("review-tab-audit");
  const alloc = document.getElementById("review-tab-alloc");
  if (audit) audit.style.display = state.reviewTab === "audit" ? "block" : "none";
  if (alloc) alloc.style.display = state.reviewTab === "alloc" ? "block" : "none";
  const want = state.reviewTab === "alloc" ? "review-alloc" : "review";
  if ((location.hash || "").replace("#", "") !== want) {
    history.replaceState(null, "", "#" + want);
  }
}

function syncWeekEffectiveFlag(week) {
  const effective = weekReviewEffective(week);
  if (week === state.week) {
    state.locked = effective;
    state.submitted = true;
  }
  const hist = state.history.find((h) => h.week === week);
  if (hist) hist.status = effective ? "locked" : "submitted";
  else if (effective) {
    state.history.push({ week, status: "locked", rows: cloneRows(week) });
  }
  renderFillWeekStrip();
}

function renderReviewAudit() {
  const canLead = state.role === "leader";
  const gate = document.getElementById("review-gate");
  const body = document.getElementById("review-audit-body");
  if (gate) gate.style.display = canLead ? "none" : "flex";
  if (body) body.style.display = canLead ? "block" : "none";
  if (!canLead) return;

  ensureReviewWeekSelects();
  const week = state.reviewWeek;
  const people = buildReviewPeople(week);
  const pending = people.filter((p) => p.status === "pending").length;
  const ok = people.filter((p) => p.status === "confirmed").length;
  const rej = people.filter((p) => p.status === "rejected").length;
  document.getElementById("review-pending-n").textContent = String(pending);
  document.getElementById("review-ok-n").textContent = String(ok);
  document.getElementById("review-reject-n").textContent = String(rej);
  const effective = people.length > 0 && pending === 0 && rej === 0 && ok === people.length;
  document.getElementById("review-week-status").innerHTML = effective
    ? '<span class="a3-tag a3-tag-success"><span class="a3-tag-dot"></span>已全部确认生效</span>'
    : rej
      ? '<span class="a3-tag a3-tag-danger"><span class="a3-tag-dot"></span>含驳回</span>'
      : '<span class="a3-tag a3-tag-warning"><span class="a3-tag-dot"></span>待确认</span>';

  const tbody = document.querySelector("#review-table tbody");
  tbody.innerHTML = people.length
    ? people
        .map((p) => {
          const typeLabel = `${EXECUTE_LABEL[p.type] || p.type}${p.sub ? " / " + subLabel(p.type, p.sub) : ""}`;
          const ops =
            p.status === "pending"
              ? `<button type="button" class="a3-btn a3-btn-success a3-btn-sm" data-review-ok="${p.key}">确认</button>
                 <button type="button" class="a3-btn a3-btn-default a3-btn-sm" data-review-reject="${p.key}">驳回</button>`
              : p.status === "confirmed"
                ? `<span class="a3-text-secondary">已生效</span>`
                : `<button type="button" class="a3-btn a3-btn-default a3-btn-sm" data-review-reset="${p.key}">重新待审</button>`;
          return `<tr>
            <td>${p.person}</td><td>${p.role}</td>
            <td>${p.brand} / ${p.line}</td><td>${typeLabel}</td><td>${p.pct}%</td>
            <td>${reviewStatusTag(p.status)}</td>
            <td><div class="a3-flex" style="gap:6px;flex-wrap:wrap">${ops}</div></td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="7"><div class="a3-table-empty">本周本组暂无填报</div></td></tr>`;

  tbody.querySelectorAll("[data-review-ok]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.reviewStatus[btn.getAttribute("data-review-ok")] = "confirmed";
      syncWeekEffectiveFlag(week);
      toast("success", "已确认，该笔填报生效");
      renderReview();
    });
  });
  tbody.querySelectorAll("[data-review-reject]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.reviewStatus[btn.getAttribute("data-review-reject")] = "rejected";
      syncWeekEffectiveFlag(week);
      toast("warning", "已驳回，填报未生效");
      renderReview();
    });
  });
  tbody.querySelectorAll("[data-review-reset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.reviewStatus[btn.getAttribute("data-review-reset")] = "pending";
      syncWeekEffectiveFlag(week);
      renderReview();
    });
  });

  const allBtn = document.getElementById("review-confirm-all");
  if (allBtn) {
    allBtn.disabled = !people.length || effective;
    allBtn.onclick = () => {
      people.forEach((p) => {
        state.reviewStatus[p.key] = "confirmed";
      });
      syncWeekEffectiveFlag(week);
      toast("success", "本组本周填报已全部确认生效");
      renderReview();
    };
  }
}

/** 上一 ISO 周 id（用于「上周支出比例」参考） */
function prevIsoWeekId(weekId) {
  const m = /^(\d{4})-W(\d+)$/.exec(weekId || "");
  if (!m) return "";
  const year = Number(m[1]);
  let week = Number(m[2]) - 1;
  if (week < 1) return `${year - 1}-W52`;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/**
 * 上周各执行单/项目支出占比（只读参考，同来源合计 100）。
 * Demo：以 SPLIT_CATALOG 权重为基线，按上周周号微调，再归一到 100。
 */
function lastWeekSpendRatios(week, brand, line, type) {
  const prev = prevIsoWeekId(week);
  const prevWeekNum = Number((/^(\d{4})-W(\d+)$/.exec(prev) || [])[2]) || 1;
  const parts = SPLIT_CATALOG[sourceKey(brand, line, type)] || [{ project: "待匹配项目", order: "—", w: 1 }];
  const raw = parts.map((part, i) => {
    const wave = 0.85 + ((prevWeekNum + i) % 5) * 0.04;
    return { ...part, raw: part.w * wave };
  });
  const sum = raw.reduce((s, x) => s + x.raw, 0) || 1;
  let acc = 0;
  return raw.map((x, i) => {
    let pct = Math.round((x.raw / sum) * 100);
    if (i === raw.length - 1) pct = Math.max(0, 100 - acc);
    acc += pct;
    return { project: x.project, order: x.order, spendPct: pct };
  });
}

function readAllocShareInputs() {
  const shares = {};
  document.querySelectorAll("[data-alloc-share]").forEach((el) => {
    shares[el.getAttribute("data-alloc-share")] = Number(el.value) || 0;
  });
  return shares;
}

/** 同来源「上周分摊占比」合计校验；返回 { ok, bySrc } */
function validateAllocShares(shares) {
  const bySrc = {};
  Object.keys(shares).forEach((rk) => {
    const src = rk.split("|").slice(0, 3).join("|");
    bySrc[src] = (bySrc[src] || 0) + shares[rk];
  });
  const bad = Object.entries(bySrc).filter(([, v]) => Math.abs(v - 100) > 0.5);
  return { ok: !bad.length, bySrc, bad };
}

function buildAllocRows(week) {
  const people = buildReviewPeople(week).filter((p) => p.status === "confirmed");
  const bySource = new Map();
  people.forEach((p) => {
    const sk = sourceKey(p.brand, p.line, p.type);
    const cur = bySource.get(sk) || { brand: p.brand, line: p.line, type: p.type, pct: 0 };
    cur.pct += p.pct;
    bySource.set(sk, cur);
  });
  const bag = state.allocByWeek[week] || { status: "draft", shares: {} };
  const shareBag = bag.shares || bag.ratios || {};
  const rows = [];
  bySource.forEach((src) => {
    const spendParts = lastWeekSpendRatios(week, src.brand, src.line, src.type);
    spendParts.forEach((part) => {
      const rk = `${sourceKey(src.brand, src.line, src.type)}|${part.project}|${part.order}`;
      const sharePct = shareBag[rk] != null ? shareBag[rk] : part.spendPct;
      rows.push({
        brand: src.brand,
        line: src.line,
        type: src.type,
        filledPct: src.pct,
        project: part.project,
        order: part.order,
        ratioKey: rk,
        spendPct: part.spendPct,
        sharePct,
        allocPct: Math.round((src.pct * sharePct) / 1000) / 10,
        prevWeek: prevIsoWeekId(week),
      });
    });
  });
  return { rows, status: bag.status || "draft", prevWeek: prevIsoWeekId(week) };
}

function renderReviewAlloc() {
  ensureReviewWeekSelects();
  const week = state.reviewWeek;
  const isOwner = state.role === "owner";
  const isLeader = state.role === "leader";
  const gate = document.getElementById("alloc-gate-text");
  if (gate) {
    if (isOwner) gate.textContent = "当前为业务一号位：核对上周分摊占比后确认锁定（用于拆本周填报）。上周支出比例仅供参考。";
    else if (isLeader) gate.textContent = "当前为部门 Leader：可编辑上周分摊占比（默认=上周支出比例，同属上期）；确认需业务一号位。";
    else gate.textContent = "请切换为「部门 Leader」编辑上周分摊占比，或「业务一号位」确认分配。";
  }

  const { rows, status, prevWeek } = buildAllocRows(week);
  const effective = weekReviewEffective(week);
  document.getElementById("alloc-status-line").innerHTML =
    status === "confirmed"
      ? '<span class="a3-tag a3-tag-success"><span class="a3-tag-dot"></span>一号位已确认</span>'
      : effective
        ? '<span class="a3-tag a3-tag-warning"><span class="a3-tag-dot"></span>待一号位确认</span>'
        : '<span class="a3-tag a3-tag-default"><span class="a3-tag-dot"></span>需先完成部门审核</span>';
  document.getElementById("alloc-meta").textContent = effective
    ? status === "confirmed"
      ? "分配已锁定"
      : `参考周 ${prevWeek || "—"}：支出比例只读；编辑上周分摊占比（合计须 100%），用于拆本周填报`
    : "需先在「部门审核」确认填报人生效后，才能分配到项目";

  const editable = effective && status !== "confirmed" && (isLeader || isOwner);
  const tbody = document.querySelector("#alloc-table tbody");
  tbody.innerHTML = rows.length
    ? rows
        .map((r) => {
          const typeLabel = EXECUTE_LABEL[r.type] || r.type;
          const shareDisabled = editable ? "" : "disabled";
          return `<tr>
          <td>${r.brand} / ${r.line}<div class="a3-text-secondary" style="font-size:12px">${typeLabel}</div></td>
          <td>${r.filledPct}%</td>
          <td>${r.project}</td>
          <td>${r.order}</td>
          <td title="参考 ${r.prevWeek} 支出占比（只读）"><span class="a3-text-secondary">${r.spendPct}%</span></td>
          <td><div class="a3-input-wrapper" style="max-width:100px">
            <input class="a3-input" type="number" min="0" max="100" step="1" value="${r.sharePct}" data-alloc-share="${r.ratioKey}" ${shareDisabled} />
          </div></td>
          <td><b class="a3-text-primary" data-alloc-result="${r.ratioKey}">${r.allocPct}%</b></td>
        </tr>`;
        })
        .join("")
    : `<tr><td colspan="7"><div class="a3-table-empty">${effective ? "无已确认填报可分配" : "请先完成部门审核确认"}</div></td></tr>`;

  const warnEl = document.getElementById("alloc-sum-warn");
  const refreshShareWarn = () => {
    const shares = readAllocShareInputs();
    const { ok, bad, bySrc } = validateAllocShares(shares);
    rows.forEach((r) => {
      const el = document.querySelector(`[data-alloc-result="${r.ratioKey}"]`);
      if (!el) return;
      const share = shares[r.ratioKey] != null ? shares[r.ratioKey] : r.sharePct;
      el.textContent = `${Math.round((r.filledPct * share) / 1000) / 10}%`;
    });
    if (!warnEl) return;
    if (!rows.length) {
      warnEl.textContent = "";
      return;
    }
    if (ok) {
      warnEl.innerHTML = `<span class="a3-text-secondary">上周分摊占比校验通过（各来源合计 100%）。上周支出比例合计亦为 100%（参考周 ${prevWeek || "—"}）。</span>`;
    } else {
      const detail = bad.map(([src, v]) => `${src} → ${v}%`).join("；");
      warnEl.innerHTML = `<span style="color:var(--a3-warning)">警告：上周分摊占比未凑满 100%（${detail}）。仍可保存草稿；一号位确认前请改到 100%。</span>`;
    }
  };
  tbody.querySelectorAll("[data-alloc-share]").forEach((el) => {
    el.addEventListener("input", () => refreshShareWarn());
  });
  refreshShareWarn();

  const saveBtn = document.getElementById("alloc-save");
  const confBtn = document.getElementById("alloc-confirm");
  if (saveBtn) {
    saveBtn.disabled = !effective || status === "confirmed" || (!isLeader && !isOwner);
    saveBtn.onclick = () => {
      const shares = readAllocShareInputs();
      const { ok, bad } = validateAllocShares(shares);
      state.allocByWeek[week] = { status: "draft", shares };
      if (!ok) {
        const detail = bad.map(([src, v]) => `${src}=${v}%`).join("，");
        toast("warning", `已保存草稿，但分摊占比未达 100%：${detail}`);
      } else {
        toast("info", "上周分摊占比已保存（草稿）");
      }
      renderReviewAlloc();
    };
  }
  if (confBtn) {
    confBtn.disabled = !effective || status === "confirmed" || !isOwner;
    confBtn.onclick = () => {
      if (!isOwner) return toast("warning", "请切换为业务一号位后确认");
      const shares = readAllocShareInputs();
      const { ok, bad } = validateAllocShares(shares);
      if (!ok) {
        const detail = bad.map(([src, v]) => `${src}=${v}%`).join("，");
        return toast("warning", `无法确认：上周分摊占比须合计 100%（${detail}）`);
      }
      state.allocByWeek[week] = { status: "confirmed", shares };
      toast("success", "业务一号位已确认工时分配（按上周分摊占比拆本周填报）");
      renderReviewAlloc();
    };
  }
}

function renderReview() {
  ensureReviewWeekSelects();
  setReviewTab(state.reviewTab);
  if (state.reviewTab === "alloc") renderReviewAlloc();
  else renderReviewAudit();
}

document.querySelectorAll("[data-review-tab]").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.reviewTab = btn.getAttribute("data-review-tab");
    renderReview();
  });
});
document.getElementById("review-week")?.addEventListener("change", (e) => {
  state.reviewWeek = e.target.value;
  const aw = document.getElementById("alloc-week");
  if (aw) aw.value = state.reviewWeek;
  renderReview();
});
document.getElementById("alloc-week")?.addEventListener("change", (e) => {
  state.reviewWeek = e.target.value;
  const rw = document.getElementById("review-week");
  if (rw) rw.value = state.reviewWeek;
  renderReview();
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

function periodsInYearMonth(year, month) {
  const y = Number(year) || 2026;
  const m = month === "" || month == null ? null : Number(month);
  return BASIC_PERIODS.filter((p) => p.year === y && (m == null || p.month === m));
}

function selectedBasicPeriods() {
  return [...document.querySelectorAll('#basic-period-panel input[name="basic-period"]:checked')].map((el) => el.value);
}

function syncBasicPeriodHint() {
  const year = document.getElementById("basic-filter-year")?.value || "2026";
  const month = document.getElementById("basic-filter-month")?.value || "";
  const selected = selectedBasicPeriods();
  const scope = periodsInYearMonth(year, month);
  const hint = document.getElementById("basic-period-hint");
  const countEl = document.getElementById("basic-period-count");
  if (hint) {
    hint.textContent = month
      ? `${year}年${Number(month)}月 · 已选 ${selected.length}/${scope.length} 周`
      : `${year}年全年 · 已选 ${selected.length}/${scope.length} 周`;
  }
  if (countEl) countEl.textContent = `${selected.length || scope.length} 个周期`;
}

function renderBasicPeriodPanel({ preserveUnchecked } = {}) {
  const panel = document.getElementById("basic-period-panel");
  if (!panel) return;
  const year = document.getElementById("basic-filter-year")?.value || "2026";
  const month = document.getElementById("basic-filter-month")?.value || "";
  const scope = periodsInYearMonth(year, month);
  const prevChecked = new Set(selectedBasicPeriods());
  const defaultAll = !preserveUnchecked || prevChecked.size === 0;
  panel.innerHTML = scope
    .map((p) => {
      const checked = defaultAll ? true : prevChecked.has(p.id);
      return `
      <label class="yc-period-chip${checked ? " is-checked" : ""}" title="${p.labelFull}">
        <input type="checkbox" name="basic-period" value="${p.id}" ${checked ? "checked" : ""} />
        <span>${p.label}</span>
      </label>`;
    })
    .join("");
  panel.querySelectorAll('input[name="basic-period"]').forEach((el) => {
    el.addEventListener("change", () => {
      el.closest(".yc-period-chip")?.classList.toggle("is-checked", el.checked);
      syncBasicPeriodHint();
      if (document.getElementById("page-basic")?.classList.contains("active")) renderBasic();
    });
  });
  syncBasicPeriodHint();
}

function ensureBasicFilters() {
  const brandEl = document.getElementById("basic-filter-brand");
  const groupEl = document.getElementById("basic-filter-group");
  const typeEl = document.getElementById("basic-filter-type");
  if (brandEl && brandEl.options.length <= 1) {
    BRANDS.forEach((b) => {
      const o = document.createElement("option");
      o.value = b;
      o.textContent = b;
      brandEl.appendChild(o);
    });
  }
  if (groupEl && groupEl.options.length <= 1) {
    GROUPS.forEach((g) => {
      const o = document.createElement("option");
      o.value = g;
      o.textContent = g;
      groupEl.appendChild(o);
    });
  }
  if (typeEl && typeEl.options.length <= 1) {
    EXECUTE_TYPES.forEach((t) => {
      const o = document.createElement("option");
      o.value = t.value;
      o.textContent = t.label;
      typeEl.appendChild(o);
    });
  }
  const panel = document.getElementById("basic-period-panel");
  if (panel && !panel.dataset.ready) {
    panel.dataset.ready = "1";
    renderBasicPeriodPanel();
  }
}

function filteredBasicRows() {
  ensureBasicFilters();
  const brand = document.getElementById("basic-filter-brand")?.value || "";
  const group = document.getElementById("basic-filter-group")?.value || "";
  const type = document.getElementById("basic-filter-type")?.value || "";
  const year = Number(document.getElementById("basic-filter-year")?.value || 2026);
  const monthRaw = document.getElementById("basic-filter-month")?.value || "";
  const month = monthRaw === "" ? null : Number(monthRaw);
  let periods = selectedBasicPeriods();
  if (!periods.length) {
    periods = periodsInYearMonth(year, monthRaw).map((p) => p.id);
  }
  const periodSet = new Set(periods);
  return BASIC_REPORT.filter((r) => {
    if (r.year !== year) return false;
    if (month != null && r.month !== month) return false;
    if (!periodSet.has(r.period)) return false;
    if (brand && r.brand !== brand) return false;
    if (group && r.group !== group) return false;
    if (type && r.type !== type) return false;
    return true;
  })
    .slice()
    .sort(
      (a, b) =>
        a.week - b.week ||
        a.group.localeCompare(b.group, "zh") ||
        a.brand.localeCompare(b.brand, "zh") ||
        a.line.localeCompare(b.line, "zh") ||
        (EXECUTE_LABEL[a.type] || a.type).localeCompare(EXECUTE_LABEL[b.type] || b.type, "zh"),
    );
}

function closeBasicDrawer() {
  document.getElementById("basic-drawer-mask")?.classList.remove("show");
  document.getElementById("basic-drawer")?.classList.remove("open");
  document.getElementById("basic-drawer")?.setAttribute("aria-hidden", "true");
  document.getElementById("basic-drawer-mask")?.setAttribute("aria-hidden", "true");
}

function openBasicDrawer(rows, title, sub) {
  const mask = document.getElementById("basic-drawer-mask");
  const drawer = document.getElementById("basic-drawer");
  const tbody = document.querySelector("#basic-drawer-table tbody");
  if (!mask || !drawer || !tbody) return;
  document.getElementById("basic-drawer-title").textContent = title || "人天明细";
  document.getElementById("basic-drawer-sub").textContent = sub || "";
  const people = [];
  rows.forEach((r) => {
    fillersForBasicRow(r).forEach((f) => {
      people.push({ ...f, group: r.group, brand: r.brand, line: r.line, type: r.type });
    });
  });
  /* 合并同人：合计人天，pctOfSelf 取加权近似（Demo：保留各条最大占比旁注用行展开） */
  const byPerson = new Map();
  people.forEach((p) => {
    const cur = byPerson.get(p.person);
    if (!cur) byPerson.set(p.person, { ...p });
    else {
      cur.days = Math.round((cur.days + p.days) * 10) / 10;
      cur.pctOfSelf = Math.min(100, cur.pctOfSelf + p.pctOfSelf);
    }
  });
  const list = [...byPerson.values()].sort((a, b) => b.days - a.days);
  const sumDays = Math.round(list.reduce((s, p) => s + p.days, 0) * 10) / 10;
  tbody.innerHTML = list.length
    ? list.map((p) => `
      <tr>
        <td>${p.person}</td>
        <td>${p.role}</td>
        <td>${p.days}</td>
        <td><b class="a3-text-primary">${p.pctOfSelf}%</b></td>
      </tr>`).join("") + `
      <tr>
        <td colspan="2" class="a3-text-secondary">合计</td>
        <td><b>${sumDays}</b></td>
        <td class="a3-text-secondary">占各自本周工时</td>
      </tr>`
    : `<tr><td colspan="4"><div class="a3-table-empty">暂无填报明细</div></td></tr>`;
  mask.classList.add("show");
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  mask.setAttribute("aria-hidden", "false");
}

function renderBasic() {
  const rows = filteredBasicRows();
  const totalDays = Math.round(rows.reduce((s, r) => s + r.days, 0) * 10) / 10;
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const periodN = new Set(rows.map((r) => r.period)).size;
  const totalBtn = document.getElementById("basic-total-days");
  if (totalBtn) totalBtn.innerHTML = `总人天 <b>${totalDays}</b>`;
  const costEl = document.getElementById("basic-total-cost");
  if (costEl) costEl.textContent = totalCost.toLocaleString();
  const countEl = document.getElementById("basic-period-count");
  if (countEl) countEl.textContent = `${periodN} 个周期`;
  syncBasicPeriodHint();

  document.querySelector("#basic-table tbody").innerHTML =
    rows
      .map(
        (r, i) => `
    <tr data-basic-idx="${i}">
      <td title="${r.periodFull || r.period}"><span class="yc-period-cell">${r.periodLabel || r.period}</span><span class="yc-period-cell-sub">${r.month}月</span></td>
      <td>${r.group}</td>
      <td>${r.brand}</td>
      <td>${r.line}</td>
      <td>${EXECUTE_LABEL[r.type] || r.type}</td>
      <td><button type="button" class="yc-days-link" data-basic-days="${i}" title="查看填报人明细">${r.days}</button></td>
      <td>${r.cost.toLocaleString()}</td>
    </tr>`,
      )
      .join("") || `<tr><td colspan="7"><div class="a3-table-empty">无匹配数据</div></td></tr>`;

  document.querySelectorAll("[data-basic-days]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const r = rows[Number(btn.getAttribute("data-basic-days"))];
      if (!r) return;
      openBasicDrawer(
        [r],
        "人天明细",
        `${r.period} · ${EXECUTE_LABEL[r.type] || r.type} · ${r.group} · ${r.brand} / ${r.line} · ${r.days} 人天`,
      );
    });
  });
  if (totalBtn) {
    totalBtn.onclick = () => {
      if (!rows.length) return toast("info", "当前筛选无数据");
      openBasicDrawer(
        rows,
        "合计人天明细",
        `当前筛选 ${periodN} 个周期 · 合计 ${totalDays} 人天 · 成本 ${totalCost.toLocaleString()} 元`,
      );
    };
  }
}

document.getElementById("basic-query")?.addEventListener("click", () => renderBasic());
["basic-filter-brand", "basic-filter-group", "basic-filter-type"].forEach((id) => {
  document.getElementById(id)?.addEventListener("change", () => {
    if (document.getElementById("page-basic")?.classList.contains("active")) renderBasic();
  });
});
["basic-filter-year", "basic-filter-month"].forEach((id) => {
  document.getElementById(id)?.addEventListener("change", () => {
    renderBasicPeriodPanel();
    if (document.getElementById("page-basic")?.classList.contains("active")) renderBasic();
  });
});
document.getElementById("basic-drawer-close")?.addEventListener("click", () => closeBasicDrawer());
document.getElementById("basic-drawer-done")?.addEventListener("click", () => closeBasicDrawer());
document.getElementById("basic-drawer-mask")?.addEventListener("click", () => closeBasicDrawer());
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.getElementById("basic-drawer")?.classList.contains("open")) {
    closeBasicDrawer();
  }
});

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

function updateDeptOwnerMeta() {
  const el = document.getElementById("cfg-owner-meta");
  const source = document.getElementById("cfg-owner-source");
  if (!el) return;
  const parts = [];
  if (state.deptOwners.source === "hr" && !state.deptOwners.savedAt && !state.deptOwners.fromDraft) {
    parts.push("默认已从人事系统载入");
  }
  if (state.deptOwners.savedAt) parts.push("已保存 " + state.deptOwners.savedAt);
  if (state.deptOwners.fromDraft) parts.push("草稿已恢复");
  if (state.deptOwners.draftedAt) parts.push("草稿 " + state.deptOwners.draftedAt);
  el.textContent = parts.length ? parts.join(" · ") : "默认已从人事系统载入";
  if (source) {
    source.textContent = state.deptOwners.source === "local" ? "来源：本机覆盖（原 HR）" : "来源：人事系统";
  }
}

function readDeptOwnerInputs() {
  const owners = { ...defaultDeptOwners() };
  document.querySelectorAll("[data-dept-owner]").forEach((el) => {
    const g = el.getAttribute("data-dept-owner");
    const v = (el.value || "").trim();
    if (g && v) owners[g] = v;
  });
  return owners;
}

function renderDeptOwnerConfig() {
  const tbody = document.querySelector("#cfg-owner-table tbody");
  if (!tbody) return;
  tbody.innerHTML = GROUPS.map((g) => {
    const name = ownerOf(g);
    const sync = state.deptOwners.source === "local" ? "本机覆盖" : "HR 同步";
    return `
      <tr>
        <td>${g}</td>
        <td>
          <div class="a3-input-wrapper" style="max-width:220px">
            <input class="a3-input" type="text" maxlength="32" value="${name}" data-dept-owner="${g}" />
          </div>
        </td>
        <td><span class="a3-tag a3-tag-default">${sync}</span></td>
      </tr>`;
  }).join("");
  updateDeptOwnerMeta();
}

document.getElementById("cfg-owner-draft")?.addEventListener("click", () => {
  const draftedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  const owners = readDeptOwnerInputs();
  state.deptOwners = { owners, savedAt: state.deptOwners.savedAt || null, source: "local", fromDraft: true, draftedAt };
  localStorage.setItem(
    DEPT_OWNER_DRAFT_KEY,
    JSON.stringify({ owners, draftedAt, source: "local", savedAt: state.deptOwners.savedAt }),
  );
  updateDeptOwnerMeta();
  toast("info", "部门负责人草稿已暂存到本机");
});

document.getElementById("cfg-owner-save")?.addEventListener("click", () => {
  const savedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  const owners = readDeptOwnerInputs();
  state.deptOwners = { owners, savedAt, source: "local", fromDraft: false };
  localStorage.setItem(DEPT_OWNER_STORAGE_KEY, JSON.stringify({ owners, savedAt, source: "local" }));
  localStorage.removeItem(DEPT_OWNER_DRAFT_KEY);
  renderDeptOwnerConfig();
  toast("success", "部门负责人已保存（Demo 本机生效；正式环境仍以 HR 为准）");
});

document.getElementById("cfg-owner-reset")?.addEventListener("click", () => {
  localStorage.removeItem(DEPT_OWNER_STORAGE_KEY);
  localStorage.removeItem(DEPT_OWNER_DRAFT_KEY);
  state.deptOwners = normalizeDeptOwners(null);
  renderDeptOwnerConfig();
  toast("info", "已恢复人事系统默认负责人");
});

function orgDescendantIds(node) {
  const ids = [];
  walkOrgTree(node.children || [], (n) => {
    if (n.departmentId) ids.push(n.departmentId);
  });
  return ids;
}

function orgSubtreeIds(node) {
  return [node.departmentId].concat(orgDescendantIds(node));
}

function updateFillScopeMeta() {
  const countEl = document.getElementById("fill-scope-count");
  const metaEl = document.getElementById("fill-scope-meta");
  const srcEl = document.getElementById("fill-scope-source");
  const n = (state.fillScope.selectedIds || []).length;
  if (countEl) countEl.textContent = `已选 ${n} 个部门`;
  if (srcEl) srcEl.textContent = state.fillScope.source === "local" ? "来源：本机覆盖" : "来源：组织架构";
  if (metaEl) {
    const parts = [];
    if (state.fillScope.savedAt) parts.push("已保存 " + state.fillScope.savedAt);
    parts.push(state.fillScope.leaderMustFill ? "负责人需填报" : "负责人免填报");
    metaEl.textContent = parts.join(" · ") || "默认已预勾选营销业务线相关部门";
  }
}

function setFillScopeChecked(id, checked) {
  const node = findOrgNode(ORG_DEPT_TREE, id);
  if (!node) return;
  const ids = orgSubtreeIds(node);
  const set = new Set(state.fillScope.selectedIds || []);
  ids.forEach((x) => {
    if (checked) set.add(x);
    else set.delete(x);
  });
  state.fillScope.selectedIds = Array.from(set);
}

function orgCheckState(node) {
  const selected = new Set(state.fillScope.selectedIds || []);
  const ids = orgSubtreeIds(node);
  const hit = ids.filter((id) => selected.has(id)).length;
  if (hit === 0) return { checked: false, indeterminate: false };
  if (hit === ids.length) return { checked: true, indeterminate: false };
  return { checked: false, indeterminate: true };
}

function renderOrgTreeNodes(nodes, depth) {
  return (nodes || [])
    .map((node) => {
      const kids = node.children || [];
      const hasKids = kids.length > 0;
      const collapsed = !!state.fillScopeCollapsed[node.departmentId];
      const st = orgCheckState(node);
      const twistCls = [
        "yc-org-twist",
        hasKids ? "" : "is-leaf",
        collapsed ? "is-collapsed" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `
        <li class="yc-org-node" role="treeitem" aria-expanded="${hasKids ? !collapsed : "false"}" data-dept-id="${node.departmentId}">
          <div class="yc-org-row" style="padding-left:${depth * 4}px">
            <button type="button" class="${twistCls}" data-org-twist="${node.departmentId}" aria-label="展开/收起">
              <i class="fas fa-chevron-down"></i>
            </button>
            <label class="yc-org-check">
              <input type="checkbox" data-org-check="${node.departmentId}" ${st.checked ? "checked" : ""} ${st.indeterminate ? 'data-indeterminate="1"' : ""} />
              <span class="yc-org-name">${node.name}</span>
              <span class="yc-org-meta">${node.departmentId}</span>
            </label>
          </div>
          ${
            hasKids
              ? `<ul class="yc-org-children${collapsed ? " is-collapsed" : ""}" role="group">${renderOrgTreeNodes(kids, depth + 1)}</ul>`
              : ""
          }
        </li>`;
    })
    .join("");
}

function renderFillScope() {
  const tree = document.getElementById("fill-scope-tree");
  if (!tree) return;
  tree.innerHTML = `<ul class="yc-org-node">${renderOrgTreeNodes(ORG_DEPT_TREE, 0)}</ul>`;
  tree.querySelectorAll("input[data-org-check]").forEach((input) => {
    if (input.getAttribute("data-indeterminate") === "1") input.indeterminate = true;
  });
  const toggle = document.getElementById("fill-scope-leader-toggle");
  if (toggle) toggle.checked = state.fillScope.leaderMustFill !== false;
  updateFillScopeMeta();
}

document.getElementById("fill-scope-tree")?.addEventListener("click", (e) => {
  const twist = e.target.closest("[data-org-twist]");
  if (!twist) return;
  e.preventDefault();
  const id = twist.getAttribute("data-org-twist");
  state.fillScopeCollapsed[id] = !state.fillScopeCollapsed[id];
  renderFillScope();
});

document.getElementById("fill-scope-tree")?.addEventListener("change", (e) => {
  const input = e.target.closest("input[data-org-check]");
  if (!input) return;
  setFillScopeChecked(input.getAttribute("data-org-check"), input.checked);
  renderFillScope();
});

document.getElementById("fill-scope-leader-toggle")?.addEventListener("change", (e) => {
  state.fillScope.leaderMustFill = !!e.target.checked;
  updateFillScopeMeta();
});

document.getElementById("fill-scope-save")?.addEventListener("click", () => {
  const savedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  state.fillScope = {
    selectedIds: (state.fillScope.selectedIds || []).slice(),
    leaderMustFill: state.fillScope.leaderMustFill !== false,
    savedAt,
    source: "local",
  };
  localStorage.setItem(FILL_SCOPE_STORAGE_KEY, JSON.stringify(state.fillScope));
  updateFillScopeMeta();
  toast("success", "填报范围已保存（Demo 本机生效）");
});

document.getElementById("fill-scope-reset")?.addEventListener("click", () => {
  localStorage.removeItem(FILL_SCOPE_STORAGE_KEY);
  state.fillScope = defaultFillScope();
  renderFillScope();
  toast("info", "已恢复默认填报范围（营销业务线）");
});

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
  const warm = currentTheme() === "warm";
  const color = good ? (warm ? "#52C41A" : "#2F9B6A") : (warm ? "#ff4d4f" : "#D4524A");
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
  const tones = currentTheme() === "warm"
    ? ["#52C41A", "#FAAD14", "#c9677d", "#ff4d4f"]
    : ["#2F9B6A", "#C9912A", "#2F6F8F", "#D4524A"];
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
} else if (bootHash === "fill" || bootHash === "fill-cmp") go("fill");
else if (bootHash === "config" || bootHash === "fill-scope") {
  if (!canConfigRole(state.role)) {
    state.role = "finance";
    document.getElementById("role-select").value = "finance";
    document.getElementById("user-chip").innerHTML = `<i class="fas fa-user"></i> ${roleMeta.finance.name}`;
    syncRoleMenus();
  }
  go(bootHash === "fill-scope" ? "fill-scope" : "config");
} else if (bootHash === "basic" || bootHash === "brand") go("basic");
else if (bootHash === "review" || bootHash === "review-alloc" || bootHash === "leader" || bootHash === "mine") {
  if (bootHash === "review-alloc") {
    state.role = "owner";
    state.reviewTab = "alloc";
  } else {
    state.role = "leader";
    state.reviewTab = "audit";
  }
  document.getElementById("role-select").value = state.role;
  document.getElementById("user-chip").innerHTML = `<i class="fas fa-user"></i> ${roleMeta[state.role].name}`;
  syncRoleMenus();
  go("review");
} else renderFill();

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
  } else if (h === "fill" || h === "fill-cmp") go("fill");
  else if (h === "config" || h === "fill-scope") {
    if (!canConfigRole(state.role)) {
      state.role = "finance";
      document.getElementById("role-select").value = "finance";
      document.getElementById("user-chip").innerHTML = `<i class="fas fa-user"></i> ${roleMeta.finance.name}`;
      syncRoleMenus();
    }
    go(h === "fill-scope" ? "fill-scope" : "config");
  } else if (h === "basic" || h === "brand") go("basic");
  else if (h === "review" || h === "review-alloc" || h === "leader" || h === "mine") {
    if (h === "review-alloc") {
      if (state.role !== "owner" && state.role !== "leader") {
        state.role = "owner";
        document.getElementById("role-select").value = "owner";
        document.getElementById("user-chip").innerHTML = `<i class="fas fa-user"></i> ${roleMeta.owner.name}`;
        syncRoleMenus();
      }
      state.reviewTab = "alloc";
    } else {
      if (state.role !== "leader" && state.role !== "owner") {
        state.role = "leader";
        document.getElementById("role-select").value = "leader";
        document.getElementById("user-chip").innerHTML = `<i class="fas fa-user"></i> ${roleMeta.leader.name}`;
        syncRoleMenus();
      }
      state.reviewTab = "audit";
    }
    go("review");
  } else if (h === "admin-config" || h === "admin-watch" || h === "admin-progress") {
    if (state.role !== "admin") {
      state.role = "admin";
      document.getElementById("role-select").value = "admin";
      document.getElementById("user-chip").innerHTML = `<i class="fas fa-user"></i> ${roleMeta.admin.name}`;
      syncRoleMenus();
    }
    go(h === "admin-config" ? "admin-config" : "admin-watch");
  }
});

/* —— 产品文档：顶栏预览 + 下载（纯 MD，供 AI 读取） —— */
const PRD_DOCS = [
  {
    id: "workhour",
    title: "工时与项目人力",
    desc: "工时填报、部门审核、工时分配、基础报表、项目人力、配置（部门负责人/填报范围）",
    file: "prd-workhour-manpower.md",
    path: "docs/prd-workhour-manpower.md",
  },
  {
    id: "observatory",
    title: "观测台",
    desc: "CEO/CFO 高管财务：入口、四视图、口径与验收",
    file: "prd-observatory.md",
    path: "docs/prd-observatory.md",
  },
  {
    id: "all",
    title: "合集（推荐给 AI）",
    desc: "两份 PRD 合并，一次下载即可喂给 AI",
    file: "prd-all.md",
    path: "docs/prd-all.md",
  },
  {
    id: "index",
    title: "文档索引",
    desc: "路径说明与 AI 用法",
    file: "README.md",
    path: "docs/README.md",
  },
];

const docsState = { current: null, cache: {} };

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMarkdown(md) {
  if (typeof marked !== "undefined" && marked.parse) {
    try { return marked.parse(md); } catch (_) { /* fall through */ }
  }
  return `<pre>${escapeHtml(md)}</pre>`;
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function fetchDoc(doc) {
  if (docsState.cache[doc.id]) return docsState.cache[doc.id];
  const res = await fetch(doc.path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`无法加载 ${doc.path}（${res.status}）`);
  const text = await res.text();
  docsState.cache[doc.id] = text;
  return text;
}

function renderDocsList() {
  const list = document.getElementById("docs-list");
  if (!list) return;
  list.innerHTML = PRD_DOCS.map((d) => `
    <button type="button" class="yc-docs-item${docsState.current === d.id ? " active" : ""}" data-doc-id="${d.id}">
      <b>${d.title}</b>
      <span>${d.desc}</span>
    </button>
  `).join("");
  list.querySelectorAll("[data-doc-id]").forEach((btn) => {
    btn.addEventListener("click", () => openDoc(btn.getAttribute("data-doc-id")));
  });
}

async function openDoc(id) {
  const doc = PRD_DOCS.find((d) => d.id === id);
  if (!doc) return;
  docsState.current = id;
  renderDocsList();
  const nameEl = document.getElementById("docs-preview-name");
  const bodyEl = document.getElementById("docs-preview-body");
  const rawEl = document.getElementById("docs-open-raw");
  const dlBtn = document.getElementById("docs-download");
  if (nameEl) nameEl.textContent = `${doc.title} · ${doc.file}`;
  if (rawEl) rawEl.href = doc.path;
  if (bodyEl) bodyEl.innerHTML = `<p class="a3-text-secondary">加载中…</p>`;
  if (dlBtn) dlBtn.disabled = true;
  try {
    const text = await fetchDoc(doc);
    if (bodyEl) bodyEl.innerHTML = renderMarkdown(text);
    if (dlBtn) {
      dlBtn.disabled = false;
      dlBtn.onclick = () => {
        downloadText(doc.file, text);
        toast("success", `已下载 ${doc.file}`);
      };
    }
  } catch (err) {
    if (bodyEl) {
      bodyEl.innerHTML = `<p class="a3-text-secondary">加载失败：${escapeHtml(err.message || String(err))}<br/>请确认本地 serve 根目录为 demo，且存在 <code>${escapeHtml(doc.path)}</code>。</p>`;
    }
  }
}

function openDocsDrawer(preferId) {
  const overlay = document.getElementById("docs-overlay");
  if (!overlay) return;
  overlay.hidden = false;
  renderDocsList();
  openDoc(preferId || docsState.current || "all");
}

function closeDocsDrawer() {
  const overlay = document.getElementById("docs-overlay");
  if (overlay) overlay.hidden = true;
}

document.getElementById("docs-entry")?.addEventListener("click", () => openDocsDrawer("all"));
document.getElementById("docs-close")?.addEventListener("click", closeDocsDrawer);
document.getElementById("docs-overlay")?.addEventListener("click", (e) => {
  if (e.target && e.target.id === "docs-overlay") closeDocsDrawer();
});
document.getElementById("docs-download-all")?.addEventListener("click", async () => {
  try {
    const doc = PRD_DOCS.find((d) => d.id === "all");
    const text = await fetchDoc(doc);
    downloadText(doc.file, text);
    toast("success", "已下载合集 prd-all.md，可直接交给 AI");
  } catch (err) {
    toast("danger", err.message || "下载失败");
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDocsDrawer();
});
