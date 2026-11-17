(() => {
  const segItems = document.querySelectorAll(".seg-item");
  const views = {
    favorites: document.getElementById("view-favorites"),
    updates: document.getElementById("view-updates"),
  };
  const badge = document.getElementById("update-badge");
  const toast = document.getElementById("toast");
  const overBanner = document.getElementById("over-banner");
  const folderTitle = document.getElementById("folder-title");
  const folderSub = document.getElementById("folder-sub");
  const selectionBar = document.getElementById("selection-bar");
  const selectedCount = document.getElementById("selected-count");
  const btnBatchMove = document.getElementById("btn-batch-move");
  const btnBatchDel = document.getElementById("btn-batch-del");
  const checkAll = document.getElementById("check-all");

  function switchView(name) {
    Object.entries(views).forEach(([key, el]) => {
      const on = key === name;
      el.classList.toggle("active", on);
      el.hidden = !on;
    });
    segItems.forEach((btn) => {
      const on = btn.dataset.view === name;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  segItems.forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  document.querySelectorAll(".folder-item").forEach((item) => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".folder-item").forEach((el) => el.classList.remove("active"));
      item.classList.add("active");
      const name = item.dataset.name;
      const count = Number(item.dataset.count);
      const cap = Number(item.dataset.cap);
      const updated = item.dataset.updated;
      const over = count > cap;
      folderTitle.textContent = name;
      folderSub.innerHTML = [
        `共 <b>${count}</b> 人 · 容量 <b>${cap}</b>`,
        over
          ? `<span class="status-pill danger"><i class="fas fa-exclamation-triangle"></i> 已超限</span>`
          : `<span class="status-pill" style="background:#F6FFED;color:#389e0d"><i class="fas fa-check-circle"></i> 正常</span>`,
        `<span class="sub-sep">·</span>`,
        `上次更新 <time>${updated}</time>`,
      ].join(" ");
      overBanner.hidden = !over;
    });
  });

  function syncSelection() {
    const checks = [...document.querySelectorAll(".row-check")];
    const n = checks.filter((c) => c.checked).length;
    selectedCount.textContent = String(n);
    selectionBar.hidden = n === 0;
    btnBatchMove.disabled = n === 0;
    btnBatchDel.disabled = n === 0;
    checkAll.checked = n > 0 && n === checks.length;
    checkAll.indeterminate = n > 0 && n < checks.length;
  }

  document.querySelectorAll(".row-check").forEach((c) => {
    c.addEventListener("change", syncSelection);
  });

  checkAll.addEventListener("change", () => {
    document.querySelectorAll(".row-check").forEach((c) => {
      c.checked = checkAll.checked;
    });
    syncSelection();
  });

  document.getElementById("clear-selection").addEventListener("click", () => {
    document.querySelectorAll(".row-check").forEach((c) => {
      c.checked = false;
    });
    syncSelection();
  });

  document.getElementById("btn-update-data").addEventListener("click", () => {
    const n = Number(badge.textContent || "0") + 1;
    badge.textContent = String(n);
    toast.hidden = false;
    window.clearTimeout(toast._t);
    toast._t = window.setTimeout(() => {
      toast.hidden = true;
    }, 4200);
  });

  document.getElementById("toast-go").addEventListener("click", () => {
    toast.hidden = true;
    switchView("updates");
  });

  document.querySelectorAll(".filter-chips .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".filter-chips .chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
    });
  });

  // Deep-link helpers for screenshots: ?view=updates
  const params = new URLSearchParams(location.search);
  const initial = params.get("view");
  if (initial === "updates" || initial === "favorites") {
    switchView(initial);
  }
})();
