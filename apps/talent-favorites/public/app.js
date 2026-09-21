import {
  BRANDS,
  NAME_MAX,
  PUBLISH_OPTIONS,
  SORT_OPTIONS,
  linesForBrand,
  validateKeywordTask,
} from "./keyword-task.js";

const CREATORS = [
  ["黄小雨", "30天内", "导入", "5a90e739e8ac2b1ad3fc3adc", "68000", "98000", "美妆,整体妆容,时尚,发型", ""],
  ["冯雨.花落", "7天内", "导入", "542d2430e7798949ef9706af", "29000", "23000", "生活记录,接地气生活", ""],
  ["奎妮在中国", "7天内", "导入", "5d1f686b000000000100257e9", "20000", "126800", "美食,吃播,美食测评,兴趣…", ""],
  ["三好学生（绝代双骄版）", "24h以内", "插件", "67ec15b77000000000013b00", "40804", "52600", "兴趣爱好,舞蹈,搞笑", ""],
  ["Friday周五", "超30天", "导入", "5daf0f3570000000001008c01", "45000", "120000", "美妆,整体妆容", ""],
  ["大大方方", "30天内", "导入", "57864ff082ec391ff216a7b1", "0", "36000", "美食,美食教程", ""],
  ["是喜七呀！", "24h以内", "导入", "59e753d0e8ac2b0aad487726", "9000", "10000", "影视综资讯,影视,美妆…", "18862783351"],
  ["明星化妆师朴东民", "超30天", "导入", "5de0f4950000000000100a1f9", "60000", "68000", "美妆,整体妆容,护肤,面部…", ""],
  ["蜜蛋和麻麻", "7天内", "插件", "6811f136000000000e10e8ae", "11800", "12800", "母婴,婴童用品,婴童食品", ""],
  ["可可小姐爱可酱", "超30天", "导入", "5ab63828e8ac2b3b6a28ac25", "27000", "35000", "出行旅游,旅行", ""],
];

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function fillSelect(el, options, placeholder) {
  el.innerHTML = "";
  if (placeholder !== undefined) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = placeholder;
    el.append(opt);
  }
  for (const value of options) {
    const opt = document.createElement("option");
    const id = typeof value === "string" ? value : value.id;
    const label = typeof value === "string" ? value : value.name;
    opt.value = id;
    opt.textContent = label;
    el.append(opt);
  }
}

function renderCreators() {
  const tbody = $("#creator-rows");
  tbody.innerHTML = CREATORS.map(
    ([nick, freshness, source, id, graphic, video, tags, wechat]) => `
    <tr>
      <td><label class="a3-checkbox"><input class="a3-checkbox-input" type="checkbox" /></label></td>
      <td><span class="fav-nick">${nick}</span></td>
      <td>
        <span class="fav-plat fav-plat-xhs">RED</span>
        <i class="fas fa-arrow-up-right-from-square fav-link-out"></i>
      </td>
      <td>—</td>
      <td>${wechat || "—"}</td>
      <td>—</td>
      <td><i class="far fa-clock a3-text-disabled"></i> ${freshness}</td>
      <td>${source}</td>
      <td>${id}</td>
      <td>${graphic}</td>
      <td>${video}</td>
      <td class="fav-tags" title="${tags}">${tags}</td>
      <td>
        <span class="fav-ops">
          <i class="fas fa-pen"></i>
          <i class="far fa-folder"></i>
          <i class="far fa-trash-can"></i>
        </span>
      </td>
    </tr>`,
  ).join("");
}

function showToast(text, kind = "success") {
  document.querySelector(".a3-message")?.remove();
  const el = document.createElement("div");
  el.className = `a3-message a3-message-${kind}`;
  el.innerHTML = `<i class="fas fa-circle-check"></i><span>${text}</span>`;
  document.body.append(el);
  setTimeout(() => el.remove(), 2400);
}

function setTab(tab) {
  $$(".fav-folder").forEach((btn) => {
    const on = btn.dataset.tab === tab;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-selected", String(on));
  });
  $("#keyword-find-row").classList.toggle("fav-hidden", tab !== "muying");
}

function openDrawer() {
  $("#task-mask").classList.add("show");
  $("#task-drawer").classList.add("open");
  $("#task-drawer").setAttribute("aria-hidden", "false");
  $("#task-name").focus();
}

function closeDrawer() {
  $("#task-mask").classList.remove("show");
  $("#task-drawer").classList.remove("open");
  $("#task-drawer").setAttribute("aria-hidden", "true");
}

function readForm() {
  return Object.fromEntries(new FormData($("#keyword-task-form")).entries());
}

function clearErrors() {
  $$("[data-error]").forEach((el) => {
    el.textContent = "";
  });
  $$(".fav-input-error").forEach((el) => el.classList.remove("fav-input-error"));
}

function showErrors(errors) {
  clearErrors();
  const fieldMap = {
    name: "#task-name",
    brandId: "#task-brand",
    lineId: "#task-line",
    keywordsText: "#task-keywords",
    noteCount: "#task-count",
    durationDays: "#task-duration",
    sortBy: "#task-sort",
    publishTime: "#task-publish",
  };
  for (const [field, message] of Object.entries(errors)) {
    const box = $(`[data-error="${field}"]`);
    if (box) box.textContent = message;
    const input = fieldMap[field] && $(fieldMap[field]);
    if (input) input.classList.add("fav-input-error");
    $$(`[data-range="${field}"] .a3-input`).forEach((el) => el.classList.add("fav-input-error"));
  }
}

function syncDurationVisibility() {
  const daily = $('input[name="cycle"]:checked')?.value === "daily";
  $("#duration-block").classList.toggle("fav-hidden", !daily);
}

function setMoreFiltersOpen(open) {
  const panel = $("#pgy-more-filters");
  const toggle = $("#pgy-more-toggle");
  panel.classList.toggle("fav-hidden", !open);
  toggle.setAttribute("aria-expanded", String(open));
  toggle.querySelector("i").className = open ? "fas fa-angle-up" : "fas fa-angle-down";
}

function syncLineSelect() {
  const brandId = $("#task-brand").value;
  const line = $("#task-line");
  const lines = linesForBrand(brandId);
  fillSelect(line, lines, brandId ? "请选择品线" : "请先选择品牌");
  line.disabled = !brandId;
}

function resetForm() {
  $("#keyword-task-form").reset();
  $("#task-count").value = "30";
  $('input[name="cycle"][value="daily"]').checked = true;
  $("#task-duration").value = "7";
  $("#task-sort").value = SORT_OPTIONS[0];
  $("#task-publish").value = PUBLISH_OPTIONS[0];
  $("#name-count").textContent = "0";
  syncLineSelect();
  syncDurationVisibility();
  setMoreFiltersOpen(false);
  clearErrors();
}

function initFormOptions() {
  fillSelect($("#task-brand"), BRANDS, "请选择品牌");
  fillSelect($("#task-sort"), SORT_OPTIONS);
  fillSelect($("#task-publish"), PUBLISH_OPTIONS);
  $("#task-sort").value = SORT_OPTIONS[0];
  $("#task-publish").value = PUBLISH_OPTIONS[0];
  syncLineSelect();
}

renderCreators();
initFormOptions();

$$(".fav-folder").forEach((btn) => {
  btn.addEventListener("click", () => setTab(btn.dataset.tab));
});

$("#keyword-find-btn").addEventListener("click", () => {
  resetForm();
  openDrawer();
});

$("#task-mask").addEventListener("click", closeDrawer);
$("#task-close").addEventListener("click", closeDrawer);
$("#task-cancel").addEventListener("click", closeDrawer);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && $("#task-drawer").classList.contains("open")) {
    closeDrawer();
  }
});

$("#task-name").addEventListener("input", () => {
  $("#name-count").textContent = String(Math.min($("#task-name").value.length, NAME_MAX));
});

$("#task-brand").addEventListener("change", syncLineSelect);

$$('input[name="cycle"]').forEach((radio) => {
  radio.addEventListener("change", syncDurationVisibility);
});

$("#pgy-more-toggle").addEventListener("click", () => {
  setMoreFiltersOpen($("#pgy-more-filters").classList.contains("fav-hidden"));
});

$("#keyword-task-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const result = validateKeywordTask(readForm());
  if (!result.ok) {
    showErrors(result.errors);
    return;
  }
  clearErrors();
  closeDrawer();
  showToast("监控任务已创建");
});
