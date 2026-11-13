(() => {
  const state = {
    taxonomy: null,
    mapping: null,
    selectedDim: null,
  };

  const $ = (sel) => document.querySelector(sel);
  const viewTitle = $("#view-title");
  const statusPill = $("#status-pill");
  const dimList = $("#dimension-list");
  const dimTitle = $("#dim-title");
  const dimMeta = $("#dim-meta");
  const enumBody = $("#enum-table tbody");
  const addForm = $("#add-enum-form");
  const mappingBody = $("#mapping-table tbody");
  const validateOut = $("#validate-out");

  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = data.detail || res.statusText;
      throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    }
    return data;
  }

  function setStatus(ok, text) {
    statusPill.textContent = text;
    statusPill.className = `pill ${ok === true ? "ok" : ok === false ? "bad" : "muted"}`;
  }

  function showView(name) {
    document.querySelectorAll(".view").forEach((el) => el.classList.add("hidden"));
    document.querySelector(`#view-${name}`).classList.remove("hidden");
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === name);
    });
    const titles = {
      dimensions: "维度管理",
      mapping: "映射管理",
      validate: "校验",
    };
    viewTitle.textContent = titles[name] || name;
  }

  function leafLabel(leafId) {
    const dim = (state.taxonomy?.dimensions || []).find((d) => d.id === "image_type");
    const hit = dim?.enums?.find((e) => e.id === leafId);
    return hit ? hit.label : "";
  }

  function renderDimensions() {
    dimList.innerHTML = "";
    (state.taxonomy?.dimensions || []).forEach((dim) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = `${dim.name} (${dim.enums.length})`;
      btn.classList.toggle("active", state.selectedDim === dim.id);
      btn.addEventListener("click", () => {
        state.selectedDim = dim.id;
        renderDimensions();
        renderEnums();
      });
      dimList.appendChild(btn);
    });
  }

  function renderEnums() {
    const dim = (state.taxonomy?.dimensions || []).find((d) => d.id === state.selectedDim);
    enumBody.innerHTML = "";
    if (!dim) {
      dimTitle.textContent = "选择左侧维度";
      dimMeta.textContent = "";
      addForm.classList.add("hidden");
      return;
    }
    dimTitle.textContent = dim.name;
    dimMeta.textContent = `id=${dim.id} · required=${dim.required} · 枚举 ${dim.enums.length} 个`;
    addForm.classList.remove("hidden");
    dim.enums.forEach((e) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td><code>${e.id}</code></td><td>${e.label}</td><td></td>`;
      const td = tr.lastElementChild;
      const del = document.createElement("button");
      del.type = "button";
      del.className = "danger";
      del.textContent = "删除";
      del.addEventListener("click", async () => {
        if (!confirm(`删除 ${dim.id}.${e.id}？`)) return;
        try {
          state.taxonomy = await api(
            `/api/taxonomy/dimensions/${encodeURIComponent(dim.id)}/enums/${encodeURIComponent(e.id)}`,
            { method: "DELETE" }
          );
          state.mapping = await api("/api/mapping");
          renderDimensions();
          renderEnums();
          renderMapping();
          await runValidate(false);
        } catch (err) {
          alert(err.message);
        }
      });
      td.appendChild(del);
      enumBody.appendChild(tr);
    });
  }

  function renderMapping() {
    mappingBody.innerHTML = "";
    const categories = state.mapping?.categories || [];
    const leaves = Object.keys(state.mapping?.leaf_to_category || {}).sort();
    leaves.forEach((leaf) => {
      const tr = document.createElement("tr");
      const catId = state.mapping.leaf_to_category[leaf];
      const select = document.createElement("select");
      categories.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = `${c.label} (${c.id})`;
        if (c.id === catId) opt.selected = true;
        select.appendChild(opt);
      });
      select.addEventListener("change", async () => {
        try {
          state.mapping = await api("/api/mapping", {
            method: "PUT",
            body: JSON.stringify({ leaf, category: select.value }),
          });
          await runValidate(false);
        } catch (err) {
          alert(err.message);
          await reload();
        }
      });
      tr.innerHTML = `<td><code>${leaf}</code></td><td>${leafLabel(leaf)}</td>`;
      const td = document.createElement("td");
      td.appendChild(select);
      tr.appendChild(td);
      mappingBody.appendChild(tr);
    });
  }

  async function runValidate(showAlert) {
    const result = await api("/api/validate");
    if (result.ok) {
      setStatus(true, "词表一致");
      validateOut.textContent = "OK：taxonomy 与 mapping 一致。";
    } else {
      setStatus(false, `有 ${result.problems.length} 个问题`);
      validateOut.textContent = result.problems.map((p) => `- ${p}`).join("\n");
      if (showAlert) alert("校验未通过，见页面详情");
    }
    return result;
  }

  async function reload() {
    state.taxonomy = await api("/api/taxonomy");
    state.mapping = await api("/api/mapping");
    if (!state.selectedDim && state.taxonomy.dimensions?.length) {
      state.selectedDim = state.taxonomy.dimensions[0].id;
    }
    renderDimensions();
    renderEnums();
    renderMapping();
    await runValidate(false);
  }

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => showView(btn.dataset.view));
  });

  addForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fd = new FormData(addForm);
    const enum_id = String(fd.get("enum_id") || "").trim();
    const label = String(fd.get("label") || "").trim();
    try {
      state.taxonomy = await api(
        `/api/taxonomy/dimensions/${encodeURIComponent(state.selectedDim)}/enums`,
        { method: "POST", body: JSON.stringify({ enum_id, label }) }
      );
      state.mapping = await api("/api/mapping");
      addForm.reset();
      renderDimensions();
      renderEnums();
      renderMapping();
      await runValidate(false);
    } catch (err) {
      alert(err.message);
    }
  });

  $("#btn-validate").addEventListener("click", () => runValidate(true));

  reload().catch((err) => {
    setStatus(false, "无法连接后端");
    validateOut.textContent = err.message;
  });
})();
