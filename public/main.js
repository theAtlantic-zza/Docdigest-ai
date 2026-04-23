const form = document.getElementById("uploadForm");
const fileInput = document.getElementById("fileInput");
const parsedTextEl = document.getElementById("parsedText");
const parsedHintEl = document.getElementById("parsedHint");
const output = document.getElementById("output");
const filenameEl = document.getElementById("filename");
const errorEl = document.getElementById("error");
const summarizeBtn = document.getElementById("summarizeBtn");
const summaryEl = document.getElementById("summary");
const summaryTypeEl = document.getElementById("summaryType");
const historyListEl = document.getElementById("historyList");
const newBtn = document.getElementById("newBtn");
const clearBtn = document.getElementById("clearBtn");
const chatHistoryEl = document.getElementById("chatHistory");
const chatInputEl = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSendBtn");
const chatHintEl = document.getElementById("chatHint");
const jobTargetFieldEl = document.getElementById("jobTargetField");
const jobTargetInputEl = document.getElementById("jobTargetInput");
const apiKeyInputEl = document.getElementById("apiKeyInput");
const saveKeyBtn = document.getElementById("saveKeyBtn");
const clearKeyBtn = document.getElementById("clearKeyBtn");
const aiGateEl = document.getElementById("aiGate");
const copyParsedBtn = document.getElementById("copyParsedBtn");
const copyResultBtn = document.getElementById("copyResultBtn");
const exportMdBtn = document.getElementById("exportMdBtn");
const exportTxtBtn = document.getElementById("exportTxtBtn");
const resultToastEl = document.getElementById("resultToast");
const viewDocBtn = document.getElementById("viewDocBtn");
const docModalEl = document.getElementById("docModal");
const docModalCloseBtn = document.getElementById("docModalCloseBtn");

const LS_KEY = "docdigest.history.v1";
const API_KEY_LS = "dashscope_api_key";
const BASE_URL_LS = "dashscope_base_url";
const DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";

let currentText = "";
let currentFileName = "-";
let activeId = null;
let currentAnalysisResultText = "";
let chatMessages = []; // session-only
let analyzeInProgress = false;
let currentJobTarget = "";
let userApiKey = "";
let userBaseUrl = "";

const EMPTY_PARSED = "Upload a document to extract text.";
const EMPTY_AI = "Run an analysis to see results here.";
const REQUIRE_KEY_TOOLTIP = "Requires your own API key";

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
  if (mode === "job_match") return "岗位匹配";
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

function loadUserKey() {
  try {
    return safeText(localStorage.getItem(API_KEY_LS));
  } catch {
    return "";
  }
}

function loadBaseUrl() {
  try {
    return safeText(localStorage.getItem(BASE_URL_LS)) || DEFAULT_BASE_URL;
  } catch {
    return DEFAULT_BASE_URL;
  }
}

function saveBaseUrl(url) {
  try {
    localStorage.setItem(BASE_URL_LS, url);
  } catch {}
}

function clearBaseUrl() {
  try {
    localStorage.removeItem(BASE_URL_LS);
  } catch {}
}

function saveUserKey(key) {
  try {
    localStorage.setItem(API_KEY_LS, key);
  } catch {}
}

function clearUserKey() {
  try {
    localStorage.removeItem(API_KEY_LS);
  } catch {}
}

function setAiLockedUI(locked) {
  if (aiGateEl) aiGateEl.classList.toggle("hidden", !locked);
  // AI actions
  if (summarizeBtn) summarizeBtn.disabled = locked || !Boolean(currentText && currentText.trim());
  setChatEnabled(!locked && Boolean(currentText && currentText.trim() && currentAnalysisResultText.trim()));
  setResultActionsEnabled(Boolean(currentAnalysisResultText && currentAnalysisResultText.trim()));
  if (summarizeBtn) summarizeBtn.title = locked ? REQUIRE_KEY_TOOLTIP : "";
}

let toastTimer = null;
function showToast(message, kind = "ok") {
  if (!resultToastEl) return;
  if (toastTimer) window.clearTimeout(toastTimer);
  resultToastEl.hidden = false;
  resultToastEl.classList.toggle("toast--error", kind === "error");
  resultToastEl.textContent = message;
  toastTimer = window.setTimeout(() => {
    resultToastEl.hidden = true;
  }, 1200);
}

function setAnalyzeEnabled(enabled) {
  if (!summarizeBtn) return;
  summarizeBtn.disabled = !enabled;
  summarizeBtn.title = summarizeBtn.disabled && (!userApiKey || !userApiKey.trim()) ? REQUIRE_KEY_TOOLTIP : "";
}

function setResultActionsEnabled(enabled) {
  const can = Boolean(enabled) && !analyzeInProgress;
  if (copyResultBtn) copyResultBtn.disabled = !can;
  if (exportMdBtn) exportMdBtn.disabled = !can;
  if (exportTxtBtn) exportTxtBtn.disabled = !can;
  if (viewDocBtn) viewDocBtn.disabled = !Boolean(currentText && currentText.trim());
  if (copyParsedBtn) copyParsedBtn.disabled = !Boolean(currentText && currentText.trim());
}

function setChatEnabled(enabled) {
  if (!chatSendBtn) return;
  const can = Boolean(enabled) && Boolean(userApiKey && userApiKey.trim());
  chatSendBtn.disabled = !can;
  chatSendBtn.title = chatSendBtn.disabled && (!userApiKey || !userApiKey.trim()) ? REQUIRE_KEY_TOOLTIP : "";
  if (chatInputEl) {
    chatInputEl.disabled = !Boolean(userApiKey && userApiKey.trim());
    chatInputEl.placeholder = chatInputEl.disabled
      ? "Add your API key to enable follow-up questions"
      : "Ask a follow-up question about the current document…";
  }
  if (chatHintEl) {
    chatHintEl.textContent = can
      ? "提示：你可以继续追问，例如“提炼三个亮点 / 适合什么岗位 / 改写更专业”。"
      : "提示：解析文档免费可用；添加你的 DashScope API key 后可继续追问。";
  }
}

function setAnalyzeLoading(loading) {
  if (!summarizeBtn) return;
  if (loading) {
    analyzeInProgress = true;
    summarizeBtn.dataset.prevText = summarizeBtn.textContent || "";
    summarizeBtn.textContent = "Analyzing document...";
    summarizeBtn.disabled = true;
    setResultActionsEnabled(false);
  } else {
    analyzeInProgress = false;
    summarizeBtn.textContent = summarizeBtn.dataset.prevText || "生成结果";
    delete summarizeBtn.dataset.prevText;
    setResultActionsEnabled(Boolean(currentAnalysisResultText && currentAnalysisResultText.trim()));
  }
}

function setSummaryMarkdown(md) {
  if (!summaryEl) return;
  const text = safeText(md);
  summaryEl.innerHTML = typeof marked !== "undefined" ? marked.parse(text) : text;
}

function setParsedText(text) {
  const t = safeText(text);
  if (parsedTextEl) parsedTextEl.textContent = t || EMPTY_PARSED;
  if (output) output.textContent = t || "（这里显示文件内容）";
  setResultActionsEnabled(Boolean(t && t.trim()));
}

function updateJobTargetVisibility() {
  const type = (summaryTypeEl && summaryTypeEl.value) || "summary";
  const show = type === "job_match";
  if (jobTargetFieldEl) jobTargetFieldEl.classList.toggle("hidden", !show);
}

function getJobTargetValue() {
  return safeText(jobTargetInputEl && jobTargetInputEl.value).trim();
}

function setJobTargetValue(v) {
  if (!jobTargetInputEl) return;
  jobTargetInputEl.value = safeText(v);
}

function stripExtension(name) {
  const s = safeText(name);
  const idx = s.lastIndexOf(".");
  if (idx <= 0) return s || "document";
  return s.slice(0, idx);
}

function sanitizeFileBase(name) {
  const base = stripExtension(name) || "document";
  return base.replaceAll(/[\\/:*?"<>|\n\r\t]/g, "_").trim() || "document";
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function mdToPlainText(md) {
  const text = safeText(md);
  if (typeof marked !== "undefined") {
    const html = marked.parse(text);
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return (tmp.textContent || "").trim();
  }
  return text
    .replaceAll(/```[\s\S]*?```/g, "")
    .replaceAll(/`([^`]+)`/g, "$1")
    .replaceAll(/[*_~#>-]/g, "")
    .replaceAll(/\n{3,}/g, "\n\n")
    .trim();
}

function renderChat() {
  if (!chatHistoryEl) return;
  chatHistoryEl.innerHTML = "";

  if (!chatMessages.length) {
    const empty = document.createElement("div");
    empty.className = "chatItem";
    empty.style.cursor = "default";
    empty.innerHTML = `<div class="chatItem__role">Tip</div><div class="chatItem__content">Ask follow-up questions here. The AI will answer based on the current document.</div>`;
    chatHistoryEl.appendChild(empty);
    return;
  }

  for (const m of chatMessages) {
    const item = document.createElement("div");
    item.className = "chatItem";
    item.innerHTML = `
      <div class="chatItem__role">${escapeHtml(m.role === "user" ? "你" : "AI")}</div>
      <div class="chatItem__content">${escapeHtml(m.content)}</div>
    `;
    chatHistoryEl.appendChild(item);
  }
  chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight;
}

async function chatAsk(currentDocumentText, currentAnalysisResult, userQuestion) {
  const res = await fetch("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      currentDocumentText,
      currentAnalysisResult,
      userQuestion,
      userApiKey
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data.error || "提问失败，请稍后重试";
    throw new Error(message);
  }
  return data.reply ?? "";
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
    empty.innerHTML = `<div class="historyItem__title">No history yet.</div><div class="historyItem__meta">Results will appear here.</div>`;
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
  currentAnalysisResultText = safeText(it.resultText);
  currentJobTarget = safeText(it.jobTitle);
  chatMessages = [];

  if (filenameEl) filenameEl.textContent = currentFileName;
  setParsedText(currentText);
  if (summaryTypeEl && it.mode) summaryTypeEl.value = it.mode;
  setJobTargetValue(currentJobTarget);
  updateJobTargetVisibility();
  setSummaryMarkdown(currentAnalysisResultText || EMPTY_AI);
  setAnalyzeEnabled(Boolean(currentText && currentText.trim()) && Boolean(userApiKey && userApiKey.trim()));
  showError("");
  renderHistory();
  renderChat();
  setChatEnabled(Boolean(currentText && currentText.trim() && currentAnalysisResultText.trim()));
  setResultActionsEnabled(Boolean(currentAnalysisResultText && currentAnalysisResultText.trim()));
}

function resetWorkspace() {
  activeId = null;
  currentText = "";
  currentFileName = "-";
  currentAnalysisResultText = "";
  currentJobTarget = "";
  chatMessages = [];
  if (filenameEl) filenameEl.textContent = "-";
  setParsedText("");
  setSummaryMarkdown(EMPTY_AI);
  setAnalyzeEnabled(false);
  showError("");
  setResultActionsEnabled(false);
  if (fileInput) fileInput.value = "";
  setJobTargetValue("");
  updateJobTargetVisibility();
  renderHistory();
  renderChat();
  setChatEnabled(false);
  setAiLockedUI(!Boolean(userApiKey && userApiKey.trim()));
}

function openDocModal() {
  if (!docModalEl) return;
  docModalEl.classList.remove("hidden");
}

function closeDocModal() {
  if (!docModalEl) return;
  docModalEl.classList.add("hidden");
}

async function uploadAndRead(file) {
  const fd = new FormData();
  fd.append("file", file);

  if (parsedTextEl) parsedTextEl.textContent = "Extracting text...";
  if (output) output.textContent = "读取中...";
  showError("");
  setAnalyzeEnabled(false);
  setSummaryMarkdown(EMPTY_AI);

  const res = await fetch("/upload", { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "上传失败，请检查文件类型或稍后重试");
  return { fileName: data.filename || file.name, text: data.text ?? "" };
}

async function renderPdfFirstPageToDataUrl(file) {
  const pdfjs = window.pdfjsLib;
  if (!pdfjs) throw new Error("PDF 渲染库未加载，请刷新页面后重试");
  const workerSrc = new URL(
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/legacy/build/pdf.worker.min.mjs"
  ).toString();
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布上下文");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/png");
}

async function ocrImage(imageDataUrl) {
  const res = await fetch("/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageDataUrl,
      userApiKey,
      baseUrl: userBaseUrl || DEFAULT_BASE_URL,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "OCR 失败，请稍后重试");
  return safeText(data.text);
}

async function summarize(text, type) {
  const jobTitle = type === "job_match" ? getJobTargetValue() : "";
  const res = await fetch("/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, type, jobTitle, userApiKey })
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
      currentAnalysisResultText = "";
      currentJobTarget = "";
      setJobTargetValue("");
      chatMessages = [];
      if (filenameEl) filenameEl.textContent = currentFileName;
      setParsedText(currentText);
      showToast("Text extracted successfully");
      setAnalyzeEnabled(Boolean(currentText && currentText.trim()) && Boolean(userApiKey && userApiKey.trim()));
      if (!currentText || !currentText.trim()) {
        // Offer OCR fallback for scanned/screenshot PDFs
        const isPdf = /\.pdf$/i.test(fileName || file.name || "");
        if (isPdf) {
          showError("未提取到文本（可能是截图/扫描 PDF）。可尝试 OCR 识别第 1 页后再分析。");
          if (userApiKey && userApiKey.trim()) {
            setAnalyzeEnabled(false);
            setSummaryMarkdown(EMPTY_AI);
            setResultActionsEnabled(false);
            setChatEnabled(false);
            // Inline CTA
            const btn = document.createElement("button");
            btn.className = "btn btn--secondary btn--sm";
            btn.type = "button";
            btn.textContent = "尝试 OCR（第 1 页）";
            btn.style.marginTop = "8px";
            btn.addEventListener("click", async () => {
              showError("");
              try {
                btn.disabled = true;
                btn.textContent = "OCR 识别中...";
                const dataUrl = await renderPdfFirstPageToDataUrl(file);
                const ocrText = await ocrImage(dataUrl);
                currentText = ocrText;
                setParsedText(currentText);
                showToast("OCR completed");
                setAnalyzeEnabled(Boolean(currentText && currentText.trim()) && Boolean(userApiKey && userApiKey.trim()));
              } catch (err2) {
                showError(err2 && err2.message ? err2.message : "OCR 失败");
              } finally {
                btn.disabled = false;
                btn.textContent = "尝试 OCR（第 1 页）";
              }
            });
            if (parsedHintEl && parsedHintEl.parentNode) {
              parsedHintEl.parentNode.appendChild(btn);
            }
          }
        } else {
          showError("文件读取成功，但未提取到可分析的文本内容");
        }
      }
      renderChat();
      setChatEnabled(false);
      setResultActionsEnabled(Boolean(currentText && currentText.trim()));
      setAiLockedUI(!Boolean(userApiKey && userApiKey.trim()));
    } catch (err) {
      showError(err && err.message ? err.message : "上传失败");
      setParsedText("");
      if (parsedTextEl) parsedTextEl.textContent = "Failed to extract text. Please try another file.";
      setAnalyzeEnabled(false);
      setChatEnabled(false);
      setResultActionsEnabled(false);
    }
  });
}

if (summarizeBtn) {
  summarizeBtn.addEventListener("click", async () => {
    showError("");
    if (!userApiKey || !userApiKey.trim()) {
      showError("Document parsing is available for free. Add your own DashScope API key to unlock AI analysis.");
      setAiLockedUI(true);
      return;
    }
    if (!currentText || !currentText.trim()) {
      showError("请先上传文件获取文本内容");
      setAnalyzeEnabled(false);
      return;
    }

    const type = (summaryTypeEl && summaryTypeEl.value) || "summary";
    updateJobTargetVisibility();
    if (type === "job_match") {
      const jobTitle = getJobTargetValue();
      if (!jobTitle) {
        showError("请选择“岗位匹配分析”时，请先填写目标岗位");
        return;
      }
      currentJobTarget = jobTitle;
    } else {
      currentJobTarget = "";
    }
    setSummaryMarkdown("Analyzing document...");
    setAnalyzeLoading(true);

    try {
      const resultText = await summarize(currentText, type);
      currentAnalysisResultText = safeText(resultText);
      setSummaryMarkdown(resultText);
      setResultActionsEnabled(Boolean(currentAnalysisResultText && currentAnalysisResultText.trim()));

      const item = {
        id: uid(),
        fileName: currentFileName || "-",
        mode: type,
        originalText: currentText,
        resultText,
        jobTitle: currentJobTarget,
        createdAt: nowIso()
      };
      activeId = item.id;
      upsertHistory(item);
      renderHistory();
      chatMessages = [];
      renderChat();
      setChatEnabled(Boolean(currentText && currentText.trim() && currentAnalysisResultText.trim()));
    } catch (err) {
      showError(err && err.message ? err.message : "生成结果失败");
      setSummaryMarkdown(EMPTY_AI);
      currentAnalysisResultText = "";
      setChatEnabled(false);
      setResultActionsEnabled(false);
    } finally {
      setAnalyzeLoading(false);
      setAnalyzeEnabled(Boolean(currentText && currentText.trim()) && Boolean(userApiKey && userApiKey.trim()));
    }
  });
}

function setChatLoading(loading) {
  if (!chatSendBtn) return;
  if (loading) {
    chatSendBtn.dataset.prevText = chatSendBtn.textContent || "";
    chatSendBtn.textContent = "发送中...";
    chatSendBtn.disabled = true;
    if (chatInputEl) chatInputEl.disabled = true;
  } else {
    chatSendBtn.textContent = chatSendBtn.dataset.prevText || "发送";
    delete chatSendBtn.dataset.prevText;
    if (chatInputEl) chatInputEl.disabled = false;
  }
}

async function onSendChat() {
  showError("");
  const question = safeText(chatInputEl && chatInputEl.value).trim();
  if (!userApiKey || !userApiKey.trim()) {
    showError("Add your DashScope API key to unlock chat follow-ups.");
    setChatEnabled(false);
    return;
  }
  if (!currentText || !currentText.trim() || !currentAnalysisResultText.trim()) {
    showError("请先上传文档并生成一次结果后再继续提问");
    setChatEnabled(false);
    return;
  }
  if (!question) return;

  chatMessages.push({ role: "user", content: question });
  renderChat();
  if (chatInputEl) chatInputEl.value = "";

  setChatLoading(true);
  try {
    const reply = await chatAsk(currentText, currentAnalysisResultText, question);
    chatMessages.push({ role: "assistant", content: safeText(reply) });
    renderChat();
  } catch (err) {
    showError(err && err.message ? err.message : "提问失败");
  } finally {
    setChatLoading(false);
    setChatEnabled(Boolean(currentText && currentText.trim() && currentAnalysisResultText.trim()));
  }
}

if (newBtn) newBtn.addEventListener("click", resetWorkspace);
if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    clearHistory();
    resetWorkspace();
  });
}

renderHistory();
renderChat();
setChatEnabled(false);
setResultActionsEnabled(false);
updateJobTargetVisibility();
userApiKey = loadUserKey();
if (apiKeyInputEl) apiKeyInputEl.value = userApiKey ? userApiKey : "";
const baseUrlInputEl = document.getElementById("baseUrlInput");
userBaseUrl = loadBaseUrl();
if (baseUrlInputEl) baseUrlInputEl.value = userBaseUrl;
setAiLockedUI(!Boolean(userApiKey && userApiKey.trim()));
setParsedText("");
setSummaryMarkdown(EMPTY_AI);

if (saveKeyBtn) {
  saveKeyBtn.addEventListener("click", () => {
    const k = safeText(apiKeyInputEl && apiKeyInputEl.value).trim();
    const b = safeText(baseUrlInputEl && baseUrlInputEl.value).trim() || DEFAULT_BASE_URL;
    if (!k) {
      showToast("请输入 API Key", "error");
      return;
    }
    userApiKey = k;
    saveUserKey(k);
    userBaseUrl = b;
    saveBaseUrl(b);
    showToast("API Key 已保存");
    setAiLockedUI(false);
    setAnalyzeEnabled(Boolean(currentText && currentText.trim()));
  });
}

if (clearKeyBtn) {
  clearKeyBtn.addEventListener("click", () => {
    userApiKey = "";
    clearUserKey();
    if (apiKeyInputEl) apiKeyInputEl.value = "";
    userBaseUrl = DEFAULT_BASE_URL;
    clearBaseUrl();
    if (baseUrlInputEl) baseUrlInputEl.value = DEFAULT_BASE_URL;
    showToast("已清除 Key");
    setAiLockedUI(true);
    setAnalyzeEnabled(false);
    setChatEnabled(false);
  });
}

if (chatSendBtn) chatSendBtn.addEventListener("click", onSendChat);
if (chatInputEl) {
  chatInputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSendChat();
    }
  });
}

if (summaryTypeEl) {
  summaryTypeEl.addEventListener("change", () => {
    updateJobTargetVisibility();
    showError("");
  });
}

if (viewDocBtn) viewDocBtn.addEventListener("click", openDocModal);
if (docModalCloseBtn) docModalCloseBtn.addEventListener("click", closeDocModal);
if (docModalEl) {
  docModalEl.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.dataset && t.dataset.close) closeDocModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDocModal();
  });
}

async function copyToClipboard(text) {
  const t = safeText(text);
  if (!t) return;
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(t);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = t;
  ta.setAttribute("readonly", "true");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
}

function getCurrentMode() {
  return (summaryTypeEl && summaryTypeEl.value) || "analysis";
}

if (copyResultBtn) {
  copyResultBtn.addEventListener("click", async () => {
    try {
      if (!currentAnalysisResultText || !currentAnalysisResultText.trim()) return;
      await copyToClipboard(currentAnalysisResultText);
      showToast("已复制");
    } catch (e) {
      showToast("复制失败，请手动复制", "error");
    }
  });
}

if (copyParsedBtn) {
  copyParsedBtn.addEventListener("click", async () => {
    try {
      if (!currentText || !currentText.trim()) return;
      await copyToClipboard(currentText);
      showToast("原文已复制");
    } catch (e) {
      showToast("复制失败，请手动复制", "error");
    }
  });
}

if (exportMdBtn) {
  exportMdBtn.addEventListener("click", () => {
    if (!currentAnalysisResultText || !currentAnalysisResultText.trim()) return;
    const base = sanitizeFileBase(currentFileName);
    const mode = getCurrentMode();
    downloadText(`${base}_${mode}_result.md`, currentAnalysisResultText);
    showToast("已导出 Markdown");
  });
}

if (exportTxtBtn) {
  exportTxtBtn.addEventListener("click", () => {
    if (!currentAnalysisResultText || !currentAnalysisResultText.trim()) return;
    const base = sanitizeFileBase(currentFileName);
    const mode = getCurrentMode();
    const plain = mdToPlainText(currentAnalysisResultText);
    downloadText(`${base}_${mode}_result.txt`, plain);
    showToast("已导出 TXT");
  });
}
