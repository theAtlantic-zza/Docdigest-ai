const form = document.getElementById("uploadForm");
const fileInput = document.getElementById("fileInput");
const output = document.getElementById("output");
const filenameEl = document.getElementById("filename");
const errorEl = document.getElementById("error");
const summarizeBtn = document.getElementById("summarizeBtn");
const summaryEl = document.getElementById("summary");
const summaryTypeEl = document.getElementById("summaryType");
const historyListEl = document.getElementById("historyList");
const newBtn = document.getElementById("newBtn");
const clearBtn = document.getElementById("clearBtn");

const LS_KEY = "docdigest.history.v1";

let currentText = "";
let currentFileName = "-";
let activeId = null;

function nowIso() {
  return new Date().toISOString();
}

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function modeLabel(mode) {
  if (mode === "summary") return "摘要";
  if (mode === "bullets") return "要点";
  if (mode === "outline") return "大纲";
  if (mode === "resume") return "简历建议";
  return mode || "-";
}

function safeText(v) {
  return typeof v === "string" ? v : "";
}

function showError(msg) {
  if (!errorEl) return;
  errorEl.textContent = msg;
  errorEl.hidden = !msg;
}

function setAnalyzeEnabled(enabled) {
  if (!summarizeBtn) return;
  summarizeBtn.disabled = !enabled;
}

function setAnalyzeLoading(loading) {
  if (!summarizeBtn) return;
  if (loading) {
    summarizeBtn.dataset.prevText = summarizeBtn.textContent || "";
    summarizeBtn.textContent = "AI 正在分析...";
    summarizeBtn.disabled = true;
  } else {
    summarizeBtn.textContent = summarizeBtn.dataset.prevText || "生成结果";
    delete summarizeBtn.dataset.prevText;
  }
}

function setSummaryMarkdown(md) {
  if (!summaryEl) return;
  const text = safeText(md);
  summaryEl.innerHTML = typeof marked !== "undefined" ? marked.parse(text) : text;
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveHistory(items) {
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}

function upsertHistory(item) {
  const items = loadHistory();
  const next = [item, ...items.filter((x) => x && x.id !== item.id)];
  saveHistory(next);
  return next;
}

function clearHistory() {
  saveHistory([]);
}

function renderHistory() {
  if (!historyListEl) return;
  const items = loadHistory()
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  historyListEl.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "historyItem";
    empty.style.cursor = "default";
    empty.innerHTML = `<div class="historyItem__title">暂无历史记录</div><div class="historyItem__meta">生成结果后会自动保存</div>`;
    historyListEl.appendChild(empty);
    return;
  }

  for (const it of items) {
    const el = document.createElement("div");
    el.className = `historyItem${it.id === activeId ? " historyItem--active" : ""}`;
    el.dataset.id = it.id;
    const when = it.createdAt ? new Date(it.createdAt).toLocaleString() : "-";
    el.innerHTML = `
      <div class="historyItem__title">${escapeHtml(it.fileName || "未命名")}</div>
      <div class="historyItem__meta">
        <span class="pill">${escapeHtml(modeLabel(it.mode))}</span>
        <span>${escapeHtml(when)}</span>
      </div>
    `;
    el.addEventListener("click", () => openHistory(it.id));
    historyListEl.appendChild(el);
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function openHistory(id) {
  const items = loadHistory();
  const it = items.find((x) => x && x.id === id);
  if (!it) return;

  activeId = it.id;
  currentText = safeText(it.originalText);
  currentFileName = it.fileName || "-";

  if (filenameEl) filenameEl.textContent = currentFileName;
  if (output) output.textContent = currentText || "（这里显示文件内容）";
  if (summaryTypeEl && it.mode) summaryTypeEl.value = it.mode;
  setSummaryMarkdown(it.resultText || "（这里显示结果）");
  setAnalyzeEnabled(Boolean(currentText && currentText.trim()));
  showError("");
  renderHistory();
}

function resetWorkspace() {
  activeId = null;
  currentText = "";
  currentFileName = "-";
  if (filenameEl) filenameEl.textContent = "-";
  if (output) output.textContent = "（这里显示文件内容）";
  setSummaryMarkdown("（这里显示结果）");
  setAnalyzeEnabled(false);
  showError("");
  if (fileInput) fileInput.value = "";
  renderHistory();
}

async function uploadAndRead(file) {
  const fd = new FormData();
  fd.append("file", file);

  if (output) output.textContent = "读取中...";
  showError("");
  setAnalyzeEnabled(false);
  setSummaryMarkdown("（这里显示结果）");

  const res = await fetch("/upload", { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "上传失败，请检查文件类型或稍后重试");
  return { fileName: data.filename || file.name, text: data.text ?? "" };
}

async function summarize(text, type) {
  const res = await fetch("/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, type })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data.error || "生成失败，请稍后重试";
    throw new Error(message);
  }
  return data.summary ?? "";
}

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = fileInput && fileInput.files && fileInput.files[0];
    if (!file) {
      showError("请选择一个 .txt、.md 或 .pdf 文件");
      return;
    }

    try {
      const { fileName, text } = await uploadAndRead(file);
      activeId = null;
      currentFileName = fileName;
      currentText = safeText(text);
      if (filenameEl) filenameEl.textContent = currentFileName;
      if (output) output.textContent = currentText || "（这里显示文件内容）";
      setAnalyzeEnabled(Boolean(currentText && currentText.trim()));
      if (!currentText || !currentText.trim()) {
        showError("文件读取成功，但未提取到可分析的文本内容");
      }
    } catch (err) {
      showError(err && err.message ? err.message : "上传失败");
      if (output) output.textContent = "（这里显示文件内容）";
      setAnalyzeEnabled(false);
    }
  });
}

if (summarizeBtn) {
  summarizeBtn.addEventListener("click", async () => {
    showError("");
    if (!currentText || !currentText.trim()) {
      showError("请先上传文件获取文本内容");
      setAnalyzeEnabled(false);
      return;
    }

    const type = (summaryTypeEl && summaryTypeEl.value) || "summary";
    setSummaryMarkdown("AI 正在分析...");
    setAnalyzeLoading(true);

    try {
      const resultText = await summarize(currentText, type);
      setSummaryMarkdown(resultText);

      const item = {
        id: uid(),
        fileName: currentFileName || "-",
        mode: type,
        originalText: currentText,
        resultText,
        createdAt: nowIso()
      };
      activeId = item.id;
      upsertHistory(item);
      renderHistory();
    } catch (err) {
      showError(err && err.message ? err.message : "生成结果失败");
      setSummaryMarkdown("（这里显示结果）");
    } finally {
      setAnalyzeLoading(false);
      setAnalyzeEnabled(Boolean(currentText && currentText.trim()));
    }
  });
}

if (newBtn) newBtn.addEventListener("click", resetWorkspace);
if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    clearHistory();
    resetWorkspace();
  });
}

renderHistory();
