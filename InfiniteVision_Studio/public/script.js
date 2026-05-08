/* ═══════════════════════════════════════════════════════════════
   InfiniteVision Studio — Frontend Logic
   Handles: Upload, Generate, Poll, Extend, History, Settings
   ═══════════════════════════════════════════════════════════════ */

// ─── State ──────────────────────────────────────────────────────
const state = {
  uploadedImageBase64: null,
  uploadedImageName: null,
  currentVideoUrl: null,
  videoHistory: [],
  isGenerating: false,
  apiToken: localStorage.getItem("iv_api_token") || "",
  serverUrl: localStorage.getItem("iv_server_url") || "http://localhost:3000",
  model: localStorage.getItem("iv_model") || "luma/ray",
};

// ─── DOM Elements ───────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const dropZone       = $("dropZone");
const fileInput      = $("fileInput");
const dropZoneIdle   = $("dropZoneIdle");
const dropZonePreview= $("dropZonePreview");
const previewImg     = $("previewImg");
const browseLink     = $("browseLink");
const btnRemoveImg   = $("btnRemoveImg");
const promptGenerate = $("promptGenerate");
const charCount      = $("charCount");
const btnGenerate    = $("btnGenerate");

const panelGenerate  = $("panelGenerate");
const panelProgress  = $("panelProgress");
const panelPlayer    = $("panelPlayer");
const panelHistory   = $("panelHistory");

const progressCircle = $("progressCircle");
const progressPct    = $("progressPct");
const progressLabel  = $("progressLabel");
const psteps         = [1,2,3,4].map(i => $(`pstep${i}`));

const videoPlayer    = $("videoPlayer");
const bigPlayBtn     = $("bigPlayBtn");
const btnDownload    = $("btnDownload");
const btnCopyUrl     = $("btnCopyUrl");
const btnReset       = $("btnReset");
const btnExtend      = $("btnExtend");
const promptExtend   = $("promptExtend");
const historyGrid    = $("historyGrid");

const btnSettings    = $("btnSettings");
const modalBackdrop  = $("modalBackdrop");
const modalClose     = $("modalClose");
const btnModalCancel = $("btnModalCancel");
const btnModalSave   = $("btnModalSave");
const apiTokenInput  = $("apiTokenInput");
const serverUrlInput = $("serverUrlInput");
const modelSelect    = $("modelSelect");
const btnToggleToken = $("btnToggleToken");
const tokenStatus    = $("tokenStatus");
const tokenStatusText= $("tokenStatusText");

const statusDot      = $("statusDot");
const statusText     = $("statusText");
const toast          = $("toast");
const toastIcon      = $("toastIcon");
const toastMsg       = $("toastMsg");

// ─── Progress Ring Setup ─────────────────────────────────────────
const ring = progressCircle;
const circumference = 2 * Math.PI * 50; // r=50
ring.style.strokeDasharray = circumference;
ring.style.strokeDashoffset = circumference;

// Inject SVG gradient
const svgNS = "http://www.w3.org/2000/svg";
const progressRingSvg = document.querySelector(".progress-ring");
const defs = document.createElementNS(svgNS, "defs");
const grad = document.createElementNS(svgNS, "linearGradient");
grad.setAttribute("id", "progressGradient");
grad.setAttribute("x1", "0%"); grad.setAttribute("y1", "0%");
grad.setAttribute("x2", "100%"); grad.setAttribute("y2", "0%");
const stop1 = document.createElementNS(svgNS, "stop");
stop1.setAttribute("offset", "0%");
stop1.setAttribute("stop-color", "#3b82f6");
const stop2 = document.createElementNS(svgNS, "stop");
stop2.setAttribute("offset", "100%");
stop2.setAttribute("stop-color", "#8b5cf6");
grad.appendChild(stop1);
grad.appendChild(stop2);
defs.appendChild(grad);
progressRingSvg.prepend(defs);
ring.setAttribute("stroke", "url(#progressGradient)");

// ─── Utility: Set Progress ───────────────────────────────────────
function setProgress(pct, label) {
  const offset = circumference - (pct / 100) * circumference;
  ring.style.strokeDashoffset = offset;
  progressPct.textContent = `${Math.round(pct)}%`;
  if (label) progressLabel.textContent = label;

  // Activate steps
  psteps.forEach((el, i) => {
    el.classList.remove("active", "done");
    if (pct > (i * 25)) el.classList.add(pct >= ((i + 1) * 25) ? "done" : "active");
  });
}

// ─── Utility: Status Bar ─────────────────────────────────────────
function setStatus(type, text) {
  statusText.textContent = text;
  statusDot.className = "status-dot";
  if (type === "processing") statusDot.classList.add("processing");
  if (type === "error") statusDot.classList.add("error");
}

// ─── Utility: Toast ──────────────────────────────────────────────
let toastTimer;
function showToast(msg, icon = "✓", duration = 3000) {
  clearTimeout(toastTimer);
  toastMsg.textContent = msg;
  toastIcon.textContent = icon;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), duration);
}

// ─── Image Drop Zone ─────────────────────────────────────────────
browseLink.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("click", (e) => {
  if (e.target === dropZone || dropZoneIdle.contains(e.target)) fileInput.click();
});

fileInput.addEventListener("change", (e) => {
  if (e.target.files[0]) handleImageFile(e.target.files[0]);
});

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith("image/")) handleImageFile(file);
  else showToast("Please drop an image file (PNG, JPG, WEBP)", "⚠️");
});

function handleImageFile(file) {
  if (file.size > 20 * 1024 * 1024) {
    showToast("Image must be under 20MB", "⚠️");
    return;
  }
  state.uploadedImageName = file.name;
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
  state.uploadedImageName = null;
  fileInput.value = "";
  previewImg.src = "";
  dropZoneIdle.style.display = "block";
  dropZonePreview.style.display = "none";
});

// ─── Prompt Character Count ──────────────────────────────────────
promptGenerate.addEventListener("input", () => {
  const len = promptGenerate.value.length;
  charCount.textContent = `${len} / 500`;
  if (len > 450) charCount.style.color = "var(--warning)";
  else if (len > 500) charCount.style.color = "var(--error)";
  else charCount.style.color = "";
  if (len > 500) promptGenerate.value = promptGenerate.value.slice(0, 500);
});

// ─── Show / Hide Panels ──────────────────────────────────────────
function showPanel(panelId) {
  [panelGenerate, panelProgress, panelPlayer, panelHistory].forEach(p => {
    p.style.display = "none";
  });
  const target = $(panelId);
  if (target) {
    target.style.display = "block";
    target.style.animation = "none";
    requestAnimationFrame(() => {
      target.style.animation = "panel-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both";
    });
  }
}

function showMultiplePanels(...panelIds) {
  [panelGenerate, panelProgress, panelPlayer, panelHistory].forEach(p => {
    p.style.display = "none";
  });
  panelIds.forEach(id => {
    const p = $(id);
    if (p) p.style.display = "block";
  });
}

// ─── Disable / Enable Buttons ────────────────────────────────────
function setGenerating(active) {
  state.isGenerating = active;
  btnGenerate.disabled = active;
  btnExtend.disabled = active;
  if (active) {
    btnGenerate.querySelector(".btn-content").innerHTML =
      `<span class="spinner"></span> Generating...`;
    setStatus("processing", "Generating...");
  } else {
    btnGenerate.querySelector(".btn-content").innerHTML =
      `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> Generate Video`;
    setStatus("ready", "Ready");
  }
}

// ─── Main: Generate Video ─────────────────────────────────────────
btnGenerate.addEventListener("click", async () => {
  const prompt = promptGenerate.value.trim();
  if (!prompt && !state.uploadedImageBase64) {
    showToast("Please add an image or enter a prompt", "⚠️");
    return;
  }
  if (!state.apiToken) {
    showToast("Please configure your API token in Settings", "🔑");
    openSettingsModal();
    return;
  }

  setGenerating(true);
  showPanel("panelProgress");
  setProgress(5, "Connecting to AI engine...");

  try {
    // Simulate step progression during wait
    const progressInterval = startProgressSimulation();

    const response = await fetch(`${state.serverUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        imageBase64: state.uploadedImageBase64 || null,
        apiToken: state.apiToken,
        model: state.model,
      }),
    });

    clearInterval(progressInterval);

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Generation failed");

    setProgress(100, "✅ Video ready!");
    await sleep(800);

    state.currentVideoUrl = data.videoUrl;
    state.videoHistory = [{ url: data.videoUrl, label: "Original" }];

    loadVideoIntoPlayer(data.videoUrl);
    setGenerating(false);
    showMultiplePanels("panelPlayer");
    renderHistory();
    showToast("Video generated successfully! 🎬", "🎉");

  } catch (err) {
    clearInterval(window.__progressInterval);
    setProgress(0, "Generation failed");
    setGenerating(false);
    setStatus("error", "Error");
    showPanel("panelGenerate");
    showToast(`Error: ${err.message}`, "❌", 5000);
    console.error("[Generate]", err);
  }
});

// ─── Main: Extend Video ───────────────────────────────────────────
btnExtend.addEventListener("click", async () => {
  const prompt = promptExtend.value.trim();
  if (!prompt) {
    showToast("Please describe what happens next", "⚠️");
    promptExtend.focus();
    return;
  }
  if (!state.currentVideoUrl) {
    showToast("No video to extend", "⚠️");
    return;
  }
  if (!state.apiToken) {
    showToast("Please configure your API token in Settings", "🔑");
    openSettingsModal();
    return;
  }

  setGenerating(true);
  btnExtend.querySelector(".btn-content").innerHTML =
    `<span class="spinner"></span> Extending...`;
  showPanel("panelProgress");
  setProgress(5, "Preparing video extension...");
  setStatus("processing", "Extending video...");

  try {
    const progressInterval = startProgressSimulation();

    const response = await fetch(`${state.serverUrl}/api/extend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceVideoUrl: state.currentVideoUrl,
        prompt,
        apiToken: state.apiToken,
        model: state.model,
      }),
    });

    clearInterval(progressInterval);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Extension failed");

    setProgress(100, "✅ Extension complete!");
    await sleep(800);

    state.currentVideoUrl = data.videoUrl;
    state.videoHistory.push({ url: data.videoUrl, label: `Ext. ${state.videoHistory.length}` });

    loadVideoIntoPlayer(data.videoUrl);
    promptExtend.value = "";
    setGenerating(false);
    btnExtend.querySelector(".btn-content").innerHTML =
      `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg> Extend This Video`;
    showMultiplePanels("panelPlayer", "panelHistory");
    renderHistory();
    setStatus("ready", "Ready");
    showToast("Video extended! 🎬", "✨");

  } catch (err) {
    clearInterval(window.__progressInterval);
    setProgress(0, "Extension failed");
    setGenerating(false);
    btnExtend.querySelector(".btn-content").innerHTML =
      `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg> Extend This Video`;
    setStatus("error", "Error");
    showMultiplePanels("panelPlayer");
    showToast(`Error: ${err.message}`, "❌", 5000);
    console.error("[Extend]", err);
  }
});

// ─── Progress Simulation ─────────────────────────────────────────
function startProgressSimulation() {
  let current = 5;
  const stages = [
    { target: 20, label: "Uploading assets to AI..." },
    { target: 45, label: "AI processing frames..." },
    { target: 70, label: "Rendering video sequence..." },
    { target: 90, label: "Finalizing and encoding..." },
  ];
  let stageIdx = 0;

  const interval = setInterval(() => {
    if (stageIdx < stages.length) {
      const stage = stages[stageIdx];
      if (current < stage.target) {
        current = Math.min(current + 1.5, stage.target);
        setProgress(current, stage.label);
      } else {
        stageIdx++;
      }
    }
  }, 400);

  window.__progressInterval = interval;
  return interval;
}

// ─── Load Video Into Player ───────────────────────────────────────
function loadVideoIntoPlayer(url) {
  videoPlayer.src = url;
  videoPlayer.load();
  videoPlayer.play().catch(() => {});
}

// ─── Big Play Button ──────────────────────────────────────────────
bigPlayBtn.addEventListener("click", () => {
  if (videoPlayer.paused) videoPlayer.play();
  else videoPlayer.pause();
});

videoPlayer.addEventListener("play", () => {
  bigPlayBtn.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
});

videoPlayer.addEventListener("pause", () => {
  bigPlayBtn.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
});

// ─── Download Video ───────────────────────────────────────────────
btnDownload.addEventListener("click", async () => {
  if (!state.currentVideoUrl) return;
  try {
    showToast("Preparing download...", "⏬");
    const a = document.createElement("a");
    a.href = state.currentVideoUrl;
    a.download = `infinitevision_${Date.now()}.mp4`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast("Download started!", "✅");
  } catch (err) {
    window.open(state.currentVideoUrl, "_blank");
  }
});

// ─── Copy URL ─────────────────────────────────────────────────────
btnCopyUrl.addEventListener("click", () => {
  if (!state.currentVideoUrl) return;
  navigator.clipboard.writeText(state.currentVideoUrl)
    .then(() => showToast("Video URL copied to clipboard!", "📋"))
    .catch(() => showToast("Failed to copy URL", "❌"));
});

// ─── Reset / New Project ──────────────────────────────────────────
btnReset.addEventListener("click", () => {
  if (!confirm("Start a new project? This will clear the current session.")) return;
  state.uploadedImageBase64 = null;
  state.uploadedImageName = null;
  state.currentVideoUrl = null;
  state.videoHistory = [];

  fileInput.value = "";
  previewImg.src = "";
  promptGenerate.value = "";
  promptExtend.value = "";
  charCount.textContent = "0 / 500";
  dropZoneIdle.style.display = "block";
  dropZonePreview.style.display = "none";
  historyGrid.innerHTML = "";

  showPanel("panelGenerate");
  setStatus("ready", "Ready");
  showToast("New project started!", "🆕");
});

// ─── History Renderer ─────────────────────────────────────────────
function renderHistory() {
  if (state.videoHistory.length <= 1) {
    panelHistory.style.display = "none";
    return;
  }

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
    div.querySelector("video").addEventListener("mouseenter", (e) => e.target.play());
    div.querySelector("video").addEventListener("mouseleave", (e) => e.target.pause());
    div.addEventListener("click", () => {
      state.currentVideoUrl = item.url;
      loadVideoIntoPlayer(item.url);
      showMultiplePanels("panelPlayer", "panelHistory");
      window.scrollTo({ top: panelPlayer.offsetTop - 80, behavior: "smooth" });
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

function closeSettingsModal() {
  modalBackdrop.classList.remove("open");
}

function updateTokenStatus() {
  const hasToken = !!apiTokenInput.value.trim();
  tokenStatus.classList.toggle("has-token", hasToken);
  tokenStatusText.textContent = hasToken
    ? `Token configured (${apiTokenInput.value.slice(0, 6)}...)`
    : "No token configured — add your Replicate API token";
}

btnSettings.addEventListener("click", openSettingsModal);
modalClose.addEventListener("click", closeSettingsModal);
btnModalCancel.addEventListener("click", closeSettingsModal);
modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) closeSettingsModal();
});

apiTokenInput.addEventListener("input", updateTokenStatus);

// Toggle visibility
btnToggleToken.addEventListener("click", () => {
  const isPassword = apiTokenInput.type === "password";
  apiTokenInput.type = isPassword ? "text" : "password";
  $("eyeIcon").innerHTML = isPassword
    ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
});

btnModalSave.addEventListener("click", () => {
  const token = apiTokenInput.value.trim();
  const serverUrl = serverUrlInput.value.trim() || "http://localhost:3000";
  const model = modelSelect.value;

  state.apiToken = token;
  state.serverUrl = serverUrl;
  state.model = model;

  localStorage.setItem("iv_api_token", token);
  localStorage.setItem("iv_server_url", serverUrl);
  localStorage.setItem("iv_model", model);

  closeSettingsModal();
  showToast("Settings saved successfully!", "✅");

  if (token) {
    setStatus("ready", "Ready");
  }
});

// ─── Keyboard Shortcuts ───────────────────────────────────────────
document.addEventListener("keydown", (e) => {
  // Escape closes modal
  if (e.key === "Escape" && modalBackdrop.classList.contains("open")) {
    closeSettingsModal();
  }
  // Cmd/Ctrl + Enter to generate
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    if (panelGenerate.style.display !== "none" && !state.isGenerating) {
      btnGenerate.click();
    }
  }
  // Cmd/Ctrl + , for settings
  if ((e.metaKey || e.ctrlKey) && e.key === ",") {
    e.preventDefault();
    openSettingsModal();
  }
});

// ─── Helper: Sleep ────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Init ─────────────────────────────────────────────────────────
(function init() {
  showPanel("panelGenerate");
  setStatus("ready", "Ready");

  // Pre-fill settings if saved
  if (state.apiToken) {
    updateTokenStatus();
  }

  // Show settings prompt if no token
  if (!state.apiToken) {
    setTimeout(() => {
      showToast("Add your Replicate API token in Settings to start 🔑", "💡", 5000);
    }, 1200);
  }

  console.log(
    "%c🎬 InfiniteVision Studio%c\nReady to create infinite worlds.",
    "font-size:16px; font-weight:bold; color:#3b82f6;",
    "font-size:12px; color:#8899b0;"
  );
})();
