/* 业财工时归集 demo logic — A3 SaaS UI chrome in index.html */

const BRANDS = ["青禾", "北境智造", "星澜茶", "澄光护肤", "岚屿家居"];
const LINES = {
  青禾: ["精华水", "面膜", "防晒", "洁面"],
  北境智造: ["主机", "配件", "智能音箱"],
  星澜茶: ["瓶装", "礼盒", "即饮"],
  澄光护肤: ["精华", "面霜", "眼霜"],
  岚屿家居: ["香氛", "床品", "餐厨"],
};
const GROUPS = ["华东投放组", "华南投放组", "内容策划组", "媒介采买组", "设计策略组", "品牌运营组"];
/** 填报对比页专用业务组（营销一部–九部）；旧周填报仍用 GROUPS */
const MARKETING_DEPTS = [
  "营销一部", "营销二部", "营销三部", "营销四部", "营销五部",
  "营销六部", "营销七部", "营销八部", "营销九部",
];
const BIZ_TYPES = ["信息流投放", "内容种草", "媒介采买", "设计制作", "策略策划", "达人合作", "直播运营"];

const WEEK_LABELS = {
  "2026-W39": "2026-W39（09/22–09/28）",
  "2026-W38": "2026-W38（09/15–09/21）",
};

/** 林可 · 媒介 — 各周填报底稿（合计约 40h） */
const FILL_BY_WEEK = {
  "2026-W39": [
    { brand: "青禾", line: "精华水", group: "华东投放组", type: "信息流投放", hours: 14 },
    { brand: "青禾", line: "精华水", group: "内容策划组", type: "内容种草", hours: 6 },
    { brand: "青禾", line: "防晒", group: "华东投放组", type: "信息流投放", hours: 5 },
    { brand: "北境智造", line: "主机", group: "媒介采买组", type: "媒介采买", hours: 8 },
    { brand: "北境智造", line: "配件", group: "媒介采买组", type: "媒介采买", hours: 3 },
    { brand: "星澜茶", line: "礼盒", group: "内容策划组", type: "内容种草", hours: 4 },
  ],
  "2026-W38": [
    { brand: "青禾", line: "面膜", group: "华东投放组", type: "信息流投放", hours: 10 },
    { brand: "青禾", line: "精华水", group: "内容策划组", type: "内容种草", hours: 8 },
    { brand: "澄光护肤", line: "精华", group: "华南投放组", type: "信息流投放", hours: 7 },
    { brand: "北境智造", line: "主机", group: "媒介采买组", type: "媒介采买", hours: 9 },
    { brand: "岚屿家居", line: "香氛", group: "设计策略组", type: "设计制作", hours: 6 },
  ],
};

/** 填报对比页底稿：业务组=营销一部–九部，维度 业务组→品牌品线→业务类型（合计 40h） */
const FILL_CMP_BY_WEEK = {
  "2026-W39": [
    { group: "营销一部", brand: "青禾", line: "精华水", type: "信息流投放", hours: 12 },
    { group: "营销一部", brand: "青禾", line: "防晒", type: "达人合作", hours: 4 },
    { group: "营销三部", brand: "北境智造", line: "主机", type: "媒介采买", hours: 8 },
    { group: "营销五部", brand: "星澜茶", line: "礼盒", type: "内容种草", hours: 6 },
    { group: "营销七部", brand: "澄光护肤", line: "精华", type: "策略策划", hours: 5 },
    { group: "营销九部", brand: "岚屿家居", line: "香氛", type: "设计制作", hours: 5 },
  ],
  "2026-W38": [
    { group: "营销二部", brand: "青禾", line: "面膜", type: "信息流投放", hours: 10 },
    { group: "营销四部", brand: "北境智造", line: "配件", type: "媒介采买", hours: 9 },
    { group: "营销六部", brand: "星澜茶", line: "瓶装", type: "内容种草", hours: 8 },
    { group: "营销八部", brand: "澄光护肤", line: "面霜", type: "直播运营", hours: 7 },
    { group: "营销一部", brand: "岚屿家居", line: "床品", type: "设计制作", hours: 6 },
  ],
};

/** Leader 归集：品牌|品线|业务类型 → 项目/执行单权重（权重之和 = 1） */
const SPLIT_CATALOG = {
  "青禾|精华水|信息流投放": [
    { project: "青禾精华 Q3 种草", order: "ZX-东投-0918", w: 0.55 },
    { project: "青禾精华 会员日", order: "ZX-东投-0922", w: 0.3 },
    { project: "青禾双11 蓄水", order: "ZX-东投-0925", w: 0.15 },
  ],
  "青禾|防晒|信息流投放": [
    { project: "青禾防晒 日化战役", order: "ZX-东投-0908", w: 0.7 },
    { project: "青禾防晒 达人联投", order: "ZX-东投-0912", w: 0.3 },
  ],
  "青禾|面膜|信息流投放": [
    { project: "青禾面膜 国庆档", order: "ZX-东投-0901", w: 0.65 },
    { project: "青禾面膜 私域转化", order: "ZX-东投-0905", w: 0.35 },
  ],
  "澄光护肤|精华|信息流投放": [
    { project: "澄光秋冬焕肤", order: "ZX-东投-0910", w: 0.6 },
    { project: "澄光会员日加投", order: "ZX-东投-0916", w: 0.4 },
  ],
  "星澜茶|礼盒|信息流投放": [
    { project: "星澜茶 中秋礼盒", order: "ZX-东投-0903", w: 1 },
  ],
};

/** 华东投放组其他成员本周待确认（与林可填报拼成完整组视图） */
const TEAM_EAST_EXTRAS = [
  {
    person: "陈屿", brand: "青禾", line: "精华水", type: "信息流投放", filled: 10,
    parts: [{ project: "青禾精华 Q3 种草", order: "ZX-东投-0918", w: 1 }],
  },
  {
    person: "苏晚", brand: "澄光护肤", line: "精华", type: "信息流投放", filled: 8,
    parts: [
      { project: "澄光秋冬焕肤", order: "ZX-东投-0910", w: 0.625 },
      { project: "澄光会员日加投", order: "ZX-东投-0916", w: 0.375 },
    ],
  },
  {
    person: "何予", brand: "星澜茶", line: "礼盒", type: "信息流投放", filled: 6,
    parts: [{ project: "星澜茶 中秋礼盒", order: "ZX-东投-0903", w: 1 }],
  },
  {
    person: "何予", brand: "青禾", line: "面膜", type: "信息流投放", filled: 4,
    parts: [
      { project: "青禾面膜 国庆档", order: "ZX-东投-0901", w: 0.5 },
      { project: "青禾面膜 私域转化", order: "ZX-东投-0905", w: 0.5 },
    ],
  },
];

/** 项目人力报表（人天 ≈ 工时/8；成本按约 4000 元/人天） */
const PROJECT_REPORT = [
  { project: "青禾精华 Q3 种草", brand: "青禾 / 精华水", types: "信息流投放、内容种草", days: 6.8, cost: 27200 },
  { project: "青禾精华 会员日", brand: "青禾 / 精华水", types: "信息流投放", days: 1.8, cost: 7200 },
  { project: "青禾双11 蓄水", brand: "青禾 / 精华水", types: "信息流投放、策略策划", days: 1.2, cost: 4800 },
  { project: "青禾防晒 日化战役", brand: "青禾 / 防晒", types: "信息流投放、达人合作", days: 2.4, cost: 9600 },
  { project: "青禾防晒 达人联投", brand: "青禾 / 防晒", types: "达人合作、信息流投放", days: 1.1, cost: 4400 },
  { project: "青禾面膜 国庆档", brand: "青禾 / 面膜", types: "信息流投放、内容种草", days: 2.0, cost: 8000 },
  { project: "北境主机 双11 预热", brand: "北境智造 / 主机", types: "媒介采买、策略策划", days: 4.5, cost: 22500 },
  { project: "北境配件 新品上架", brand: "北境智造 / 配件", types: "媒介采买", days: 1.6, cost: 8000 },
  { project: "星澜茶 中秋礼盒", brand: "星澜茶 / 礼盒", types: "内容种草、信息流投放、设计制作", days: 3.2, cost: 12800 },
  { project: "澄光秋冬焕肤", brand: "澄光护肤 / 精华", types: "信息流投放、内容种草", days: 2.8, cost: 11200 },
  { project: "岚屿香氛 门店联名", brand: "岚屿家居 / 香氛", types: "设计制作、品牌运营", days: 1.5, cost: 6000 },
];

/** 品牌品线人力：媒介+投放+策划 = 投入人天 */
const BRAND_REPORT = [
  { brand: "青禾", line: "精华水", days: 9.8, media: 2.1, buy: 5.2, plan: 2.5, cost: 39200 },
  { brand: "青禾", line: "防晒", days: 3.5, media: 0.8, buy: 2.0, plan: 0.7, cost: 14000 },
  { brand: "青禾", line: "面膜", days: 2.0, media: 0.5, buy: 0.9, plan: 0.6, cost: 8000 },
  { brand: "青禾", line: "洁面", days: 0.8, media: 0.2, buy: 0.3, plan: 0.3, cost: 3200 },
  { brand: "北境智造", line: "主机", days: 4.5, media: 0.6, buy: 3.2, plan: 0.7, cost: 22500 },
  { brand: "北境智造", line: "配件", days: 1.6, media: 0.3, buy: 1.1, plan: 0.2, cost: 8000 },
  { brand: "北境智造", line: "智能音箱", days: 0.9, media: 0.2, buy: 0.5, plan: 0.2, cost: 4500 },
  { brand: "星澜茶", line: "礼盒", days: 2.4, media: 0.8, buy: 0.6, plan: 1.0, cost: 9600 },
  { brand: "星澜茶", line: "瓶装", days: 1.5, media: 0.4, buy: 0.5, plan: 0.6, cost: 6000 },
  { brand: "澄光护肤", line: "精华", days: 2.8, media: 0.7, buy: 1.2, plan: 0.9, cost: 11200 },
  { brand: "澄光护肤", line: "面霜", days: 1.2, media: 0.3, buy: 0.5, plan: 0.4, cost: 4800 },
  { brand: "岚屿家居", line: "香氛", days: 1.5, media: 0.3, buy: 0.5, plan: 0.7, cost: 6000 },
];

const TITLES = {
  fill: "周填报",
  "fill-cmp": "填报对比",
  mine: "我的填报",
  leader: "待我确认",
  project: "项目人力",
  brand: "品牌品线人力",
  master: "主数据来源",
};

function cloneRows(week) {
  return FILL_BY_WEEK[week].map((r) => ({ ...r }));
}

function cloneCmpRows(week) {
  return FILL_CMP_BY_WEEK[week].map((r) => ({ ...r }));
}

const state = {
  role: "filler",
  locked: false,
  submitted: true,
  week: "2026-W39",
  rows: cloneRows("2026-W39"),
  cmpWeek: "2026-W39",
  cmpRows: cloneCmpRows("2026-W39"),
  /** 我的填报：多周历史；W39 与当前填报同步 */
  history: [
    {
      week: "2026-W38",
      status: "locked",
      rows: cloneRows("2026-W38"),
    },
    {
      week: "2026-W39",
      status: "submitted",
      rows: cloneRows("2026-W39"),
    },
  ],
};

const roleMeta = {
  filler: { name: "林可 · 媒介", showCost: false },
  leader: { name: "周衡 · 华东投放组 Leader", showCost: false },
  finance: { name: "沈岚 · 财务", showCost: true },
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

function round1(n) {
  return Math.round(n * 10) / 10;
}

function go(page) {
  document.querySelectorAll(".page").forEach((p) => p.classList.toggle("active", p.id === "page-" + page));
  document.querySelectorAll(".a3-menu-item[data-page]").forEach((m) => m.classList.toggle("active", m.dataset.page === page));
  document.getElementById("crumb").textContent = TITLES[page];
  if (page === "fill") renderFill();
  if (page === "fill-cmp") renderFillCmp();
  if (page === "mine") renderMine();
  if (page === "leader") renderLeader();
  if (page === "project") renderProject();
  if (page === "brand") renderBrand();
  if (page === "master") renderMaster();
  if (page === "fill-cmp") location.hash = "fill-cmp";
  else if (location.hash === "#fill-cmp") history.replaceState(null, "", location.pathname + location.search);
}

document.querySelectorAll(".a3-menu-item[data-page]").forEach((m) => {
  m.addEventListener("click", () => go(m.dataset.page));
});

document.getElementById("role-select").addEventListener("change", (e) => {
  state.role = e.target.value;
  document.getElementById("user-chip").innerHTML = `<i class="fas fa-user"></i> ${roleMeta[state.role].name}`;
  const active = document.querySelector(".a3-menu-item.active");
  go(active ? active.dataset.page : "fill");
});

document.getElementById("fill-week").addEventListener("change", (e) => {
  const label = e.target.value;
  const week = label.startsWith("2026-W38") ? "2026-W38" : "2026-W39";
  if (week === state.week) return;
  // 切周前把当前编辑写回对应周底稿（演示用）
  FILL_BY_WEEK[state.week] = state.rows.map((r) => ({ ...r }));
  state.week = week;
  state.rows = cloneRows(week);
  state.locked = week === "2026-W38" ? true : state.history.find((h) => h.week === "2026-W39")?.status === "locked";
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

function renderFill() {
  const tbody = document.querySelector("#fill-table tbody");
  tbody.innerHTML = "";
  state.rows.forEach((row, i) => {
    const lines = LINES[row.brand] || [];
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><div class="a3-select-wrapper"><select class="a3-select" data-i="${i}" data-k="brand">${opts(BRANDS, row.brand)}</select><i class="fas fa-chevron-down a3-select-arrow"></i></div></td>
      <td><div class="a3-select-wrapper"><select class="a3-select" data-i="${i}" data-k="line">${opts(lines, row.line)}</select><i class="fas fa-chevron-down a3-select-arrow"></i></div></td>
      <td><div class="a3-select-wrapper"><select class="a3-select" data-i="${i}" data-k="group">${opts(GROUPS, row.group)}</select><i class="fas fa-chevron-down a3-select-arrow"></i></div></td>
      <td><div class="a3-select-wrapper"><select class="a3-select" data-i="${i}" data-k="type">${opts(BIZ_TYPES, row.type)}</select><i class="fas fa-chevron-down a3-select-arrow"></i></div></td>
      <td><div class="a3-input-wrapper"><input class="a3-input" type="number" min="0" max="40" step="0.5" value="${row.hours}" data-i="${i}" data-k="hours" /></div></td>
      <td><button type="button" class="a3-btn a3-btn-text a3-table-link" style="color:var(--a3-danger)" data-rm="${i}">删除</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll("select, input").forEach((el) => {
    el.addEventListener("change", () => {
      const i = +el.dataset.i;
      const k = el.dataset.k;
      if (k === "hours") state.rows[i].hours = Number(el.value);
      else state.rows[i][k] = el.value;
      if (k === "brand") {
        state.rows[i].line = (LINES[el.value] || [])[0] || "";
        renderFill();
      } else updateSum();
    });
  });
  tbody.querySelectorAll("[data-rm]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.rows.splice(+btn.dataset.rm, 1);
      renderFill();
    });
  });
  updateSum();
}

function updateSum() {
  document.getElementById("fill-sum").textContent = state.rows.reduce((s, r) => s + (Number(r.hours) || 0), 0);
}

document.getElementById("add-row").addEventListener("click", () => {
  state.rows.push({ brand: "青禾", line: "精华水", group: "华东投放组", type: "信息流投放", hours: 4 });
  renderFill();
});
document.getElementById("save-draft").addEventListener("click", () => toast("info", "已暂存"));
document.getElementById("submit-fill").addEventListener("click", () => {
  const t = state.rows.reduce((s, r) => s + (Number(r.hours) || 0), 0);
  if (!state.rows.length || t <= 0) return toast("warning", "请填写有效工时");
  if (state.week === "2026-W38") return toast("warning", "历史周已锁定，不可再次提交");
  state.submitted = true;
  state.locked = false;
  FILL_BY_WEEK[state.week] = state.rows.map((r) => ({ ...r }));
  syncHistoryCurrentWeek();
  toast("success", "提交成功。拆分结果仅业务组 Leader 可见。");
  go("mine");
});

function groupOpts(selected) {
  const placeholder = `<option value="" ${selected ? "" : "selected"} disabled>请先选择业务组</option>`;
  return placeholder + MARKETING_DEPTS.map((v) =>
    `<option value="${v}" ${v === selected ? "selected" : ""}>${v}</option>`
  ).join("");
}

function dimOpts(list, selected, enabled) {
  if (!enabled) {
    return `<option value="" selected disabled>请先选择业务组</option>`;
  }
  return opts(list, selected);
}

function updateCmpSum() {
  document.getElementById("fill-cmp-sum").textContent =
    state.cmpRows.reduce((s, r) => s + (Number(r.hours) || 0), 0);
}

function renderFillCmp() {
  const tbody = document.querySelector("#fill-cmp-table tbody");
  tbody.innerHTML = "";
  state.cmpRows.forEach((row, i) => {
    const hasGroup = Boolean(row.group);
    const lines = LINES[row.brand] || [];
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><div class="a3-select-wrapper"><select class="a3-select" data-i="${i}" data-k="group">${groupOpts(row.group)}</select><i class="fas fa-chevron-down a3-select-arrow"></i></div></td>
      <td><div class="a3-select-wrapper"><select class="a3-select" data-i="${i}" data-k="brand" ${hasGroup ? "" : "disabled"}>${dimOpts(BRANDS, row.brand, hasGroup)}</select><i class="fas fa-chevron-down a3-select-arrow"></i></div></td>
      <td><div class="a3-select-wrapper"><select class="a3-select" data-i="${i}" data-k="line" ${hasGroup ? "" : "disabled"}>${dimOpts(lines, row.line, hasGroup)}</select><i class="fas fa-chevron-down a3-select-arrow"></i></div></td>
      <td><div class="a3-select-wrapper"><select class="a3-select" data-i="${i}" data-k="type" ${hasGroup ? "" : "disabled"}>${dimOpts(BIZ_TYPES, row.type, hasGroup)}</select><i class="fas fa-chevron-down a3-select-arrow"></i></div></td>
      <td><div class="a3-input-wrapper"><input class="a3-input" type="number" min="0" max="40" step="0.5" value="${row.hours}" data-i="${i}" data-k="hours" ${hasGroup ? "" : "disabled"} /></div></td>
      <td><button type="button" class="a3-btn a3-btn-text a3-table-link" style="color:var(--a3-danger)" data-rm="${i}">删除</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll("select, input").forEach((el) => {
    el.addEventListener("change", () => {
      const i = +el.dataset.i;
      const k = el.dataset.k;
      if (k === "hours") state.cmpRows[i].hours = Number(el.value);
      else state.cmpRows[i][k] = el.value;
      if (k === "group") {
        // 选完业务组后才开放后续维度；保留已有品牌或给默认
        if (!state.cmpRows[i].brand) {
          state.cmpRows[i].brand = BRANDS[0];
          state.cmpRows[i].line = LINES[BRANDS[0]][0];
          state.cmpRows[i].type = BIZ_TYPES[0];
        }
        renderFillCmp();
      } else if (k === "brand") {
        state.cmpRows[i].line = (LINES[el.value] || [])[0] || "";
        renderFillCmp();
      } else updateCmpSum();
    });
  });
  tbody.querySelectorAll("[data-rm]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.cmpRows.splice(+btn.dataset.rm, 1);
      renderFillCmp();
    });
  });
  updateCmpSum();
}

document.getElementById("fill-cmp-week").addEventListener("change", (e) => {
  const week = e.target.value.startsWith("2026-W38") ? "2026-W38" : "2026-W39";
  if (week === state.cmpWeek) return;
  FILL_CMP_BY_WEEK[state.cmpWeek] = state.cmpRows.map((r) => ({ ...r }));
  state.cmpWeek = week;
  state.cmpRows = cloneCmpRows(week);
  renderFillCmp();
});

document.getElementById("add-cmp-row").addEventListener("click", () => {
  state.cmpRows.push({ group: "", brand: "", line: "", type: "", hours: 0 });
  renderFillCmp();
});
document.getElementById("save-cmp-draft").addEventListener("click", () => toast("info", "已暂存（对比方案）"));
document.getElementById("submit-cmp-fill").addEventListener("click", () => {
  const incomplete = state.cmpRows.some((r) => !r.group || !r.brand || !r.line || !r.type);
  if (incomplete) return toast("warning", "请先为每行选择业务组，再完善品牌品线与业务类型");
  const t = state.cmpRows.reduce((s, r) => s + (Number(r.hours) || 0), 0);
  if (!state.cmpRows.length || t <= 0) return toast("warning", "请填写有效工时");
  FILL_CMP_BY_WEEK[state.cmpWeek] = state.cmpRows.map((r) => ({ ...r }));
  toast("success", "对比方案已提交（演示）。可切回「周填报」对照旧维度。");
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
    tbody.innerHTML = `<tr><td colspan="7"><div class="a3-empty"><i class="fas fa-inbox"></i><div class="a3-empty-text">暂无提交记录，请先在「周填报」提交</div></div></td></tr>`;
    return;
  }
  tbody.innerHTML = entries.flatMap((h) =>
    h.rows.map((r) => `
      <tr>
        <td>${h.week}</td>
        <td>${r.brand}</td>
        <td>${r.line}</td>
        <td>${r.group}</td>
        <td>${r.type}</td>
        <td>${r.hours}</td>
        <td>${statusTag(h.status)}</td>
      </tr>
    `)
  ).join("");
}

function expandParts(person, brand, line, type, filled, parts) {
  return parts.map((p) => ({
    person,
    brand: `${brand} / ${line}`,
    type,
    filled,
    project: p.project,
    order: p.order,
    pct: Math.round(p.w * 100) + "%",
    hours: round1(filled * p.w),
  }));
}

function buildSplits() {
  const east = state.rows.filter((r) => r.group === "华东投放组");
  const out = [];
  east.forEach((r) => {
    const parts = SPLIT_CATALOG[`${r.brand}|${r.line}|${r.type}`] || [{ project: "待匹配项目", order: "—", w: 1 }];
    out.push(...expandParts("林可", r.brand, r.line, r.type, r.hours, parts));
  });
  // 仅在看本周待确认时附带组内其他人；历史周只展示林可
  if (state.week === "2026-W39") {
    TEAM_EAST_EXTRAS.forEach((m) => {
      out.push(...expandParts(m.person, m.brand, m.line, m.type, m.filled, m.parts));
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
  const hours = round1(splits.reduce((s, r) => s + r.hours, 0));
  document.getElementById("leader-hours").textContent = hours + "h";
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
  document.getElementById("md-groups").textContent =
    "周填报：" + GROUPS.join("、") + "；填报对比：" + MARKETING_DEPTS.join("、");
  document.getElementById("md-types").textContent = BIZ_TYPES.join("、") + "（=执行单类型）";
}

document.querySelectorAll(".cost-col").forEach((el) => { el.style.display = "none"; });
if (location.hash === "#fill-cmp") go("fill-cmp");
else renderFill();
