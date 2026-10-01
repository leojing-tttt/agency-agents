/* 业财工时归集 demo — A3 SaaS UI
 * 执行单类型两级枚举来源：
 * agency-agents/system/a3-talent-libary-master-…/CreateExecutionOrder/store.ts + type.ts
 */

const BRANDS = ["青禾", "北境智造", "星澜茶", "澄光护肤", "岚屿家居"];
const LINES = {
  青禾: ["精华水", "面膜", "防晒", "洁面"],
  北境智造: ["主机", "配件", "智能音箱"],
  星澜茶: ["瓶装", "礼盒", "即饮"],
  澄光护肤: ["精华", "面霜", "眼霜"],
  岚屿家居: ["香氛", "床品", "餐厨"],
};

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
    { group: "营销一部", brand: "青禾", line: "精华水", type: "INTERNAL_KOL", sub: "KOL", pct: 25 },
    { group: "营销一部", brand: "青禾", line: "防晒", type: "INTERNAL_DSP", sub: "INFLUENCER_PLATFORM_PAYMENT", pct: 15 },
    { group: "营销三部", brand: "北境智造", line: "主机", type: "HARD_AD", sub: "HARD_AD_PRICING", pct: 20 },
    { group: "营销五部", brand: "星澜茶", line: "礼盒", type: "GEO", sub: "", pct: 15 },
    { group: "营销七部", brand: "澄光护肤", line: "精华", type: "PUBLIC_OPINION", sub: "", pct: 12 },
    { group: "营销九部", brand: "岚屿家居", line: "香氛", type: "OTHER", sub: "", pct: 13 },
  ],
  "2026-W38": [
    { group: "营销二部", brand: "青禾", line: "面膜", type: "INTERNAL_KOL", sub: "COMMON_KOL", pct: 30 },
    { group: "营销四部", brand: "北境智造", line: "配件", type: "INTERNAL_DSP", sub: "INFLUENCER_EXTERNAL_ORDER", pct: 25 },
    { group: "营销六部", brand: "星澜茶", line: "瓶装", type: "SELF_MEDIA", sub: "", pct: 20 },
    { group: "营销八部", brand: "澄光护肤", line: "面霜", type: "CUSTOMER_RELATIONSHIP", sub: "", pct: 15 },
    { group: "营销一部", brand: "岚屿家居", line: "床品", type: "HARD_AD", sub: "HARD_AD_MEDIA_PHOTO", pct: 10 },
  ],
};

/** Leader 归集：品牌|品线|type → 项目权重 */
const SPLIT_CATALOG = {
  "青禾|精华水|INTERNAL_KOL": [
    { project: "青禾精华 Q3 种草", order: "ZX-一部-0918", w: 0.6 },
    { project: "青禾精华 会员日", order: "ZX-一部-0922", w: 0.4 },
  ],
  "青禾|防晒|INTERNAL_DSP": [
    { project: "青禾防晒 日化战役", order: "ZX-一部-0908", w: 0.7 },
    { project: "青禾防晒 达人联投", order: "ZX-一部-0912", w: 0.3 },
  ],
  "岚屿家居|床品|HARD_AD": [
    { project: "岚屿床品 硬广档", order: "ZX-一部-0830", w: 1 },
  ],
};

const TEAM_DEPT1_EXTRAS = [
  {
    person: "陈屿", brand: "青禾", line: "精华水", type: "INTERNAL_KOL", sub: "KOL", filled: 20,
    parts: [{ project: "青禾精华 Q3 种草", order: "ZX-一部-0918", w: 1 }],
  },
  {
    person: "苏晚", brand: "青禾", line: "防晒", type: "INTERNAL_DSP", sub: "INFLUENCER_PLATFORM_PAYMENT", filled: 10,
    parts: [
      { project: "青禾防晒 日化战役", order: "ZX-一部-0908", w: 0.5 },
      { project: "青禾防晒 达人联投", order: "ZX-一部-0912", w: 0.5 },
    ],
  },
];

const PROJECT_REPORT = [
  { project: "青禾精华 Q3 种草", brand: "青禾 / 精华水", types: "KOL（一口价）", days: 6.8, cost: 27200 },
  { project: "青禾精华 会员日", brand: "青禾 / 精华水", types: "KOL（一口价）", days: 1.8, cost: 7200 },
  { project: "青禾防晒 日化战役", brand: "青禾 / 防晒", types: "投流 / 平台付款", days: 2.4, cost: 9600 },
  { project: "青禾防晒 达人联投", brand: "青禾 / 防晒", types: "投流 / 平台付款", days: 1.1, cost: 4400 },
  { project: "北境主机 双11 预热", brand: "北境智造 / 主机", types: "硬广 / 定价类广告", days: 4.5, cost: 22500 },
  { project: "星澜茶 中秋礼盒", brand: "星澜茶 / 礼盒", types: "GEO", days: 3.2, cost: 12800 },
  { project: "澄光秋冬焕肤", brand: "澄光护肤 / 精华", types: "舆情", days: 2.8, cost: 11200 },
  { project: "岚屿香氛 门店联名", brand: "岚屿家居 / 香氛", types: "策划与比稿费用", days: 1.5, cost: 6000 },
];

const BRAND_REPORT = [
  { brand: "青禾", line: "精华水", days: 9.8, media: 2.1, buy: 5.2, plan: 2.5, cost: 39200 },
  { brand: "青禾", line: "防晒", days: 3.5, media: 0.8, buy: 2.0, plan: 0.7, cost: 14000 },
  { brand: "青禾", line: "面膜", days: 2.0, media: 0.5, buy: 0.9, plan: 0.6, cost: 8000 },
  { brand: "北境智造", line: "主机", days: 4.5, media: 0.6, buy: 3.2, plan: 0.7, cost: 22500 },
  { brand: "北境智造", line: "配件", days: 1.6, media: 0.3, buy: 1.1, plan: 0.2, cost: 8000 },
  { brand: "星澜茶", line: "礼盒", days: 2.4, media: 0.8, buy: 0.6, plan: 1.0, cost: 9600 },
  { brand: "澄光护肤", line: "精华", days: 2.8, media: 0.7, buy: 1.2, plan: 0.9, cost: 11200 },
  { brand: "岚屿家居", line: "香氛", days: 1.5, media: 0.3, buy: 0.5, plan: 0.7, cost: 6000 },
];

const TITLES = {
  fill: "周填报",
  "fill-cmp": "填报对比",
  mine: "我的填报",
  leader: "待我确认",
  project: "项目人力",
  brand: "品牌品线人力",
  "admin-config": "配置面板",
  "admin-watch": "观看面板",
  master: "主数据来源",
};

const ADMIN_STORAGE_KEY = "yecai-workhour-admin-config-v1";
const ADMIN_DRAFT_KEY = "yecai-workhour-admin-config-draft-v1";

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

function defaultProjectManpower() {
  return PROJECT_REPORT.map((p) => ({
    project: p.project,
    brand: p.brand,
    plannedDays: p.days,
    note: "",
  }));
}

/** 观看面板：各周已提交人数 mock（应填 = 配置员工数） */
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
  return {
    group: group || "",
    brand: BRANDS[0],
    line: LINES[BRANDS[0]][0],
    type: EXECUTE_TYPES[0].value,
    sub: (EXECUTE_SUBTYPES[EXECUTE_TYPES[0].value][0] || {}).value || "",
    pct: 0,
  };
}

function loadAdminConfig() {
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) { /* ignore */ }
  return {
    staffByDept: { ...DEFAULT_STAFF_BY_DEPT },
    projectManpower: defaultProjectManpower(),
    savedAt: null,
  };
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
  state.adminConfig = {
    staffByDept: { ...DEFAULT_STAFF_BY_DEPT, ...(draftBoot.staffByDept || {}) },
    projectManpower: draftBoot.projectManpower || defaultProjectManpower(),
    savedAt: state.adminConfig.savedAt,
  };
  state.adminDraftMeta = draftBoot.draftedAt || "草稿已恢复";
}

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
  const adminHashes = { "fill-cmp": "fill-cmp", "admin-config": "admin-config", "admin-watch": "admin-watch" };
  if (adminHashes[page]) location.hash = adminHashes[page];
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
      } else if (k === "group" || k === "pct") {
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
  const lines = LINES[row.brand] || [];
  const subDisabled = !(EXECUTE_SUBTYPES[row.type] || []).length;
  const groupCell = includeGroup
    ? `<td><div class="a3-select-wrapper"><select class="a3-select" data-i="${i}" data-k="group">${opts(GROUPS, row.group)}</select><i class="fas fa-chevron-down a3-select-arrow"></i></div></td>`
    : "";
  return `
    ${groupCell}
    <td><div class="a3-select-wrapper"><select class="a3-select" data-i="${i}" data-k="brand">${opts(BRANDS, row.brand)}</select><i class="fas fa-chevron-down a3-select-arrow"></i></div></td>
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
    const rowsHtml = indices.map((i) => `<tr>${rowCellsHtml(state.rows[i], i, { includeGroup: false })}</tr>`).join("");
    return `
      <div class="yc-dept a3-card a3-mb-16" data-dept="${g}">
        <div class="yc-dept-head">
          <div class="yc-dept-title">
            <i class="fas fa-building a3-text-brand"></i>
            <strong class="a3-text-primary">${g}</strong>
            <span class="a3-tag a3-tag-default">本部门 ${deptPct}%</span>
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
    BRANDS.forEach((b) => {
      const o = document.createElement("option");
      o.textContent = b;
      bf.appendChild(o);
    });
  }
  const filter = bf.value;
  const rows = filter && filter !== "全部" ? BRAND_REPORT.filter((r) => r.brand === filter) : BRAND_REPORT;
  document.querySelector("#brand-table tbody").innerHTML = rows.map((r) => `
    <tr>
      <td>${r.brand}</td><td>${r.line}</td><td>${r.days}</td>
      <td>${r.media}</td><td>${r.buy}</td><td>${r.plan}</td>
      <td class="cost-col" style="display:${showCost ? "" : "none"}">${r.cost.toLocaleString()}</td>
    </tr>`).join("");
}

document.getElementById("brand-filter").addEventListener("change", () => {
  if (document.getElementById("page-brand").classList.contains("active")) renderBrand();
});

function renderMaster() {
  document.getElementById("md-brands").textContent = BRANDS.join("、");
  document.getElementById("md-lines").textContent = Object.entries(LINES).map(([b, ls]) => `${b}→${ls.join("/")}`).join("；");
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
      <td class="a3-text-secondary">应填人数基准（观看面板）</td>
    </tr>
  `).join("");

  document.querySelector("#cfg-project-table tbody").innerHTML = state.adminConfig.projectManpower.map((p, i) => `
    <tr>
      <td>${p.project}</td>
      <td>${p.brand}</td>
      <td><div class="a3-input-wrapper" style="max-width:120px">
        <input class="a3-input" type="number" min="0" max="999" step="0.1" value="${p.plannedDays}" data-proj-days="${i}" />
      </div></td>
      <td><div class="a3-input-wrapper">
        <input class="a3-input" type="text" placeholder="可选备注" value="${p.note || ""}" data-proj-note="${i}" />
      </div></td>
    </tr>
  `).join("");

  document.querySelectorAll("[data-staff]").forEach((el) => {
    el.addEventListener("change", () => {
      state.adminConfig.staffByDept[el.dataset.staff] = Number(el.value) || 0;
      updateCfgMeta();
    });
  });
  document.querySelectorAll("[data-proj-days]").forEach((el) => {
    el.addEventListener("change", () => {
      state.adminConfig.projectManpower[+el.dataset.projDays].plannedDays = Number(el.value) || 0;
    });
  });
  document.querySelectorAll("[data-proj-note]").forEach((el) => {
    el.addEventListener("change", () => {
      state.adminConfig.projectManpower[+el.dataset.projNote].note = el.value;
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
    projectManpower: state.adminConfig.projectManpower,
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
  localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(state.adminConfig));
  localStorage.removeItem(ADMIN_DRAFT_KEY);
  state.adminDraftMeta = null;
  updateCfgMeta();
  toast("success", "配置已保存，观看面板将使用最新应填人数");
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

function renderAdminWatch() {
  const isAdmin = state.role === "admin";
  document.getElementById("admin-watch-gate").style.display = isAdmin ? "none" : "flex";
  document.getElementById("admin-watch-body").style.display = isAdmin ? "block" : "none";
  if (!isAdmin) return;

  const weekSelect = document.getElementById("watch-week-select");
  if (weekSelect.options.length !== WATCH_WEEKS.length) {
    weekSelect.innerHTML = WATCH_WEEKS.map((w) =>
      `<option value="${w}" ${w === state.watchWeek ? "selected" : ""}>${w}</option>`
    ).join("");
  } else {
    weekSelect.value = state.watchWeek;
  }

  const cards = document.getElementById("watch-week-cards");
  cards.innerHTML = WATCH_WEEKS.map((w) => {
    const p = weekProgress(w);
    const active = w === state.watchWeek ? " yc-watch-card-active" : "";
    return `
      <div class="a3-card yc-stat yc-watch-card${active}" data-watch-week="${w}">
        <div class="a3-card-body">
          <div class="a3-text-secondary" style="font-size:12px">${w}</div>
          <div class="a3-text-primary a3-mt-8" style="font-size:22px;font-weight:600">${p.overall}%</div>
          <div class="a3-text-secondary a3-mt-8" style="font-size:12px">${p.submitted} / ${p.expected} 人已交</div>
          <div class="a3-mt-8">${progressBarHtml(p.overall, p.overall >= 100)}</div>
        </div>
      </div>
    `;
  }).join("");

  cards.querySelectorAll("[data-watch-week]").forEach((card) => {
    card.addEventListener("click", () => {
      state.watchWeek = card.dataset.watchWeek;
      renderAdminWatch();
    });
  });

  const cur = weekProgress(state.watchWeek);
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

document.getElementById("watch-week-select").addEventListener("change", (e) => {
  state.watchWeek = e.target.value;
  renderAdminWatch();
});

document.querySelectorAll(".cost-col").forEach((el) => { el.style.display = "none"; });
syncAdminMenus();
const bootHash = (location.hash || "").replace("#", "");
if (bootHash === "admin-config" || bootHash === "admin-watch") {
  state.role = "admin";
  document.getElementById("role-select").value = "admin";
  document.getElementById("user-chip").innerHTML = `<i class="fas fa-user"></i> ${roleMeta.admin.name}`;
  syncAdminMenus();
  go(bootHash);
} else if (bootHash === "fill-cmp") go("fill-cmp");
else renderFill();
