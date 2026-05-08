/* ═══════════════════════════════════════════════════════════════
   InfiniteVision Studio — Frontend Logic v1.1 (Vercel Fixed)
   ═══════════════════════════════════════════════════════════════ */

// ─── State ──────────────────────────────────────────────────────
const state = {
  uploadedImageBase64: null,
  currentVideoUrl: null,
  videoHistory: [],
  isGenerating: false,
  apiToken: localStorage.getItem("iv_api_token") || "",
  serverUrl: localStorage.getItem("iv_server_url") || "", // 🔴 Localhost ඉවත් කර හිස් කරන ලදී 
  model: localStorage.getItem("iv_model") || "luma/ray",
};

// ─── DOM ─────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const dropZone        = $("dropZone");
const fileInput       = $("fileInput");
const dropZoneIdle    = $("dropZoneIdle");
const dropZonePreview = $("dropZonePreview");
const previewImg      = $("previewImg");
const browseLink      = $("browseLink");
const btnRemoveImg    = $("btnRemoveImg");
const promptGenerate  = $("promptGenerate");
const charCount       = $("charCount");
const btnGenerate     = $("btnGenerate");
const panelGenerate   = $("panelGenerate");
const panelProgress   = $("panelProgress");
const panelPlayer     = $("panelPlayer");
const panelHistory    = $("panelHistory");
const progressCircle  = $("progressCircle");
const progressPct     = $("progressPct");
const progressLabel   = $("progressLabel");
const psteps          = [1,2,3,4].map(i => $(`pstep${i}`));
const videoPlayer     = $("videoPlayer");
const bigPlayBtn      = $("bigPlayBtn");
const btnDownload     = $("btnDownload");
const btnCopyUrl      = $("btnCopyUrl");
const btnReset        = $("btnReset");
const btnExtend       = $("btnExtend");
const promptExtend    = $("promptExtend");
const historyGrid     = $("historyGrid");
const btnSettings     = $("btnSettings");
const modalBackdrop   = $("modalBackdrop");
const modalClose      = $("modalClose");
const btnModalCancel  = $("btnModalCancel");
const btnModalSave    = $("btnModalSave");
const apiTokenInput   = $("apiTokenInput");
const serverUrlInput  = $("serverUrlInput");
const modelSelect     = $("modelSelect");
const btnToggleToken  = $("btnToggleToken");
const tokenStatus     = $("tokenStatus");
const tokenStatusText = $("tokenStatusText");
const statusDot       = $("statusDot");
const statusText      = $("statusText");
const toast           = $("toast");
const toastIcon       = $("toastIcon");
const toastMsg        = $("toastMsg");

// ─── Progress Ring SVG gradient ──────────────────────────────────
const svgNS = "http://www.w3.org/2000/svg";
const progressRingSvg = document.querySelector(".progress-ring");
const defs = document.createElementNS(svgNS, "defs");
const grad = document.createElementNS(svgNS, "linearGradient");
grad.setAttribute("id", "progressGradient");
grad.setAttribute("x1", "0%"); grad.setAttribute("y1", "0%");
grad.setAttribute("x2", "100%"); grad.setAttribute("y2", "0%");
const stop1 = document.createElementNS(svgNS, "stop");
stop1.setAttribute("offset", "0%"); stop1.setAttribute("stop-color", "#3b82f6");
const stop2 = document.createElementNS(svgNS, "stop");
stop2.setAttribute("offset", "100%"); stop2.setAttribute("stop-color", "#8b5cf6");
grad.appendChild(stop1); grad.appendChild(stop2);
defs.appendChild(grad);
progressRingSvg.prepend(defs);
progressCircle.setAttribute("stroke", "url(#progressGradient)");
const circumference = 2 * Math.PI * 50;
progressCircle.style.strokeDasharray = circumference;
progressCircle.style.strokeDashoffset = circumference;

// ─── Utilities ───────────────────────────────────────────────────
function setProgress(pct, label) {
  progressCircle.style.strokeDashoffset = circumference - (pct / 100) * circumference;
  progressPct.textContent = `${Math.round(pct)}%`;
  if (label) progressLabel.textContent = label;
  psteps.forEach((el, i) => {
    el.classList.remove("active", "done");
    if (pct > i * 25) el.classList.add(pct >= (i + 1) * 25 ? "done" : "active");
  });
}

function setStatus(type, text) {
  statusText.textContent = text;
  statusDot.className = "status-dot";
  if (type === "processing") statusDot.classList.add("processing");
  if (type === "error") statusDot.classList.add("error");
}

let toastTimer;
function showToast(msg, icon = "✓", duration = 3500) {
  clearTimeout(toastTimer);
  toastMsg.textContent = msg;
  toastIcon.textContent = icon;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), duration);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Improved API call with better error messages ─────────────────
async function apiCall(endpoint, body) {
  const url = `${state.serverUrl}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Server error: ${response.status}`);
    }

    return data;

  } catch (err) {
    if (err.name === "TypeError" && err.message.includes("fetch")) {
      throw new Error(
        `Server එකට connect වෙන්න බැරි වුණා!\n\n` +
        `✅ Check කරන්න:\n` +
        `1. Terminal එකේ "npm start" run කළාද?\n` +
        `2. Server URL: ${state.serverUrl}\n` +
        `3. Port 3000 block නෑ නේද?\n\n` +
        `(Failed to connect to ${url})`
      );
    }
    throw err;
  }
}

// ─── Image Drop Zone ──────────────────────────────────────────────
browseLink.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("click", (e) => {
  if (e.target === dropZone || dropZoneIdle.contains(e.target)) fileInput.click();
});
fileInput.addEventListener("change", (e) => {
  if (e.target.files[0]) handleImageFile(e.target.files[0]);
});
dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("drag-over"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith("image/")) handleImageFile(file);
  else showToast("Image file එකක් drop කරන්න (PNG, JPG, WEBP)", "⚠️");
});

function handleImageFile(file) {
  if (file.size > 20 * 1024 * 1024) { showToast("Image 20MB ට අඩු වෙන්න ඕනෑ", "⚠️"); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    state.uploadedImageBase64 = e.target.result;
    previewImg.src = e.target.result;
    dropZoneIdle.style.display = "none";
    dropZonePreview.style.display = "block";
  };
  reader.readAsDataURL(file);
}

btnRemoveImg.addEventListener("click", (e) => {
  e.stopPropagation();
  state.uploadedImageBase64 = null;
  fileInput.value = "";
  previewImg.src = "";
  dropZoneIdle.style.display = "block";
  dropZonePreview.style.display = "none";
});

// ─── Char count ───────────────────────────────────────────────────
promptGenerate.addEventListener("input", () => {
  const len = promptGenerate.value.length;
  charCount.textContent = `${len} / 500`;
  charCount.style.color = len > 450 ? "var(--warning)" : "";
  if (len > 500) promptGenerate.value = promptGenerate.value.slice(0, 500);
});

// ─── Show Panels ─────────────────────────────────────────────────
function showPanel(id) {
  [panelGenerate, panelProgress, panelPlayer, panelHistory].forEach(p => p.style.display = "none");
  const t = $(id);
  if (t) { t.style.display = "block"; }
}
function showPanels(...ids) {
  [panelGenerate, panelProgress, panelPlayer, panelHistory].forEach(p => p.style.display = "none");
  ids.forEach(id => { const p = $(id); if (p) p.style.display = "block"; });
}

// ─── Generate Button State ────────────────────────────────────────
function setBusy(active, mode = "generate") {
  state.isGenerating = active;
  btnGenerate.disabled = active;
  btnExtend.disabled = active;

  if (active) {
    const label = mode === "extend" ? "Extending..." : "Generating...";
    btnGenerate.querySelector(".btn-content").innerHTML = `<span class="spinner"></span> ${label}`;
    btnExtend.querySelector(".btn-content").innerHTML = `<span class="spinner"></span> Extending...`;
    setStatus("processing", label);
  } else {
    btnGenerate.querySelector(".btn-content").innerHTML =
      `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> Generate Video`;
    btnExtend.querySelector(".btn-content").innerHTML =
      `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg> Extend This Video`;
    setStatus("ready", "Ready");
  }
}

let progressInterval;
function startProgressSim() {
  let cur = 5;
  const stages = [
    { target: 20, label: "AI engine connect කරනවා..." },
    { target: 45, label: "Frames process කරනවා..." },
    { target: 72, label: "Video render කරනවා..." },
    { target: 90, label: "Encoding කරනවා..." },
  ];
  let si = 0;
  progressInterval = setInterval(() => {
    if (si < stages.length) {
      if (cur < stages[si].target) { cur = Math.min(cur + 1.2, stages[si].target); setProgress(cur, stages[si].label); }
      else si++;
    }
  }, 400);
}
function stopProgressSim() { clearInterval(progressInterval); }

// ─── Server connection test ───────────────────────────────────────
async function testServerConnection() {
  try {
    const res = await fetch(`${state.serverUrl}/api/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── GENERATE ─────────────────────────────────────────────────────
btnGenerate.addEventListener("click", async () => {
  const prompt = promptGenerate.value.trim();
  if (!prompt && !state.uploadedImageBase64) {
    showToast("Image එකක් upload කරන්න හෝ prompt එකක් ලියන්න", "⚠️");
    return;
  }
  if (!state.apiToken) {
    showToast("Settings (⚙️) එකේ Replicate API token add කරන්න", "🔑");
    openSettingsModal();
    return;
  }

  setStatus("processing", "Server check...");
  
  setBusy(true, "generate");
  showPanel("panelProgress");
  setProgress(5, "Starting generation...");
  startProgressSim();

  try {
    const data = await apiCall("/api/generate", {
      prompt,
      imageBase64: state.uploadedImageBase64 || null,
      apiToken: state.apiToken,
      model: state.model,
    });

    stopProgressSim();
    setProgress(100, "✅ Video ready!");
    await sleep(600);

    state.currentVideoUrl = data.videoUrl;
    state.videoHistory = [{ url: data.videoUrl, label: "Original" }];
    loadVideo(data.videoUrl);
    setBusy(false);
    showPanels("panelPlayer");
    renderHistory();
    showToast("Video generate වුණා! 🎬", "🎉");

  } catch (err) {
    stopProgressSim();
    setBusy(false);
    setStatus("error", "Error");
    showPanel("panelGenerate");
    showToast(err.message.split("\n")[0], "❌", 7000);
    console.error("[Generate]", err);
  }
});

// ─── EXTEND ───────────────────────────────────────────────────────
btnExtend.addEventListener("click", async () => {
  const prompt = promptExtend.value.trim();
  if (!prompt) { showToast("ඊළඟට වෙන දේ describe කරන්න", "⚠️"); promptExtend.focus(); return; }
  if (!state.currentVideoUrl) { showToast("Extend කරන්න video එකක් නෑ", "⚠️"); return; }
  if (!state.apiToken) { showToast("API token add කරන්න", "🔑"); openSettingsModal(); return; }

  setBusy(true, "extend");
  showPanel("panelProgress");
  setProgress(5, "Video extension prepare කරනවා...");
  startProgressSim();

  try {
    const data = await apiCall("/api/extend", {
      sourceVideoUrl: state.currentVideoUrl,
      prompt,
      apiToken: state.apiToken,
      model: state.model,
    });

    stopProgressSim();
    setProgress(100, "✅ Extension complete!");
    await sleep(600);

    state.currentVideoUrl = data.videoUrl;
    state.videoHistory.push({ url: data.videoUrl, label: `Extension ${state.videoHistory.length}` });
    loadVideo(data.videoUrl);
    promptExtend.value = "";
    setBusy(false);
    showPanels("panelPlayer", "panelHistory");
    renderHistory();
    showToast("Video extend වුණා! ✨", "🎬");

  } catch (err) {
    stopProgressSim();
    setBusy(false);
    setStatus("error", "Error");
    showPanels("panelPlayer");
    showToast(err.message.split("\n")[0], "❌", 7000);
    console.error("[Extend]", err);
  }
});

// ─── Video Player ─────────────────────────────────────────────────
function loadVideo(url) {
  videoPlayer.src = url;
  videoPlayer.load();
  videoPlayer.play().catch(() => {});
}

bigPlayBtn.addEventListener("click", () => {
  videoPlayer.paused ? videoPlayer.play() : videoPlayer.pause();
});
videoPlayer.addEventListener("play", () => {
  bigPlayBtn.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
});
videoPlayer.addEventListener("pause", () => {
  bigPlayBtn.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
});

btnDownload.addEventListener("click", () => {
  if (!state.currentVideoUrl) return;
  const a = document.createElement("a");
  a.href = state.currentVideoUrl;
  a.download = `infinitevision_${Date.now()}.mp4`;
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast("Download start වුණා!", "⬇️");
});

btnCopyUrl.addEventListener("click", () => {
  if (!state.currentVideoUrl) return;
  navigator.clipboard.writeText(state.currentVideoUrl)
    .then(() => showToast("URL copy වුණා!", "📋"))
    .catch(() => showToast("Copy fail වුණා", "❌"));
});

btnReset.addEventListener("click", () => {
  if (!confirm("New project start කරන්නද? Current session clear වේවි.")) return;
  Object.assign(state, { uploadedImageBase64: null, currentVideoUrl: null, videoHistory: [] });
  fileInput.value = "";
  promptGenerate.value = "";
  promptExtend.value = "";
  charCount.textContent = "0 / 500";
  previewImg.src = "";
  dropZoneIdle.style.display = "block";
  dropZonePreview.style.display = "none";
  historyGrid.innerHTML = "";
  showPanel("panelGenerate");
  setStatus("ready", "Ready");
  showToast("New project! 🆕", "✨");
});

// ─── History ──────────────────────────────────────────────────────
function renderHistory() {
  if (state.videoHistory.length <= 1) { panelHistory.style.display = "none"; return; }
  panelHistory.style.display = "block";
  historyGrid.innerHTML = "";
  state.videoHistory.forEach((item, idx) => {
    const div = document.createElement("div");
    div.className = "history-item";
    div.innerHTML = `
      <div class="history-item-num">${idx + 1}</div>
      <video src="${item.url}" muted loop preload="metadata" playsinline></video>
      <div class="history-item-label">${item.label}</div>
    `;
    const vid = div.querySelector("video");
    vid.addEventListener("mouseenter", () => vid.play());
    vid.addEventListener("mouseleave", () => vid.pause());
    div.addEventListener("click", () => {
      state.currentVideoUrl = item.url;
      loadVideo(item.url);
      showPanels("panelPlayer", "panelHistory");
      showToast(`Loaded: ${item.label}`, "📼");
    });
    historyGrid.appendChild(div);
  });
}

// ─── Settings Modal ───────────────────────────────────────────────
function openSettingsModal() {
  apiTokenInput.value = state.apiToken;
  serverUrlInput.value = state.serverUrl;
  modelSelect.value = state.model;
  updateTokenStatus();
  modalBackdrop.classList.add("open");
}
function closeSettingsModal() { modalBackdrop.classList.remove("open"); }
function updateTokenStatus() {
  const has = !!apiTokenInput.value.trim();
  tokenStatus.classList.toggle("has-token", has);
  tokenStatusText.textContent = has
    ? `Token set කළා ✅ (${apiTokenInput.value.slice(0, 8)}...)`
    : "Token නෑ — Replicate API token add කරන්න";
}

btnSettings.addEventListener("click", openSettingsModal);
modalClose.addEventListener("click", closeSettingsModal);
btnModalCancel.addEventListener("click", closeSettingsModal);
modalBackdrop.addEventListener("click", (e) => { if (e.target === modalBackdrop) closeSettingsModal(); });
apiTokenInput.addEventListener("input", updateTokenStatus);

btnToggleToken.addEventListener("click", () => {
  const show = apiTokenInput.type === "password";
  apiTokenInput.type = show ? "text" : "password";
  $("eyeIcon").innerHTML = show
    ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
});

btnModalSave.addEventListener("click", () => {
  state.apiToken = apiTokenInput.value.trim();
  state.serverUrl = serverUrlInput.value.trim() || ""; // 🔴 Localhost ඉවත් කර හිස් කරන ලදී
  state.model = modelSelect.value;
  localStorage.setItem("iv_api_token", state.apiToken);
  localStorage.setItem("iv_server_url", state.serverUrl);
  localStorage.setItem("iv_model", state.model);
  closeSettingsModal();
  showToast("Settings save වුණා! ✅", "✅");

  // Auto-test connection
  testServerConnection().then(ok => {
    if (ok) setStatus("ready", "Server Connected ✅");
    else { setStatus("error", "Server offline"); showToast(`Server connect වෙන්න බැරි — "npm start" run කළාද?`, "⚠️", 5000); }
  });
});

// ─── Keyboard Shortcuts ───────────────────────────────────────────
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalBackdrop.classList.contains("open")) closeSettingsModal();
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !state.isGenerating) btnGenerate.click();
  if ((e.metaKey || e.ctrlKey) && e.key === ",") { e.preventDefault(); openSettingsModal(); }
});

// ─── Init ─────────────────────────────────────────────────────────
(function init() {
  showPanel("panelGenerate");
  setStatus("ready", "Ready");
  if (state.apiToken) updateTokenStatus();

  // Auto-check server connection
  testServerConnection().then(ok => {
    if (ok) {
      setStatus("ready", "Server Connected ✅");
    } else {
      setStatus("error", "Server offline");
    }
  });

  if (!state.apiToken) {
    setTimeout(() => showToast("⚙️ Settings click කරලා API token add කරන්න", "💡", 5000), 1500);
  }

  console.log("%c🎬 InfiniteVision Studio v1.1%c\nFixed: Native fetch, better error messages", 
    "font-size:16px;font-weight:bold;color:#3b82f6;", "color:#8899b0;");
})();
