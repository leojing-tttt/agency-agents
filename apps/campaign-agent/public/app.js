const threadEl = document.getElementById("thread");
const memoryEl = document.getElementById("memory");
const skillsEl = document.getElementById("skills");
const mcpLine = document.getElementById("mcp-line");
const fileInput = document.getElementById("file");

const WHO = {
  user: ["你", "林AE"],
  brief_parse: ["解", "解析Agent"],
  plan: ["策", "本场 Agent · 策划主谈"],
  talent: ["达", "达人Agent"],
  content: ["内", "内容Agent"],
};

function a3Message(type, text) {
  const iconMap = {
    success: "fa-check-circle",
    info: "fa-info-circle",
    warning: "fa-exclamation-triangle",
    danger: "fa-times-circle",
  };
  const msg = document.createElement("div");
  msg.className = `a3-message a3-message-${type}`;
  msg.innerHTML = `<i class="fas ${iconMap[type] || iconMap.info}"></i><span>${escapeHtml(text)}</span>`;
  document.body.appendChild(msg);
  setTimeout(() => msg.remove(), 3000);
}

async function loadMeta() {
  const meta = await (await fetch("/api/meta")).json();
  document.getElementById("user-chip").innerHTML =
    `<i class="fas fa-user"></i> 林AE · ${escapeHtml(meta.tenant.name)}`;
  skillsEl.innerHTML = meta.skills
    .map(
      (s) =>
        `<div class="a3-campaign-pin"><b class="a3-text-primary">${escapeHtml(s.name)}</b> <span class="a3-tag a3-tag-info"><span class="a3-tag-dot"></span>@${escapeHtml(s.version)}</span><div class="a3-text-secondary a3-mt-4">${escapeHtml(s.description)}</div></div>`,
    )
    .join("");
  mcpLine.textContent = meta.mcp.length
    ? `MCP 白名单：${meta.mcp.map((t) => t.handle).join("、")}`
    : "本场未暴露刊例/下单 MCP";
}

async function loadCampaign() {
  const snap = await (await fetch("/api/campaign")).json();
  render(snap);
}

function render(snap) {
  const statusEl = document.querySelector(".a3-campaign-status");
  if (statusEl) {
    statusEl.textContent = `本场 · ${snap.campaign.status}`;
  }
  threadEl.innerHTML = snap.thread.map(renderMsg).join("");
  const briefTag = document.querySelector('[data-step="brief"]');
  const planTag = document.querySelector('[data-step="plan"]');
  if (briefTag) {
    const on = Boolean(snap.pinned_brief);
    briefTag.className = on ? "a3-tag a3-tag-success" : "a3-tag a3-tag-info";
    briefTag.innerHTML = `<span class="a3-tag-dot"></span>Brief`;
  }
  if (planTag) {
    const on = Boolean(snap.pinned_proposal);
    planTag.className = on ? "a3-tag a3-tag-success" : "a3-tag a3-tag-default";
    planTag.innerHTML = `<span class="a3-tag-dot"></span>策划`;
  }
  memoryEl.innerHTML = snap.memory.length
    ? snap.memory
        .map(
          (p) =>
            `<div class="a3-campaign-pin"><span class="a3-tag a3-tag-warning"><span class="a3-tag-dot"></span><i class="fas fa-thumbtack"></i> ${escapeHtml(p.kind)}</span><div class="a3-mt-4"><code>${escapeHtml(p.version_id)}</code></div></div>`,
        )
        .join("")
    : `<div class="a3-empty"><i class="fas fa-inbox"></i><div class="a3-empty-text">尚无 pin。丢 Brief 后会钉产物版本。</div></div>`;
  threadEl.scrollTop = threadEl.scrollHeight;
}

function renderMsg(msg) {
  const [ch, who] = WHO[msg.agent_name] || (msg.role === "user" ? WHO.user : ["系", "系统"]);
  const mine = msg.role === "user" ? " a3-msg-mine" : "";
  return `<div class="a3-msg${mine}"><span class="a3-avatar a3-avatar-square">${escapeHtml(ch)}</span><div class="a3-msg-body"><div class="a3-msg-who">${escapeHtml(who)}</div><div class="a3-msg-bubble">${renderBubble(msg)}</div></div></div>`;
}

function renderBubble(msg) {
  if (msg.kind === "artifact_card" || msg.kind === "open_questions") {
    const isPlan = msg.agent_name === "plan";
    const label = isPlan ? "方案卡片" : "产物卡片";
    const icon = isPlan ? "fa-lightbulb" : "fa-file-alt";
    const tagClass = isPlan ? "a3-tag-success" : "a3-tag-info";
    return `<div class="a3-card"><div class="a3-card-header"><span><i class="fas ${icon}"></i> ${label}</span>${
      msg.artifact_ref
        ? `<span class="a3-tag a3-tag-default"><span class="a3-tag-dot"></span>${escapeHtml(msg.artifact_ref.version_id)}</span>`
        : ""
    }</div><div class="a3-card-body">${escapeHtml(msg.text)}</div></div>`;
  }
  if (msg.kind === "wait") {
    return `<div class="a3-alert a3-alert-warning"><i class="fas fa-hourglass-half"></i><span>${escapeHtml(msg.text)}</span></div>`;
  }
  return escapeHtml(msg.text);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function upload(file) {
  const body = new FormData();
  body.append("file", file, file.name);
  const res = await fetch("/api/brief", { method: "POST", body });
  const data = await res.json();
  if (!res.ok) {
    a3Message("danger", data.error || "upload failed");
    return;
  }
  render(data.snapshot);
}

const dropzone = document.querySelector(".a3-upload-drop");

fileInput.addEventListener("change", () => {
  const file = fileInput.files && fileInput.files[0];
  if (file) {
    upload(file);
  }
});

["dragenter", "dragover"].forEach((name) => {
  dropzone.addEventListener(name, (event) => {
    event.preventDefault();
    dropzone.classList.add("is-over");
  });
});
["dragleave", "drop"].forEach((name) => {
  dropzone.addEventListener(name, (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-over");
  });
});
dropzone.addEventListener("drop", (event) => {
  const file = event.dataTransfer && event.dataTransfer.files[0];
  if (file) {
    upload(file);
  }
});

const sayForm = document.getElementById("say");
const sayText = document.getElementById("say-text");
sayForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = sayText.value.trim();
  if (!text) {
    return;
  }
  sayText.value = "";
  const res = await fetch("/api/turn", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  if (!res.ok) {
    a3Message("danger", data.error || "send failed");
    return;
  }
  render(data.snapshot);
});

loadMeta().then(loadCampaign);
