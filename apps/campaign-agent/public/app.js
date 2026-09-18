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

async function loadMeta() {
  const meta = await (await fetch("/api/meta")).json();
  document.getElementById("user-chip").textContent = `林AE · ${meta.tenant.name}`;
  skillsEl.innerHTML = meta.skills
    .map((s) => `<li><b>${s.name}</b> @${s.version}<br>${escapeHtml(s.description)}</li>`)
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
  document.querySelector(".thread-item small").textContent = `本场 · ${snap.campaign.status}`;
  threadEl.innerHTML = snap.thread.map(renderMsg).join("");
  const steps = document.querySelectorAll(".prog span");
  if (steps[0]) {
    steps[0].classList.add("on");
  }
  if (steps[2]) {
    steps[2].classList.toggle("on", Boolean(snap.pinned_proposal));
  }
  memoryEl.innerHTML = snap.memory.length
    ? snap.memory
        .map(
          (p) =>
            `<li>${p.kind}<br><code>${p.version_id}</code></li>`,
        )
        .join("")
    : "<li>尚无 pin。丢 Brief 后会钉产物版本。</li>";
  threadEl.scrollTop = threadEl.scrollHeight;
}

function renderMsg(msg) {
  const [ch, who] = WHO[msg.agent_name] || (msg.role === "user" ? WHO.user : ["系", "系统"]);
  const mine = msg.role === "user" ? " mine" : "";
  const extra =
    msg.kind === "artifact_card" || msg.kind === "open_questions"
      ? `<div class="art"><span class="tag">${msg.agent_name === "plan" ? "方案卡片" : "产物卡片"}</span>${escapeHtml(msg.text)}${
          msg.artifact_ref
            ? `<div class="tag">${msg.artifact_ref.version_id}</div>`
            : ""
        }</div>`
      : escapeHtml(msg.text);
  const bubbleClass = msg.kind === "wait" ? "bubble wait" : "bubble";
  return `<div class="msg${mine}"><span class="ava">${ch}</span><div><div class="who">${who}</div><div class="${bubbleClass}">${extra}</div></div></div>`;
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
    alert(data.error || "upload failed");
    return;
  }
  render(data.snapshot);
}

const dropzone = document.querySelector(".dropzone");

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
    alert(data.error || "send failed");
    return;
  }
  render(data.snapshot);
});

loadMeta().then(loadCampaign);
