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
  "admin-config": "配置面板",
  "admin-watch": "填报进度面板",
  master: "主数据来源",
};

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
  filler: { name: "林可 · 媒介", showCost: false },
  leader: { name: "周衡 · 营销一部 Leader", showCost: false },
  finance: { name: "沈岚 · 财务", showCost: true },
  admin: { name: "顾澄 · 管理员", showCost: true },
};

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

function syncAdminMenus() {
  const isAdmin = state.role === "admin";
  document.body.classList.toggle("yc-role-admin", isAdmin);
}

function go(page) {
  if ((page === "admin-config" || page === "admin-watch") && state.role !== "admin") {
    toast("warning", "请先切换为管理员身份");
    page = "fill";
  }
  document.querySelectorAll(".page").forEach((p) => p.classList.toggle("active", p.id === "page-" + page));
  document.querySelectorAll(".a3-menu-item[data-page]").forEach((m) => m.classList.toggle("active", m.dataset.page === page));
  document.getElementById("crumb").textContent = TITLES[page] || page;
  if (page === "fill") renderFill();
  if (page === "fill-cmp") renderFillCmp();
  if (page === "mine") renderMine();
  if (page === "leader") renderLeader();
  if (page === "project") renderProject();
  if (page === "brand") renderBrand();
  if (page === "admin-config") renderAdminConfig();
  if (page === "admin-watch") renderAdminWatch();
  if (page === "master") renderMaster();
  const pageHashes = { "fill-cmp": "fill-cmp", "admin-config": "admin-config", "admin-watch": "admin-progress", brand: "brand" };
  if (pageHashes[page]) location.hash = pageHashes[page];
  else if (location.hash && location.hash !== "#") history.replaceState(null, "", location.pathname + location.search);
}

document.querySelectorAll(".a3-menu-item[data-page]").forEach((m) => {
  m.addEventListener("click", () => go(m.dataset.page));
});

document.getElementById("role-select").addEventListener("change", (e) => {
  state.role = e.target.value;
  document.getElementById("user-chip").innerHTML = `<i class="fas fa-user"></i> ${roleMeta[state.role].name}`;
  syncAdminMenus();
  const active = document.querySelector(".a3-menu-item.active");
  const onAdminPage = active && (active.dataset.page === "admin-config" || active.dataset.page === "admin-watch");
  if (state.role === "admin") go(onAdminPage ? active.dataset.page : "admin-config");
  else if (onAdminPage) go("fill");
  else go(active ? active.dataset.page : "fill");
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

document.querySelectorAll(".cost-col").forEach((el) => { el.style.display = "none"; });
syncAdminMenus();
const bootHash = (location.hash || "").replace("#", "");
const adminBoot = bootHash === "admin-config" || bootHash === "admin-watch" || bootHash === "admin-progress";
if (adminBoot) {
  state.role = "admin";
  document.getElementById("role-select").value = "admin";
  document.getElementById("user-chip").innerHTML = `<i class="fas fa-user"></i> ${roleMeta.admin.name}`;
  syncAdminMenus();
  go(bootHash === "admin-config" ? "admin-config" : "admin-watch");
} else if (bootHash === "fill-cmp" || bootHash === "brand") go(bootHash);
else renderFill();
