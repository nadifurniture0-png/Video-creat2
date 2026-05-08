/* ═══════════════════════════════════════════════════════════════
   InfiniteVision Studio — Frontend Logic v1.2 (Infinite Flow)
   ═══════════════════════════════════════════════════════════════ */

// ─── State ──────────────────────────────────────────────────────
const state = {
  uploadedImageBase64: null,
  currentVideoUrl: null,
  videoHistory: [],
  isGenerating: false,
  serverUrl: localStorage.getItem("iv_server_url") || "",
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

// ─── API Call ─────────────────────────────────────────────────────
async function apiCall(endpoint, body) {
  const url = `${state.serverUrl}${endpoint}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Server error: ${response.status}`);
    return data;
  } catch (err) {
    if (err.name === "TypeError" && err.message.includes("fetch")) {
      throw new Error(`Server එකට connect වෙන්න බැරි වුණා! Terminal එකේ "npm start" run කළාද?`);
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
  else showToast("Image file එකක් drop කරන්න", "⚠️");
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
    btnGenerate.querySelector(".btn-content").innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> Generate Video`;
    btnExtend.querySelector(".btn-content").innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg> Extend This Video`;
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

async function testServerConnection() {
  try {
    const res = await fetch(`${state.serverUrl}/api/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch { return false; }
}

// ─── 🔴 අලුත්: අවසන් රූපය ලබා ගැනීමේ ක්‍රමය (Capture Last Frame) ───
function captureLastFrame() {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = videoPlayer.videoWidth || 1280;
    canvas.height = videoPlayer.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    
    // වීඩියෝවේ අවසාන මොහොතට යන්න
    videoPlayer.currentTime = videoPlayer.duration || 0;
    
    setTimeout(() => {
      ctx.drawImage(videoPlayer, 0, 0, canvas.width, canvas.height);
      const base64Image = canvas.toDataURL("image/jpeg", 0.9);
      resolve(base64Image);
    }, 300); // Frame එක load වෙන්න පොඩි වෙලාවක් දෙනවා
  });
}

// ─── GENERATE (පළමු වීඩියෝව) ──────────────────────────────────────
btnGenerate.addEventListener("click", async () => {
  const prompt = promptGenerate.value.trim();
  if (!prompt && !state.uploadedImageBase64) {
    showToast("Image එකක් upload කරන්න හෝ prompt එකක් ලියන්න", "⚠️");
    return;
  }

  setBusy(true, "generate");
  showPanel("panelProgress");
  setProgress(5, "Starting generation...");
  startProgressSim();

  try {
    const data = await apiCall("/api/generate", {
      prompt,
      imageBase64: state.uploadedImageBase64 || null
    });

    stopProgressSim();
    setProgress(100, "✅ Video ready!");
    await sleep(600);

    state.currentVideoUrl = data.videoUrl;
    state.videoHistory = [{ url: data.videoUrl, label: "Part 1" }];
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
  }
});

// ─── 🔴 EXTEND (වීඩියෝව එක දිගට ගෙන යාම) ──────────────────────────
btnExtend.addEventListener("click", async () => {
  const prompt = promptExtend.value.trim();
  if (!prompt) { showToast("ඊළඟට වෙන දේ describe කරන්න", "⚠️"); promptExtend.focus(); return; }
  if (!state.currentVideoUrl) { showToast("Extend කරන්න video එකක් නෑ", "⚠️"); return; }

  setBusy(true, "extend");
  showPanel("panelProgress");
  setProgress(5, "පරණ වීඩියෝවේ අන්තිම රූපය ලබාගනිමින් පවතී...");
  
  // 1. පරණ වීඩියෝවේ අන්තිම රූපය ලබාගැනීම
  const lastFrameBase64 = await captureLastFrame();
  
  startProgressSim();

  try {
    // 2. අලුත් Generate API එකටම පින්තූරය යැවීම
    const data = await apiCall("/api/generate", {
      prompt: prompt + " (Seamless continuation)",
      imageBase64: lastFrameBase64
    });

    stopProgressSim();
    setProgress(100, "✅ Extension complete!");
    await sleep(600);

    state.currentVideoUrl = data.videoUrl;
    state.videoHistory.push({ url: data.videoUrl, label: `Part ${state.videoHistory.length + 1}` });
    
    loadVideo(data.videoUrl);
    promptExtend.value = "";
    setBusy(false);
    showPanels("panelPlayer", "panelHistory");
    renderHistory();
    showToast("වීඩියෝව සාර්ථකව සම්බන්ධ විය! ✨", "🎬");

  } catch (err) {
    stopProgressSim();
    setBusy(false);
    setStatus("error", "Error");
    showPanels("panelPlayer");
    showToast(err.message.split("\n")[0], "❌", 7000);
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

// 🔴 බහු වීඩියෝ (Playlist) Playback ක්‍රමය
videoPlayer.addEventListener("ended", () => {
   // දැනට ප්ලේ වෙන එක ඉවර වුණාම, ඊළඟ එකක් තියෙනවා නම් ඒක ප්ලේ වෙනවා
   const currentIndex = state.videoHistory.findIndex(v => v.url === state.currentVideoUrl);
   if (currentIndex >= 0 && currentIndex < state.videoHistory.length - 1) {
       const nextVideoUrl = state.videoHistory[currentIndex + 1].url;
       state.currentVideoUrl = nextVideoUrl;
       loadVideo(nextVideoUrl);
       showToast(`Playing Part ${currentIndex + 2}`, "▶️", 2000);
   }
});

btnDownload.addEventListener("click", () => {
  if (!state.currentVideoUrl) return;
  const a = document.createElement("a");
  a.href = state.currentVideoUrl;
  a.download = `infinitevision_part_${Date.now()}.mp4`;
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

// ─── Settings Modal (API Key ඉවත් කර ඇත) ─────────────────────────
function openSettingsModal() { modalBackdrop.classList.add("open"); }
function closeSettingsModal() { modalBackdrop.classList.remove("open"); }

btnSettings.addEventListener("click", openSettingsModal);
modalClose.addEventListener("click", closeSettingsModal);
btnModalCancel.addEventListener("click", closeSettingsModal);
modalBackdrop.addEventListener("click", (e) => { if (e.target === modalBackdrop) closeSettingsModal(); });

// ─── Init ─────────────────────────────────────────────────────────
(function init() {
  showPanel("panelGenerate");
  setStatus("ready", "Ready");
  
  testServerConnection().then(ok => {
    if (ok) setStatus("ready", "Server Connected ✅");
    else setStatus("error", "Server offline");
  });

  console.log("%c🎬 InfiniteVision Studio v1.2%c\nInfinite Flow Integrated", 
    "font-size:16px;font-weight:bold;color:#3b82f6;", "color:#8899b0;");
})();
