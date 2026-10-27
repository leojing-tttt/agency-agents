/* MCP 工具观测台 demo — A3 SaaS UI 演示层
 * 方案 A MVP：总览 / 调用流水 / 详情抽屉 / 工具档案
 * 一行 = 一次 tools/call；Mock 数据，无真实 MCP 后端
 */

const DEMO_USER = { id: "u_lin_ke", name: "林可", tenant: "tenant_a3" };
const DEMO_ADMIN = { name: "顾澄" };

/** 工具档案主数据：id = tools/call name；中文名 / 创建人仅档案页展示 */
const TOOL_CATALOG = [
  { id: "search_brand", zh: "品牌检索", creator: "林可" },
  { id: "get_execution_order", zh: "执行单查询", creator: "周衡" },
  { id: "list_kol_candidates", zh: "KOL 候选列表", creator: "韩叙" },
  { id: "create_campaign_brief", zh: "创建战役 Brief", creator: "林可" },
  { id: "query_invoice_status", zh: "发票状态查询", creator: "沈岚" },
  { id: "sync_crm_lead", zh: "同步 CRM 线索", creator: "周衡" },
  { id: "fetch_opinion_report", zh: "拉取舆情报告", creator: "韩叙" },
];
const TOOLS = TOOL_CATALOG.map((t) => t.id);
const TOOL_META = Object.fromEntries(TOOL_CATALOG.map((t) => [t.id, t]));

function toolMeta(id) {
  return TOOL_META[id] || { id, zh: id, creator: "—" };
}

const PLATFORMS = [
  { id: "cursor", label: "Cursor" },
  { id: "claude-desktop", label: "Claude Desktop" },
  { id: "custom-agent", label: "Custom Agent" },
  { id: "unknown", label: "Unknown" },
];

const CALLERS = [
  { id: "u_lin_ke", label: "林可", tenant: "tenant_a3", key: "key_…a91c" },
  { id: "u_zhou_heng", label: "周衡", tenant: "tenant_a3", key: "key_…b302" },
  { id: "u_shen_lan", label: "沈岚", tenant: "tenant_a3", key: "key_…c7ef" },
  { id: "svc_agent_bot", label: "agent-bot", tenant: "tenant_a3", key: "key_…d114" },
  { id: "u_han_xu", label: "韩叙", tenant: "tenant_geo", key: "key_…e88a" },
];

const STATUSES = ["success", "error", "timeout", "canceled"];

function pad(n) {
  return String(n).padStart(2, "0");
}

function fmtTs(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function toLocalInput(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Demo 默认展示完整 arguments / result（非脱敏），便于评审真实 payload 形态 */
function buildFullPayload(tool, h, status) {
  const brands = ["好奇", "高洁丝", "康王"];
  const brand = brands[h % 3];
  const orderId = `EO-${10000 + (h % 900)}`;
  const argsByTool = {
    search_brand: {
      brand_name: brand,
      product_line: brand === "好奇" ? "小森林" : brand === "高洁丝" ? "卫生巾" : "酮康唑洗发水",
      fuzzy: true,
      limit: 20,
      locale: "zh-CN",
    },
    get_execution_order: {
      order_id: orderId,
      include_lines: true,
      include_attachments: false,
    },
    list_kol_candidates: {
      brand,
      platforms: ["xiaohongshu", "douyin"],
      followers_min: 50000,
      tags: ["母婴", "种草"],
      page: 1,
      page_size: 20,
    },
    create_campaign_brief: {
      campaign_name: `${brand} Q4 种草战役`,
      brand,
      objective: "awareness",
      budget_cny: 120000 + (h % 50) * 1000,
      start_date: "2026-10-01",
      end_date: "2026-10-31",
      owner_email: "lin.ke@example.com",
    },
    query_invoice_status: {
      order_id: orderId,
      invoice_no: `INV-2026-${1000 + (h % 800)}`,
      tax_id: "91310000MA1FL3XX0X",
    },
    sync_crm_lead: {
      lead_id: `LD-${80000 + (h % 9000)}`,
      name: "王敏",
      mobile: "13800138000",
      company: "金佰利中国",
      source: "mcp_agent",
      force: false,
    },
    fetch_opinion_report: {
      brand,
      keywords: [brand, "口碑", "差评"],
      range_days: 7,
      channels: ["weibo", "xiaohongshu", "news"],
      format: "json",
    },
  };
  const arguments_full = argsByTool[tool] || { tool };

  let result = null;
  let error_code = null;
  let error_message = null;

  if (status === "error") {
    error_code = ["TOOL_UPSTREAM_4XX", "VALIDATION_FAILED", "AUTH_DENIED"][h % 3];
    error_message =
      error_code === "VALIDATION_FAILED"
        ? `字段校验失败：brand_name「${brand}」不在主数据`
        : error_code === "AUTH_DENIED"
          ? "API Key 无权访问该租户资源"
          : `上游 HTTP 422：order ${orderId} 状态不允许查询`;
    result = {
      isError: true,
      content: [{ type: "text", text: error_message }],
      upstream: {
        status: error_code === "AUTH_DENIED" ? 403 : 422,
        body: { code: error_code, detail: error_message, request_echo: arguments_full },
      },
    };
  } else if (status === "timeout") {
    error_code = "GATEWAY_TIMEOUT";
    error_message = "tools/call 超过 30s 未返回";
    result = {
      isError: true,
      content: [{ type: "text", text: error_message }],
      partial: null,
    };
  } else if (status === "canceled") {
    error_code = "CLIENT_CANCELED";
    error_message = "客户端取消本次 tools/call";
    result = {
      isError: true,
      content: [{ type: "text", text: error_message }],
      canceled_at_ms: 200 + (h % 400),
    };
  } else {
    const successByTool = {
      search_brand: {
        isError: false,
        content: [{ type: "text", text: `找到 ${3 + (h % 5)} 条品牌品线` }],
        structuredContent: {
          total: 3 + (h % 5),
          items: [
            { brand_id: `B-${h % 90}`, brand_name: brand, product_lines: ["小森林", "深睡大师"] },
            { brand_id: `B-${(h % 90) + 1}`, brand_name: brand, product_lines: ["X系列"] },
          ],
        },
      },
      get_execution_order: {
        isError: false,
        content: [{ type: "text", text: `执行单 ${orderId} 详情` }],
        structuredContent: {
          order_id: orderId,
          status: "confirmed",
          brand,
          amount_cny: 35800.5,
          lines: [
            { sku: "KOL-一口价", qty: 2, amount_cny: 20000 },
            { sku: "制作费", qty: 1, amount_cny: 15800.5 },
          ],
        },
      },
      list_kol_candidates: {
        isError: false,
        content: [{ type: "text", text: "返回 20 条 KOL 候选" }],
        structuredContent: {
          total: 128,
          page: 1,
          candidates: [
            { kol_id: "K1001", name: "小桃妈日记", followers: 210000, score: 0.91 },
            { kol_id: "K1044", name: "育儿研究所", followers: 98000, score: 0.86 },
          ],
        },
      },
      create_campaign_brief: {
        isError: false,
        content: [{ type: "text", text: "战役 Brief 已创建" }],
        structuredContent: {
          brief_id: `BF-2026-${2000 + (h % 500)}`,
          status: "draft",
          share_url: `https://crm.example.com/briefs/BF-2026-${2000 + (h % 500)}`,
        },
      },
      query_invoice_status: {
        isError: false,
        content: [{ type: "text", text: "发票已开具" }],
        structuredContent: {
          invoice_no: `INV-2026-${1000 + (h % 800)}`,
          status: "issued",
          amount_cny: 41200,
          issued_at: "2026-10-20T08:12:00+08:00",
          pdf_url: "https://finance.example.com/invoices/INV-demo.pdf",
        },
      },
      sync_crm_lead: {
        isError: false,
        content: [{ type: "text", text: "线索已同步" }],
        structuredContent: {
          lead_id: `LD-${80000 + (h % 9000)}`,
          crm_id: `CRM-${50000 + (h % 4000)}`,
          synced: true,
          updated_fields: ["mobile", "company", "source"],
        },
      },
      fetch_opinion_report: {
        isError: false,
        content: [{ type: "text", text: `${brand} 近 7 日舆情摘要` }],
        structuredContent: {
          brand,
          sentiment: { pos: 0.62, neu: 0.28, neg: 0.1 },
          volume: 1840 + (h % 200),
          top_posts: [
            { platform: "xiaohongshu", title: `${brand} 实测分享`, heat: 9200 },
            { platform: "weibo", title: `${brand} 话题发酵`, heat: 6100 },
          ],
        },
      },
    };
    result = successByTool[tool] || { isError: false, content: [{ type: "text", text: "ok" }] };
  }

  return { arguments: arguments_full, result, error_code, error_message };
}

function buildMockEvents(count = 86) {
  const now = new Date(2026, 9, 26, 15, 20, 0); // 2026-10-26 15:20
  const events = [];
  for (let i = 0; i < count; i++) {
    const h = hashStr(`evt-${i}`);
    const tool = TOOLS[h % TOOLS.length];
    const platform = PLATFORMS[h % PLATFORMS.length];
    const caller = CALLERS[h % CALLERS.length];
    const statusRoll = h % 17;
    let status = "success";
    if (statusRoll === 0) status = "timeout";
    else if (statusRoll === 1 || statusRoll === 2) status = "error";
    else if (statusRoll === 3) status = "canceled";

    const minutesAgo = (h % 60) + i * 17;
    const start = new Date(now.getTime() - minutesAgo * 60 * 1000);
    const duration =
      status === "timeout" ? 30000 + (h % 5000) :
      status === "error" ? 80 + (h % 400) :
      40 + (h % 1800);

    const env = i % 11 === 0 ? "staging" : i % 19 === 0 ? "dev" : "prod";
    const payload = buildFullPayload(tool, h, status);

    events.push({
      event_id: `evt_${(100000 + i).toString(16)}`,
      ts_start: start.toISOString(),
      ts_end: new Date(start.getTime() + duration).toISOString(),
      duration_ms: duration,
      mcp_server_id: "mcp-biz-gateway-01",
      mcp_server_version: "1.4.2",
      tool_name: tool,
      status,
      error_code: payload.error_code,
      error_message: payload.error_message,
      arguments: payload.arguments,
      arguments_redacted: false,
      result: payload.result,
      result_is_error: status !== "success",
      client_platform: platform.id,
      client_name: platform.label,
      client_version: `0.${(h % 9) + 1}.${h % 5}`,
      caller_user_id: caller.id,
      caller_label: caller.label,
      caller_tenant_id: caller.tenant,
      api_key_id: caller.key,
      session_id: null,
      trace_id: null,
      request_id: `req_${(200000 + i).toString(16)}`,
      transport: "streamable_http",
      environment: env,
      tags: status === "error" ? ["need-review"] : [],
    });
  }
  return events.sort((a, b) => new Date(b.ts_start) - new Date(a.ts_start));
}

const ALL_EVENTS = buildMockEvents();

const state = {
  view: "admin", // admin | user
  page: "overview",
  env: "prod",
  window: "24h",
  filters: { tool: "", platform: "", status: "", caller: "", from: "", to: "" },
  pageSize: 12,
  pageIndex: 1,
  detailId: null,
};

const PAGE_TITLES = {
  overview: "总览",
  calls: "调用流水",
  tools: "工具档案",
  "my-calls": "我的调用",
};

/** KPI 白话提示（UI ?）；范围 = 当前环境 ∩ 时间窗。技术口径见 docs/prd */
const KPI_FORMULAS = {
  calls: "当前环境和时间窗里，一共发生了多少次工具调用。",
  error_rate: "失败调用占全部调用的比例。失败指报错或超时（不含用户取消）；没有调用时按 0% 显示。",
  p95: "把时间窗内所有调用耗时从小到大排好，取排在大约 95% 位置上的那个耗时。意思是约 95% 的调用不慢于该值，只有最慢约 5% 更慢。",
  active_tools: "时间窗里至少被调用过一次的不同工具有多少个。",
};

function tipIcon(html, side) {
  const sideCls = side ? " mo-hint-side" : "";
  return `<span class="mo-hint${sideCls}" tabindex="0" aria-label="计算公式"><i class="far fa-circle-question" aria-hidden="true"></i><span class="mo-hint-pop" role="tooltip">${html}</span></span>`;
}

function toast(type, msg) {
  const root = document.getElementById("toast-root");
  if (!root) return;
  const el = document.createElement("div");
  el.className = `mo-toast is-${type}`;
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

function statusTag(status) {
  const map = {
    success: "a3-tag-success",
    error: "a3-tag-danger",
    timeout: "a3-tag-warning",
    canceled: "a3-tag-default",
  };
  return `<span class="a3-tag ${map[status] || "a3-tag-default"}"><span class="a3-tag-dot"></span>${status}</span>`;
}

function platformLabel(id) {
  return (PLATFORMS.find((p) => p.id === id) || {}).label || id;
}

function eventsInEnv() {
  return ALL_EVENTS.filter((e) => e.environment === state.env);
}

function windowCutoff() {
  const newest = new Date(ALL_EVENTS[0].ts_start);
  const ms =
    state.window === "7d" ? 7 * 86400000 :
    state.window === "30d" ? 30 * 86400000 :
    24 * 3600000;
  return new Date(newest.getTime() - ms);
}

function eventsInWindow(list) {
  const cut = windowCutoff();
  return list.filter((e) => new Date(e.ts_start) >= cut);
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function applyCallFilters(list) {
  const f = state.filters;
  return list.filter((e) => {
    if (f.tool && e.tool_name !== f.tool) return false;
    if (f.platform && e.client_platform !== f.platform) return false;
    if (f.status && e.status !== f.status) return false;
    if (f.caller) {
      const q = f.caller.toLowerCase();
      const hay = `${e.caller_label} ${e.caller_user_id} ${e.caller_tenant_id} ${e.api_key_id}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.from && new Date(e.ts_start) < new Date(f.from)) return false;
    if (f.to && new Date(e.ts_start) > new Date(f.to)) return false;
    return true;
  });
}

function go(page) {
  if (state.view === "user" && page !== "my-calls") page = "my-calls";
  if (state.view === "admin" && page === "my-calls") page = "overview";
  state.page = page;
  document.querySelectorAll(".page").forEach((el) => el.classList.remove("active"));
  const sec = document.getElementById(`page-${page}`);
  if (sec) sec.classList.add("active");
  document.querySelectorAll("#mo-menu .a3-menu-item").forEach((li) => {
    li.classList.toggle("active", li.getAttribute("data-page") === page);
  });
  const crumb = document.getElementById("crumb");
  if (crumb) crumb.textContent = PAGE_TITLES[page] || page;
  location.hash = page;
  renderPage();
}

function syncViewChrome() {
  const isAdmin = state.view === "admin";
  document.querySelectorAll(".admin-nav").forEach((el) => {
    el.classList.toggle("mo-nav-hidden", !isAdmin);
    el.hidden = !isAdmin;
  });
  document.querySelectorAll(".user-nav").forEach((el) => {
    el.classList.toggle("mo-nav-hidden", isAdmin);
    el.hidden = isAdmin;
  });
  const chip = document.getElementById("user-chip");
  if (chip) {
    chip.innerHTML = isAdmin
      ? `<i class="fas fa-user-shield"></i> 管理员 · ${DEMO_ADMIN.name}`
      : `<i class="fas fa-user"></i> ${DEMO_USER.name} · 我的调用`;
  }
  document.getElementById("view-mode").value = state.view;
  document.getElementById("env-select").value = state.env;
  document.getElementById("env-select").disabled = !isAdmin;
}

function renderOverview() {
  const base = eventsInWindow(eventsInEnv());
  const total = base.length;
  const errors = base.filter((e) => e.status === "error" || e.status === "timeout").length;
  const errRate = total ? ((errors / total) * 100).toFixed(1) : "0.0";
  const durs = base.map((e) => e.duration_ms).sort((a, b) => a - b);
  const p95 = percentile(durs, 95);
  const activeTools = new Set(base.map((e) => e.tool_name)).size;

  document.getElementById("ov-kpi").innerHTML = `
    <div class="mo-kpi-card">
      <div class="mo-kpi-label"><span>调用数</span>${tipIcon(KPI_FORMULAS.calls, true)}</div>
      <div class="mo-kpi-value is-brand">${total}</div>
      <div class="mo-kpi-hint">当前环境 · ${state.window}</div>
    </div>
    <div class="mo-kpi-card">
      <div class="mo-kpi-label"><span>错误率</span>${tipIcon(KPI_FORMULAS.error_rate, true)}</div>
      <div class="mo-kpi-value">${errRate}%</div>
      <div class="mo-kpi-hint">报错+超时 ÷ 全部调用</div>
    </div>
    <div class="mo-kpi-card">
      <div class="mo-kpi-label"><span>P95 延迟</span>${tipIcon(KPI_FORMULAS.p95, true)}</div>
      <div class="mo-kpi-value">${p95} ms</div>
      <div class="mo-kpi-hint">约 95% 调用不慢于此</div>
    </div>
    <div class="mo-kpi-card">
      <div class="mo-kpi-label"><span>活跃工具</span>${tipIcon(KPI_FORMULAS.active_tools, true)}</div>
      <div class="mo-kpi-value">${activeTools}</div>
      <div class="mo-kpi-hint">被调用过的工具种数</div>
    </div>
  `;

  const byPlat = {};
  base.forEach((e) => { byPlat[e.client_platform] = (byPlat[e.client_platform] || 0) + 1; });
  const maxP = Math.max(1, ...Object.values(byPlat));
  document.getElementById("ov-platform").innerHTML = PLATFORMS.map((p) => {
    const n = byPlat[p.id] || 0;
    const pct = Math.round((n / maxP) * 100);
    return `<div class="mo-bar-row"><span>${p.label}</span><div class="mo-bar-track"><div class="mo-bar-fill" style="width:${pct}%"></div></div><span>${n}</span></div>`;
  }).join("") || `<p class="a3-text-secondary">暂无数据</p>`;

  const errByTool = {};
  base.filter((e) => e.status !== "success").forEach((e) => {
    errByTool[e.tool_name] = (errByTool[e.tool_name] || 0) + 1;
  });
  const topErr = Object.entries(errByTool).sort((a, b) => b[1] - a[1]).slice(0, 5);
  document.getElementById("ov-error-top").innerHTML = topErr.length
    ? topErr.map(([name, n]) => `
        <div class="mo-error-item">
          <button type="button" class="mo-linkish" data-filter-tool="${name}">${name}</button>
          <span class="a3-text-secondary">${n} 次异常</span>
        </div>`).join("")
    : `<p class="a3-text-secondary">窗口内无异常</p>`;

  const recent = base.filter((e) => e.status !== "success").slice(0, 5);
  const tb = document.querySelector("#ov-recent-errors tbody");
  tb.innerHTML = recent.length
    ? recent.map((e) => `
      <tr class="mo-row-click" data-open-id="${e.event_id}">
        <td>${fmtTs(new Date(e.ts_start))}</td>
        <td>${e.tool_name}</td>
        <td>${platformLabel(e.client_platform)}</td>
        <td>${e.caller_label}</td>
        <td>${statusTag(e.status)}</td>
        <td>${e.duration_ms} ms</td>
      </tr>`).join("")
    : `<tr><td colspan="6" class="a3-text-secondary">暂无异常</td></tr>`;
}

function fillFilterOptions() {
  const toolSel = document.getElementById("f-tool");
  const platSel = document.getElementById("f-platform");
  const curTool = state.filters.tool;
  const curPlat = state.filters.platform;
  toolSel.innerHTML = `<option value="">全部</option>` + TOOLS.map((t) => `<option value="${t}">${t}</option>`).join("");
  platSel.innerHTML = `<option value="">全部</option>` + PLATFORMS.map((p) => `<option value="${p.id}">${p.label}</option>`).join("");
  toolSel.value = curTool;
  platSel.value = curPlat;
  document.getElementById("f-status").value = state.filters.status;
  document.getElementById("f-caller").value = state.filters.caller;
  document.getElementById("f-from").value = state.filters.from;
  document.getElementById("f-to").value = state.filters.to;
}

function renderCalls() {
  fillFilterOptions();
  const filtered = applyCallFilters(eventsInEnv());
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / state.pageSize));
  if (state.pageIndex > pages) state.pageIndex = pages;
  const start = (state.pageIndex - 1) * state.pageSize;
  const slice = filtered.slice(start, start + state.pageSize);
  document.getElementById("calls-count").textContent = `共 ${total} 条 · 第 ${state.pageIndex}/${pages} 页`;
  const tb = document.querySelector("#calls-table tbody");
  tb.innerHTML = slice.length
    ? slice.map((e) => `
      <tr class="mo-row-click" data-open-id="${e.event_id}">
        <td>${fmtTs(new Date(e.ts_start))}</td>
        <td>
          <div>${e.caller_label}</div>
          <div class="a3-text-disabled" style="font-size:11px">${e.caller_tenant_id} · ${e.api_key_id}</div>
        </td>
        <td><code>${e.tool_name}</code></td>
        <td>${platformLabel(e.client_platform)}</td>
        <td>${statusTag(e.status)}</td>
        <td>${e.duration_ms} ms</td>
        <td><button type="button" class="a3-btn a3-btn-text a3-btn-sm" data-open-id="${e.event_id}">详情</button></td>
      </tr>`).join("")
    : `<tr><td colspan="7" class="a3-text-secondary">无匹配调用</td></tr>`;

  const pager = document.getElementById("calls-pager");
  pager.innerHTML = `
    <button type="button" class="a3-btn a3-btn-default a3-btn-sm" id="pg-prev" ${state.pageIndex <= 1 ? "disabled" : ""}>上一页</button>
    <span class="a3-text-secondary" style="margin:0 12px">${state.pageIndex} / ${pages}</span>
    <button type="button" class="a3-btn a3-btn-default a3-btn-sm" id="pg-next" ${state.pageIndex >= pages ? "disabled" : ""}>下一页</button>
  `;
  document.getElementById("pg-prev")?.addEventListener("click", () => {
    state.pageIndex -= 1;
    renderCalls();
  });
  document.getElementById("pg-next")?.addEventListener("click", () => {
    state.pageIndex += 1;
    renderCalls();
  });
}

function aggregateTools(list) {
  const lastByTool = {};
  list.forEach((e) => {
    const prev = lastByTool[e.tool_name];
    if (!prev || new Date(e.ts_start) > new Date(prev)) lastByTool[e.tool_name] = e.ts_start;
  });
  // 档案以主数据为准；无调用的工具 last 为空
  return TOOL_CATALOG.map((meta) => ({
    tool: meta.id,
    zh: meta.zh,
    creator: meta.creator,
    last: lastByTool[meta.id] || null,
  })).sort((a, b) => {
    if (!a.last && !b.last) return a.tool.localeCompare(b.tool);
    if (!a.last) return 1;
    if (!b.last) return -1;
    return new Date(b.last) - new Date(a.last);
  });
}

function renderTools() {
  const q = (document.getElementById("tools-search").value || "").trim().toLowerCase();
  let rows = aggregateTools(eventsInEnv());
  if (q) {
    rows = rows.filter((r) =>
      r.tool.toLowerCase().includes(q) ||
      r.zh.toLowerCase().includes(q) ||
      r.creator.toLowerCase().includes(q)
    );
  }
  const tb = document.querySelector("#tools-table tbody");
  tb.innerHTML = rows.map((r) => `
    <tr>
      <td><code>${r.tool}</code></td>
      <td>${r.zh}</td>
      <td>${r.creator}</td>
      <td>${r.last ? fmtTs(new Date(r.last)) : "—"}</td>
      <td><button type="button" class="a3-btn a3-btn-text a3-btn-sm" data-filter-tool="${r.tool}">查看流水</button></td>
    </tr>`).join("") || `<tr><td colspan="5" class="a3-text-secondary">暂无工具</td></tr>`;
}

function renderMyCalls() {
  const mine = eventsInEnv().filter((e) => e.caller_user_id === DEMO_USER.id).slice(0, 40);
  const tb = document.querySelector("#my-calls-table tbody");
  tb.innerHTML = mine.length
    ? mine.map((e) => `
      <tr class="mo-row-click" data-open-id="${e.event_id}">
        <td>${fmtTs(new Date(e.ts_start))}</td>
        <td><code>${e.tool_name}</code></td>
        <td>${platformLabel(e.client_platform)}</td>
        <td>${statusTag(e.status)}</td>
        <td>${e.duration_ms} ms</td>
        <td><button type="button" class="a3-btn a3-btn-text a3-btn-sm" data-open-id="${e.event_id}">详情</button></td>
      </tr>`).join("")
    : `<tr><td colspan="6" class="a3-text-secondary">你还没有调用记录</td></tr>`;
}

function openDetail(id) {
  const e = ALL_EVENTS.find((x) => x.event_id === id);
  if (!e) return;
  state.detailId = id;
  const mask = document.getElementById("detail-mask");
  const drawer = document.getElementById("detail-drawer");
  mask.classList.add("show");
  mask.setAttribute("aria-hidden", "false");
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  document.getElementById("detail-title").textContent = `调用详情 · ${e.tool_name}`;
  document.getElementById("detail-body").innerHTML = `
    <div class="a3-mb-12">${statusTag(e.status)}
      <span class="a3-tag a3-tag-info" style="margin-left:6px"><span class="a3-tag-dot"></span>Demo 完整 payload</span>
    </div>
    <dl class="mo-meta-grid">
      <dt>event_id</dt><dd><code>${e.event_id}</code></dd>
      <dt>request_id</dt><dd><code>${e.request_id || "—"}</code></dd>
      <dt>时间</dt><dd>${fmtTs(new Date(e.ts_start))} → ${fmtTs(new Date(e.ts_end))}（${e.duration_ms} ms）</dd>
      <dt>调用方</dt><dd>${e.caller_label} · ${e.caller_user_id}<br/><span class="a3-text-disabled">${e.caller_tenant_id} · ${e.api_key_id}</span></dd>
      <dt>平台</dt><dd>${platformLabel(e.client_platform)} · ${e.client_name} ${e.client_version}</dd>
      <dt>MCP Server</dt><dd>${e.mcp_server_id} @ ${e.mcp_server_version} · ${e.environment}</dd>
      <dt>transport</dt><dd>${e.transport}</dd>
      <dt>session_id</dt><dd class="a3-text-disabled">${e.session_id || "（空 · 本期不做 Trace）"}</dd>
      <dt>trace_id</dt><dd class="a3-text-disabled">${e.trace_id || "（空）"}</dd>
      ${e.error_code ? `<dt>错误</dt><dd><code>${e.error_code}</code> · ${e.error_message || ""}</dd>` : ""}
    </dl>
    <div class="mo-section-label">参数（arguments · 完整）</div>
    <pre class="mo-json">${escapeHtml(JSON.stringify(e.arguments, null, 2))}</pre>
    <div class="mo-section-label">结果（result · 完整）</div>
    <pre class="mo-json">${escapeHtml(JSON.stringify(e.result, null, 2))}</pre>
  `;
}

function closeDetail() {
  state.detailId = null;
  const mask = document.getElementById("detail-mask");
  const drawer = document.getElementById("detail-drawer");
  mask.classList.remove("show");
  mask.setAttribute("aria-hidden", "true");
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
}

function renderPage() {
  syncViewChrome();
  if (state.page === "overview") renderOverview();
  else if (state.page === "calls") renderCalls();
  else if (state.page === "tools") renderTools();
  else if (state.page === "my-calls") renderMyCalls();
}

function jumpToToolCalls(tool) {
  state.view = "admin";
  state.filters.tool = tool;
  state.pageIndex = 1;
  syncViewChrome();
  go("calls");
}

/* —— 产品文档 —— */
const PRD_DOCS = [
  {
    id: "observatory",
    title: "MCP 工具观测台",
    desc: "总览、调用流水、工具档案、管理员/用户视图、验收",
    file: "prd-observatory.md",
    path: "docs/prd-observatory.md",
  },
  {
    id: "all",
    title: "合集（推荐给 AI）",
    desc: "PRD 合并，一次下载即可喂给 AI",
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
    <button type="button" class="mo-docs-item${docsState.current === d.id ? " active" : ""}" data-doc-id="${d.id}">
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

/* —— 事件绑定 —— */
document.querySelectorAll("#mo-menu .a3-menu-item").forEach((li) => {
  li.addEventListener("click", () => go(li.getAttribute("data-page")));
});

document.getElementById("view-mode").addEventListener("change", (e) => {
  state.view = e.target.value;
  go(state.view === "user" ? "my-calls" : "overview");
});

document.getElementById("env-select").addEventListener("change", (e) => {
  state.env = e.target.value;
  state.pageIndex = 1;
  renderPage();
  toast("success", `已切换环境 · ${state.env}`);
});

document.getElementById("ov-window")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-window]");
  if (!btn) return;
  state.window = btn.getAttribute("data-window");
  document.querySelectorAll("#ov-window .mo-seg-btn").forEach((b) => {
    b.classList.toggle("active", b === btn);
  });
  renderOverview();
});

document.getElementById("ov-refresh")?.addEventListener("click", () => {
  renderOverview();
  toast("success", "已刷新（Mock）");
});

document.getElementById("f-query")?.addEventListener("click", () => {
  state.filters = {
    tool: document.getElementById("f-tool").value,
    platform: document.getElementById("f-platform").value,
    status: document.getElementById("f-status").value,
    caller: document.getElementById("f-caller").value.trim(),
    from: document.getElementById("f-from").value,
    to: document.getElementById("f-to").value,
  };
  state.pageIndex = 1;
  renderCalls();
});

document.getElementById("f-reset")?.addEventListener("click", () => {
  state.filters = { tool: "", platform: "", status: "", caller: "", from: "", to: "" };
  state.pageIndex = 1;
  renderCalls();
});

document.getElementById("tools-search")?.addEventListener("input", () => renderTools());

document.body.addEventListener("click", (e) => {
  const goto = e.target.closest("[data-goto]");
  if (goto) {
    go(goto.getAttribute("data-goto"));
    return;
  }
  const filterTool = e.target.closest("[data-filter-tool]");
  if (filterTool) {
    jumpToToolCalls(filterTool.getAttribute("data-filter-tool"));
    return;
  }
  const open = e.target.closest("[data-open-id]");
  if (open) {
    openDetail(open.getAttribute("data-open-id"));
  }
});

document.getElementById("detail-close")?.addEventListener("click", closeDetail);
document.getElementById("detail-done")?.addEventListener("click", closeDetail);
document.getElementById("detail-mask")?.addEventListener("click", closeDetail);
document.getElementById("detail-copy-id")?.addEventListener("click", async () => {
  if (!state.detailId) return;
  try {
    await navigator.clipboard.writeText(state.detailId);
    toast("success", `已复制 ${state.detailId}`);
  } catch (_) {
    toast("danger", "复制失败");
  }
});

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
  if (e.key === "Escape") {
    closeDocsDrawer();
    closeDetail();
  }
});

window.addEventListener("hashchange", () => {
  const h = (location.hash || "").replace("#", "");
  if (h === "settings") {
    go("overview");
    return;
  }
  if (PAGE_TITLES[h]) {
    if (h === "my-calls") state.view = "user";
    else if (state.view === "user" && h !== "my-calls") state.view = "admin";
    go(h);
  }
});

/* boot */
(function boot() {
  const newest = new Date(ALL_EVENTS[0].ts_start);
  const oldest = new Date(ALL_EVENTS[ALL_EVENTS.length - 1].ts_start);
  document.getElementById("f-from").min = toLocalInput(oldest);
  document.getElementById("f-to").max = toLocalInput(newest);
  const h = (location.hash || "").replace("#", "");
  if (h === "settings") {
    go("overview");
  } else if (h === "my-calls") {
    state.view = "user";
    go("my-calls");
  } else if (PAGE_TITLES[h]) {
    go(h);
  } else {
    go("overview");
  }
})();
