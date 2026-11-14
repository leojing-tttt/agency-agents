/* 演示层交互。产品落地：React 状态 + antd Modal / ProTable / message。 */
(function () {
  const STORAGE_KEY = "a3-cm-competitors-v2";
  const DISPLAY_TZ = "Asia/Shanghai";

  const PRD_DOCS = [
    {
      id: "overview",
      title: "总览与边界",
      desc: "承诺、角色、MVP",
      file: "prd-overview.md",
      path: "docs/prd-overview.md",
    },
    {
      id: "list",
      title: "列表与配置",
      desc: "新建 / 频次 / 上限 / 分层",
      file: "prd-list-create.md",
      path: "docs/prd-list-create.md",
    },
    {
      id: "detail",
      title: "详情与看板",
      desc: "走势 / 金字塔 / 词云 / 笔记",
      file: "prd-detail-dashboard.md",
      path: "docs/prd-detail-dashboard.md",
    },
    {
      id: "backend",
      title: "后端交接契约",
      desc: "对象、字段、调度",
      file: "prd-backend-contract.md",
      path: "docs/prd-backend-contract.md",
    },
    {
      id: "design",
      title: "设计规格",
      desc: "A3 演示层视觉",
      file: "design-spec.md",
      path: "docs/design-spec.md",
    },
    {
      id: "all",
      title: "合集（推荐给 AI）",
      desc: "一次下载全部",
      file: "prd-all.md",
      path: "docs/prd-all.md",
    },
  ];

  /** @type {any[]} */
  let competitors = [];
  let editingId = null;
  let deletingId = null;
  let draftKeywords = [];
  let currentDetailId = null;
  let trendChart = null;
  let filterStart = "";
  let filterEnd = "";
  let docsCurrent = PRD_DOCS.find((d) => d.id === "all");

  const seed = () => [
    {
      id: "c_seed_1",
      brand: "花语堂",
      keywords: ["花语堂", "花语精华", "花语屏障"],
      frequency: "biweekly",
      limitPerKeyword: 100,
      tierBottomMax: 10000,
      tierMidMax: 500000,
      enabled: true,
      status: "updated",
      lastUpdatedAt: "2026-11-12T10:00:00+08:00",
      noteCount: 86,
      engagementTotal: 128400,
      notes: mockNotes("花语堂", 10000, 500000),
      trend: mockTrend(86),
      words: mockWords(["屏障", "修护", "精华", "敏感肌", "种草", "成分", "回购", "实测", "冬日", "面霜"]),
    },
    {
      id: "c_seed_2",
      brand: "澄光生物",
      keywords: ["澄光", "澄光维C"],
      frequency: "weekly",
      limitPerKeyword: 50,
      tierBottomMax: 5000,
      tierMidMax: 200000,
      enabled: true,
      status: "running",
      lastUpdatedAt: "2026-11-13T18:30:00+08:00",
      noteCount: 41,
      engagementTotal: 56200,
      notes: mockNotes("澄光", 5000, 200000),
      trend: mockTrend(41),
      words: mockWords(["维C", "提亮", "抗氧化", "早C晚A", "肤色", "安瓶", "测评", "干皮", "油皮", "上脸"]),
    },
  ];

  function formatInTz(date, opts) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: DISPLAY_TZ, ...opts }).format(date);
  }

  /** YYYY-MM-DD in Asia/Shanghai */
  function localDateKey(date) {
    return formatInTz(date, { year: "numeric", month: "2-digit", day: "2-digit" });
  }

  /** YYYY-MM-DD HH:mm in Asia/Shanghai */
  function formatDisplayDateTime(value) {
    if (!value) return "—";
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    const day = localDateKey(d);
    const time = formatInTz(d, { hour: "2-digit", minute: "2-digit", hour12: false });
    return `${day} ${time}`;
  }

  function mockTrend(base) {
    const points = [];
    const now = new Date("2026-11-14T00:00:00+08:00");
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 14);
      const notes = Math.max(8, Math.round(base / 6 + (Math.random() * 12 - 4)));
      const engagement = notes * (800 + Math.round(Math.random() * 900));
      points.push({
        date: localDateKey(d),
        noteCount: notes,
        engagement,
      });
    }
    return points;
  }

  function mockWords(list) {
    return list.map((w, i) => ({ text: w, weight: 28 - i * 2 }));
  }

  function mockNotes(brand, bottomMax, midMax) {
    const authors = [
      { name: "小鹿测评", fans: 3200 },
      { name: "护肤日记本", fans: 28000 },
      { name: "成分研究员K", fans: 160000 },
      { name: "美妆大V阿柠", fans: 820000 },
      { name: "干皮自救指南", fans: 6500 },
      { name: "中腰达人Mia", fans: 95000 },
    ];
    return authors.map((a, idx) => {
      const liked = 120 + idx * 340;
      const collected = 40 + idx * 90;
      const commented = 10 + idx * 22;
      return {
        id: `n_${brand}_${idx}`,
        publishedAt: `2026-11-${String(8 + idx).padStart(2, "0")} 21:${10 + idx}`,
        title: `${brand} 实测｜第 ${idx + 1} 篇种草笔记`,
        author: a.name,
        fans: a.fans,
        tier: tierOf(a.fans, bottomMax, midMax),
        liked,
        collected,
        commented,
        matchedKeyword: brand,
      };
    });
  }

  function tierOf(fans, bottomMax, midMax) {
    if (fans < bottomMax) return "底部";
    if (fans < midMax) return "中腰";
    return "头部";
  }

  function uid() {
    return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        competitors = JSON.parse(raw);
        return;
      }
    } catch (_) {
      /* ignore */
    }
    competitors = seed();
    save();
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(competitors));
  }

  function freqLabel(f) {
    return f === "weekly" ? "每一周" : "每两周";
  }

  function statusTag(status) {
    if (status === "running") {
      return '<span class="a3-tag a3-tag-info"><span class="a3-tag-dot"></span>抓取中</span>';
    }
    if (status === "failed") {
      return '<span class="a3-tag a3-tag-danger"><span class="a3-tag-dot"></span>失败</span>';
    }
    if (status === "paused") {
      return '<span class="a3-tag a3-tag-default"><span class="a3-tag-dot"></span>已停用</span>';
    }
    if (status === "idle") {
      return '<span class="a3-tag a3-tag-warning"><span class="a3-tag-dot"></span>待首次抓取</span>';
    }
    return '<span class="a3-tag a3-tag-success"><span class="a3-tag-dot"></span>已更新</span>';
  }

  function displayStatus(item) {
    if (!item.enabled) return "paused";
    return item.status || "idle";
  }

  function statusAfterEnableToggle(enabled, prev) {
    if (!enabled) return "paused";
    if (prev.status === "paused" || !prev.status) {
      const hasNotes = (prev.noteCount || 0) > 0 || (prev.notes && prev.notes.length > 0);
      return hasNotes ? "updated" : "idle";
    }
    return prev.status;
  }

  function formatFans(n) {
    if (n >= 10000) return `${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}万`;
    return String(n);
  }

  function openModal(id) {
    document.getElementById(id).classList.add("show");
    document.body.style.overflow = "hidden";
  }

  function closeModal(id) {
    document.getElementById(id).classList.remove("show");
    document.body.style.overflow = "";
  }

  function renderKeywords() {
    const box = document.getElementById("kw-tags");
    box.innerHTML = draftKeywords
      .map(
        (k, i) =>
          `<span class="cm-kw-tag">${escapeHtml(k)}<button type="button" data-rm-kw="${i}" aria-label="移除">&times;</button></span>`
      )
      .join("");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function addKeyword() {
    const input = document.getElementById("field-kw-input");
    const v = input.value.trim();
    if (!v) return;
    if (draftKeywords.includes(v)) {
      input.value = "";
      return;
    }
    draftKeywords.push(v);
    input.value = "";
    renderKeywords();
  }

  function totalEngagement(notes) {
    return (notes || []).reduce((s, n) => s + n.liked + n.collected + n.commented, 0);
  }

  function parseNoteTime(publishedAt) {
    if (!publishedAt) return null;
    if (publishedAt instanceof Date) return publishedAt;
    const normalized = String(publishedAt).trim().replace(" ", "T");
    const withZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized)
      ? normalized
      : `${normalized.length === 16 ? `${normalized}:00` : normalized}+08:00`;
    const d = new Date(withZone);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function noteInRange(note, startStr, endStr) {
    const t = parseNoteTime(note.publishedAt);
    if (!t) return false;
    const ms = t.getTime();
    const start = startStr ? new Date(`${startStr}T00:00:00+08:00`).getTime() : -Infinity;
    const end = endStr ? new Date(`${endStr}T23:59:59.999+08:00`).getTime() : Infinity;
    return ms >= start && ms <= end;
  }

  function filteredNotes(item) {
    return (item.notes || []).filter((n) => noteInRange(n, filterStart, filterEnd));
  }

  function defaultFilterRange(item) {
    const notes = item.notes || [];
    if (!notes.length) {
      const today = localDateKey(new Date());
      return { start: today, end: today };
    }
    let min = Infinity;
    let max = -Infinity;
    notes.forEach((n) => {
      const d = parseNoteTime(n.publishedAt);
      if (!d) return;
      const ms = d.getTime();
      if (ms < min) min = ms;
      if (ms > max) max = ms;
    });
    return {
      start: localDateKey(new Date(min)),
      end: localDateKey(new Date(max)),
    };
  }

  function renderConfigSummary(item) {
    const box = document.getElementById("config-summary");
    if (!item) {
      box.classList.add("cm-hidden");
      return;
    }
    box.classList.remove("cm-hidden");
    document.getElementById("cfg-keywords").textContent = item.keywords.join("、") || "—";
    document.getElementById("cfg-freq").textContent = freqLabel(item.frequency);
    document.getElementById("cfg-limit-sub").textContent = `上限 ${item.limitPerKeyword}/词 · 时间排序`;
    document.getElementById("cfg-note-count").textContent = String(item.noteCount ?? (item.notes || []).length);
    const eng =
      item.engagementTotal ?? totalEngagement(item.notes || []);
    document.getElementById("cfg-engagement").textContent = eng.toLocaleString();
  }

  function resetForm() {
    editingId = null;
    draftKeywords = [];
    document.getElementById("modal-title").textContent = "新建竞品";
    document.getElementById("field-id").value = "";
    document.getElementById("field-brand").value = "";
    document.getElementById("field-freq").value = "biweekly";
    document.getElementById("field-limit").value = "100";
    document.getElementById("field-tier-bottom").value = "10000";
    document.getElementById("field-tier-mid").value = "500000";
    document.getElementById("field-enabled").checked = true;
    document.getElementById("field-kw-input").value = "";
    renderConfigSummary(null);
    renderKeywords();
  }

  function fillForm(item) {
    editingId = item.id;
    draftKeywords = [...item.keywords];
    document.getElementById("modal-title").textContent = "编辑竞品";
    document.getElementById("field-id").value = item.id;
    document.getElementById("field-brand").value = item.brand;
    document.getElementById("field-freq").value = item.frequency;
    document.getElementById("field-limit").value = String(item.limitPerKeyword);
    document.getElementById("field-tier-bottom").value = String(item.tierBottomMax);
    document.getElementById("field-tier-mid").value = String(item.tierMidMax);
    document.getElementById("field-enabled").checked = !!item.enabled;
    renderConfigSummary(item);
    renderKeywords();
  }

  function renderList() {
    const q = document.getElementById("list-search").value.trim().toLowerCase();
    const rows = competitors.filter((c) => !q || c.brand.toLowerCase().includes(q));
    const tbody = document.getElementById("competitor-tbody");
    if (!rows.length) {
      tbody.innerHTML =
        '<tr><td colspan="8"><div class="a3-table-empty"><i class="fas fa-inbox"></i>暂无竞品，点击「新建竞品」开始</div></td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(
        (c) => `
      <tr>
        <td><a class="a3-table-link" data-open="${c.id}">${escapeHtml(c.brand)}</a></td>
        <td><div class="cm-kw-tags">${c.keywords
          .map((k) => `<span class="cm-kw-tag">${escapeHtml(k)}</span>`)
          .join("")}</div></td>
        <td>${freqLabel(c.frequency)}</td>
        <td>${c.limitPerKeyword}</td>
        <td>${statusTag(displayStatus(c))}</td>
        <td>${formatDisplayDateTime(c.lastUpdatedAt)}</td>
        <td>${c.noteCount ?? 0}</td>
        <td>
          <div class="cm-ops">
            <button type="button" class="a3-btn a3-btn-text" data-open="${c.id}">查看</button>
            <button type="button" class="a3-btn a3-btn-text" data-edit="${c.id}">编辑</button>
            <button type="button" class="a3-btn a3-btn-text danger-link" data-del="${c.id}">删除</button>
          </div>
        </td>
      </tr>`
      )
      .join("");
  }

  function showList() {
    currentDetailId = null;
    document.getElementById("view-list").classList.remove("cm-hidden");
    document.getElementById("view-detail").classList.add("cm-hidden");
    document.getElementById("nav-list").classList.add("active");
    renderList();
  }

  function showDetail(id, keepFilter) {
    const item = competitors.find((c) => c.id === id);
    if (!item) return;
    currentDetailId = id;
    document.getElementById("view-list").classList.add("cm-hidden");
    document.getElementById("view-detail").classList.remove("cm-hidden");
    document.getElementById("detail-title").textContent = item.brand;
    document.getElementById("detail-status").outerHTML = statusTag(displayStatus(item)).replace(
      'class="a3-tag',
      'id="detail-status" class="a3-tag'
    );

    if (!keepFilter) {
      const range = defaultFilterRange(item);
      filterStart = range.start;
      filterEnd = range.end;
      document.getElementById("filter-start").value = filterStart;
      document.getElementById("filter-end").value = filterEnd;
    }

    document.getElementById("tier-legend").textContent = `底 <${formatFans(
      item.tierBottomMax
    )} · 中 <${formatFans(item.tierMidMax)} · 头 ≥${formatFans(item.tierMidMax)}`;

    renderDetailBody(item);
  }

  function renderDetailBody(item) {
    const notes = filteredNotes(item);
    const engagement = totalEngagement(notes);
    document.getElementById("range-note-count").textContent = String(notes.length);
    document.getElementById("range-engagement").textContent = engagement.toLocaleString();

    renderPyramid(item, notes);
    renderWordcloud(item, notes);
    renderNotes(notes);
    renderTrend(item);
  }

  function applyDetailFilter() {
    const item = competitors.find((c) => c.id === currentDetailId);
    if (!item) return;
    filterStart = document.getElementById("filter-start").value;
    filterEnd = document.getElementById("filter-end").value;
    if (filterStart && filterEnd && filterStart > filterEnd) {
      alert("开始日期不能晚于结束日期");
      return;
    }
    renderDetailBody(item);
  }

  function resetDetailFilter() {
    const item = competitors.find((c) => c.id === currentDetailId);
    if (!item) return;
    const range = defaultFilterRange(item);
    filterStart = range.start;
    filterEnd = range.end;
    document.getElementById("filter-start").value = filterStart;
    document.getElementById("filter-end").value = filterEnd;
    renderDetailBody(item);
  }

  function renderPyramid(item, notesOverride) {
    const notes = notesOverride || filteredNotes(item);
    const el = document.getElementById("pyramid");
    if (!notes.length) {
      el.innerHTML =
        '<div class="a3-table-empty" style="padding:24px 0"><i class="fas fa-inbox"></i>当前时间范围内暂无笔记</div>';
      return;
    }
    const counts = { 底部: 0, 中腰: 0, 头部: 0 };
    notes.forEach((n) => {
      counts[n.tier] = (counts[n.tier] || 0) + 1;
    });
    const total = notes.length;
    el.innerHTML = `
      <div class="cm-pyramid-layer top"><strong>头部</strong><br>${counts["头部"]} 篇 · ${Math.round(
      (counts["头部"] / total) * 100
    )}%</div>
      <div class="cm-pyramid-layer mid"><strong>中腰部</strong><br>${counts["中腰"]} 篇 · ${Math.round(
      (counts["中腰"] / total) * 100
    )}%</div>
      <div class="cm-pyramid-layer bottom"><strong>底部达人</strong><br>${counts["底部"]} 篇 · ${Math.round(
      (counts["底部"] / total) * 100
    )}%</div>
    `;
  }

  function renderWordcloud(item, notesOverride) {
    const notes = notesOverride || filteredNotes(item);
    const el = document.getElementById("wordcloud");
    const words = item.words || [];
    if (!notes.length || !words.length) {
      el.innerHTML =
        '<div class="a3-table-empty" style="padding:24px 0"><i class="fas fa-inbox"></i>当前时间范围内暂无语料</div>';
      return;
    }
    el.innerHTML = words
      .map(
        (w) =>
          `<span style="font-size:${Math.max(12, w.weight)}px;opacity:${0.55 + w.weight / 60}">${escapeHtml(
            w.text
          )}</span>`
      )
      .join("");
  }

  function renderNotes(notes) {
    const tbody = document.getElementById("notes-tbody");
    if (!notes.length) {
      tbody.innerHTML =
        '<tr><td colspan="9"><div class="a3-table-empty"><i class="fas fa-inbox"></i>当前时间范围内暂无笔记</div></td></tr>';
      return;
    }
    tbody.innerHTML = notes
      .map(
        (n) => `
      <tr>
        <td>${escapeHtml(n.publishedAt)}</td>
        <td>${escapeHtml(n.title)}</td>
        <td>${escapeHtml(n.author)}</td>
        <td>${formatFans(n.fans)}</td>
        <td>${escapeHtml(n.tier)}</td>
        <td>${n.liked}</td>
        <td>${n.collected}</td>
        <td>${n.commented}</td>
        <td><span class="cm-kw-tag">${escapeHtml(n.matchedKeyword)}</span></td>
      </tr>`
      )
      .join("");
  }

  function renderTrend(item) {
    const canvas = document.getElementById("trend-chart");
    const wrap = canvas.parentElement;
    const data = (item.trend || []).filter((p) => {
      if (filterStart && p.date < filterStart) return false;
      if (filterEnd && p.date > filterEnd) return false;
      return true;
    });
    if (trendChart) {
      trendChart.destroy();
      trendChart = null;
    }
    const emptyId = "trend-empty";
    let emptyEl = document.getElementById(emptyId);
    if (!data.length) {
      canvas.classList.add("cm-hidden");
      if (!emptyEl) {
        emptyEl = document.createElement("div");
        emptyEl.id = emptyId;
        emptyEl.className = "a3-table-empty";
        emptyEl.style.padding = "48px 0";
        emptyEl.innerHTML = '<i class="fas fa-inbox"></i>当前时间范围内暂无批次数据';
        wrap.appendChild(emptyEl);
      } else {
        emptyEl.innerHTML = '<i class="fas fa-inbox"></i>当前时间范围内暂无批次数据';
      }
      emptyEl.classList.remove("cm-hidden");
      return;
    }
    canvas.classList.remove("cm-hidden");
    if (emptyEl) emptyEl.classList.add("cm-hidden");
    if (typeof Chart === "undefined") return;
    trendChart = new Chart(canvas, {
      type: "line",
      data: {
        labels: data.map((d) => d.date.slice(5)),
        datasets: [
          {
            label: "笔记数",
            data: data.map((d) => d.noteCount),
            borderColor: "#c9677d",
            backgroundColor: "rgba(201,103,125,0.12)",
            tension: 0.35,
            yAxisID: "y",
          },
          {
            label: "互动量",
            data: data.map((d) => d.engagement),
            borderColor: "#dc8249",
            backgroundColor: "rgba(220,130,73,0.08)",
            tension: 0.35,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { position: "bottom" } },
        scales: {
          y: {
            type: "linear",
            position: "left",
            title: { display: true, text: "笔记数" },
            grid: { color: "#F0F0F0" },
          },
          y1: {
            type: "linear",
            position: "right",
            title: { display: true, text: "互动量" },
            grid: { drawOnChartArea: false },
          },
        },
        animation: { duration: 650 },
      },
    });
  }

  function saveCompetitor() {
    const brand = document.getElementById("field-brand").value.trim();
    const limit = Number(document.getElementById("field-limit").value);
    const bottom = Number(document.getElementById("field-tier-bottom").value);
    const mid = Number(document.getElementById("field-tier-mid").value);
    const frequency = document.getElementById("field-freq").value;
    const enabled = document.getElementById("field-enabled").checked;

    if (!brand) {
      alert("请填写竞品品牌");
      return;
    }
    if (!draftKeywords.length) {
      alert("请至少添加一个品牌词");
      return;
    }
    if (!limit || limit < 10) {
      alert("单次抓取上限至少为 10");
      return;
    }
    if (!(bottom > 0 && mid > bottom)) {
      alert("达人分层需满足：底部阈值 < 中腰阈值");
      return;
    }

    if (editingId) {
      const idx = competitors.findIndex((c) => c.id === editingId);
      if (idx >= 0) {
        const prev = competitors[idx];
        competitors[idx] = {
          ...prev,
          brand,
          keywords: [...draftKeywords],
          frequency,
          limitPerKeyword: limit,
          tierBottomMax: bottom,
          tierMidMax: mid,
          enabled,
          status: statusAfterEnableToggle(enabled, prev),
          notes: (prev.notes || []).map((n) => ({
            ...n,
            tier: tierOf(n.fans, bottom, mid),
          })),
        };
      }
    } else {
      competitors.unshift({
        id: uid(),
        brand,
        keywords: [...draftKeywords],
        frequency,
        limitPerKeyword: limit,
        tierBottomMax: bottom,
        tierMidMax: mid,
        enabled,
        status: enabled ? "idle" : "paused",
        lastUpdatedAt: null,
        noteCount: 0,
        engagementTotal: 0,
        notes: [],
        trend: [],
        words: [],
      });
    }

    const stayedOnDetail = currentDetailId && editingId === currentDetailId;
    save();
    closeModal("competitorModal");
    if (stayedOnDetail) {
      showDetail(currentDetailId, true);
    } else {
      showList();
    }
  }

  /* ---------- 产品文档 ---------- */
  function openDocs() {
    const overlay = document.getElementById("docs-overlay");
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    renderDocsList();
    selectDoc(docsCurrent || PRD_DOCS.find((d) => d.id === "all"));
  }

  function closeDocs() {
    const overlay = document.getElementById("docs-overlay");
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function renderDocsList() {
    const list = document.getElementById("docs-list");
    list.innerHTML = PRD_DOCS.map(
      (d) => `
      <button type="button" data-doc="${d.id}" class="${docsCurrent && docsCurrent.id === d.id ? "active" : ""}">
        ${escapeHtml(d.title)}
        <span class="desc">${escapeHtml(d.desc)}</span>
      </button>`
    ).join("");
  }

  async function selectDoc(doc) {
    docsCurrent = doc;
    renderDocsList();
    document.getElementById("docs-raw").href = `./${doc.path}`;
    const preview = document.getElementById("docs-preview");
    preview.textContent = "加载中…";
    try {
      const text = await fetchDoc(doc.path);
      if (typeof marked !== "undefined") {
        preview.innerHTML = marked.parse(text);
      } else {
        preview.innerHTML = `<pre>${escapeHtml(text)}</pre>`;
      }
    } catch (err) {
      preview.innerHTML = `<pre>无法加载 ${escapeHtml(doc.path)}\n${escapeHtml(String(err))}</pre>`;
    }
  }

  async function fetchDoc(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function bindEvents() {
    document.getElementById("btn-create").addEventListener("click", () => {
      resetForm();
      openModal("competitorModal");
    });
    document.getElementById("btn-add-kw").addEventListener("click", addKeyword);
    document.getElementById("field-kw-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addKeyword();
      }
    });
    document.getElementById("kw-tags").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-rm-kw]");
      if (!btn) return;
      draftKeywords.splice(Number(btn.getAttribute("data-rm-kw")), 1);
      renderKeywords();
    });
    document.getElementById("btn-save").addEventListener("click", saveCompetitor);
    document.querySelectorAll("[data-close-modal]").forEach((el) => {
      el.addEventListener("click", () => closeModal("competitorModal"));
    });
    document.getElementById("competitorModal").addEventListener("click", (e) => {
      if (e.target.id === "competitorModal") closeModal("competitorModal");
    });

    document.getElementById("competitor-tbody").addEventListener("click", (e) => {
      const open = e.target.closest("[data-open]");
      const edit = e.target.closest("[data-edit]");
      const del = e.target.closest("[data-del]");
      if (open) {
        showDetail(open.getAttribute("data-open"));
        return;
      }
      if (edit) {
        const item = competitors.find((c) => c.id === edit.getAttribute("data-edit"));
        if (!item) return;
        fillForm(item);
        openModal("competitorModal");
        return;
      }
      if (del) {
        deletingId = del.getAttribute("data-del");
        const item = competitors.find((c) => c.id === deletingId);
        document.getElementById("delete-name").textContent = item ? item.brand : "";
        openModal("deleteModal");
      }
    });

    document.querySelectorAll("[data-close-delete]").forEach((el) => {
      el.addEventListener("click", () => closeModal("deleteModal"));
    });
    document.getElementById("btn-confirm-delete").addEventListener("click", () => {
      competitors = competitors.filter((c) => c.id !== deletingId);
      deletingId = null;
      save();
      closeModal("deleteModal");
      showList();
    });

    document.getElementById("list-search").addEventListener("input", renderList);
    document.getElementById("btn-back").addEventListener("click", showList);
    document.getElementById("nav-list").addEventListener("click", showList);
    document.getElementById("btn-edit-detail").addEventListener("click", () => {
      const item = competitors.find((c) => c.id === currentDetailId);
      if (!item) return;
      fillForm(item);
      openModal("competitorModal");
    });
    document.getElementById("filter-start").addEventListener("change", applyDetailFilter);
    document.getElementById("filter-end").addEventListener("change", applyDetailFilter);
    document.getElementById("btn-filter-reset").addEventListener("click", resetDetailFilter);

    document.getElementById("docs-entry").addEventListener("click", openDocs);
    document.getElementById("docs-close").addEventListener("click", closeDocs);
    document.getElementById("docs-overlay").addEventListener("click", (e) => {
      if (e.target.id === "docs-overlay") closeDocs();
    });
    document.getElementById("docs-list").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-doc]");
      if (!btn) return;
      const doc = PRD_DOCS.find((d) => d.id === btn.getAttribute("data-doc"));
      if (doc) selectDoc(doc);
    });
    document.getElementById("docs-download").addEventListener("click", async () => {
      if (!docsCurrent) return;
      const text = await fetchDoc(docsCurrent.path);
      downloadText(docsCurrent.file, text);
    });
    document.getElementById("docs-download-all").addEventListener("click", async () => {
      const text = await fetchDoc("docs/prd-all.md");
      downloadText("prd-all.md", text);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeModal("competitorModal");
        closeModal("deleteModal");
        closeDocs();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    load();
    bindEvents();
    showList();
  });
})();
