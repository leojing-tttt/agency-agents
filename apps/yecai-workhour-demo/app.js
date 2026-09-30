/* 业财工时归集 demo logic — A3 SaaS UI chrome in index.html */

const BRANDS = ["青禾", "北境智造", "星澜茶"];
const LINES = {
  青禾: ["精华水", "面膜", "防晒"],
  北境智造: ["主机", "配件"],
  星澜茶: ["瓶装", "礼盒"],
};
const GROUPS = ["华东投放组", "内容策划组", "媒介采买组", "设计策略组"];
const BIZ_TYPES = ["信息流投放", "内容种草", "媒介采买", "设计制作", "策略策划"];

const TITLES = {
  fill: "周填报",
  mine: "我的填报",
  leader: "待我确认",
  project: "项目人力",
  brand: "品牌品线人力",
  master: "主数据来源",
};

const state = {
  role: "filler",
  locked: false,
  submitted: false,
  rows: [
    { brand: "青禾", line: "精华水", group: "华东投放组", type: "信息流投放", hours: 16 },
    { brand: "青禾", line: "精华水", group: "内容策划组", type: "内容种草", hours: 8 },
    { brand: "北境智造", line: "主机", group: "媒介采买组", type: "媒介采买", hours: 12 },
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

function go(page) {
  document.querySelectorAll(".page").forEach((p) => p.classList.toggle("active", p.id === "page-" + page));
  document.querySelectorAll(".a3-menu-item[data-page]").forEach((m) => m.classList.toggle("active", m.dataset.page === page));
  document.getElementById("crumb").textContent = TITLES[page];
  if (page === "fill") renderFill();
  if (page === "mine") renderMine();
  if (page === "leader") renderLeader();
  if (page === "project") renderProject();
  if (page === "brand") renderBrand();
  if (page === "master") renderMaster();
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
  state.submitted = true;
  state.locked = false;
  toast("success", "提交成功。拆分结果仅业务组 Leader 可见。");
  go("mine");
});

function renderMine() {
  const tbody = document.querySelector("#mine-table tbody");
  if (!state.submitted) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="a3-empty"><i class="fas fa-inbox"></i><div class="a3-empty-text">暂无提交记录，请先在「周填报」提交</div></div></td></tr>`;
    return;
  }
  const status = state.locked
    ? '<span class="a3-tag a3-tag-success"><span class="a3-tag-dot"></span>已锁定</span>'
    : '<span class="a3-tag a3-tag-info"><span class="a3-tag-dot"></span>已提交</span>';
  tbody.innerHTML = state.rows.map((r) => `
    <tr>
      <td>2026-W39</td>
      <td>${r.brand}</td>
      <td>${r.line}</td>
      <td>${r.group}</td>
      <td>${r.type}</td>
      <td>${r.hours}</td>
      <td>${status}</td>
    </tr>
  `).join("");
}

function buildSplits() {
  const east = state.rows.filter((r) => r.group === "华东投放组");
  const catalog = {
    "青禾|精华水|信息流投放": [
      { project: "青禾精华 Q3 种草", order: "ZX-东投-0918", w: 0.62 },
      { project: "青禾精华 会员日", order: "ZX-东投-0922", w: 0.38 },
    ],
  };
  const out = [];
  east.forEach((r) => {
    const parts = catalog[`${r.brand}|${r.line}|${r.type}`] || [{ project: "待匹配项目", order: "—", w: 1 }];
    parts.forEach((p) => {
      out.push({
        person: "林可",
        brand: `${r.brand} / ${r.line}`,
        type: r.type,
        filled: r.hours,
        project: p.project,
        order: p.order,
        pct: Math.round(p.w * 100) + "%",
        hours: Math.round(r.hours * p.w * 10) / 10,
      });
    });
  });
  if (east.length) {
    out.push({
      person: "陈屿", brand: "青禾 / 精华水", type: "信息流投放",
      filled: 10, project: "青禾精华 Q3 种草", order: "ZX-东投-0918", pct: "100%", hours: 10,
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
  const hours = splits.reduce((s, r) => s + r.hours, 0);
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
  toast("success", "已确认锁定，纳入人效统计");
  renderLeader();
});

function renderProject() {
  const showCost = roleMeta[state.role].showCost;
  document.querySelectorAll("#project-table .cost-col").forEach((el) => {
    el.style.display = showCost ? "" : "none";
  });
  const rows = [
    { project: "青禾精华 Q3 种草", brand: "青禾 / 精华水", types: "信息流投放、内容种草", days: 4.2, cost: 16800 },
    { project: "青禾精华 会员日", brand: "青禾 / 精华水", types: "信息流投放", days: 1.1, cost: 4400 },
    { project: "北境主机 双11 预热", brand: "北境智造 / 主机", types: "媒介采买", days: 2.5, cost: 12500 },
  ];
  document.querySelector("#project-table tbody").innerHTML = rows.map((r) => `
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
  const rows = [
    { brand: "青禾", line: "精华水", days: 5.3, media: 1.2, buy: 2.5, plan: 1.6, cost: 21200 },
    { brand: "青禾", line: "面膜", days: 1.0, media: 0.3, buy: 0.4, plan: 0.3, cost: 4000 },
    { brand: "北境智造", line: "主机", days: 2.5, media: 0.5, buy: 1.8, plan: 0.2, cost: 12500 },
  ];
  document.querySelector("#brand-table tbody").innerHTML = rows.map((r) => `
    <tr>
      <td>${r.brand}</td><td>${r.line}</td><td>${r.days}</td>
      <td>${r.media}</td><td>${r.buy}</td><td>${r.plan}</td>
      <td class="cost-col" style="display:${showCost ? "" : "none"}">${r.cost.toLocaleString()}</td>
    </tr>`).join("");
}

function renderMaster() {
  document.getElementById("md-brands").textContent = BRANDS.join("、");
  document.getElementById("md-lines").textContent = Object.entries(LINES).map(([b, ls]) => `${b}→${ls.join("/")}`).join("；");
  document.getElementById("md-groups").textContent = GROUPS.join("、");
  document.getElementById("md-types").textContent = BIZ_TYPES.join("、") + "（=执行单类型）";
}

renderFill();
document.querySelectorAll(".cost-col").forEach((el) => { el.style.display = "none"; });
