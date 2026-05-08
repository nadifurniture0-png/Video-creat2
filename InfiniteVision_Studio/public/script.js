/* ═══════════════════════════════════════════════════════════════
   InfiniteVision Studio — v1.4 (Full: UI + Infinite Flow + Gallery)
   ═══════════════════════════════════════════════════════════════ */

// ─── State ──────────────────────────────────────────────────────
const state = {
  uploadedImageBase64: null,
  currentVideoUrl: null,
  // 🔴 Gallery එක ෆෝන් එකේ මතකයෙන් (localStorage) load කිරීම
  videoHistory: JSON.parse(localStorage.getItem("iv_gallery")) || [],
  isGenerating: false,
  serverUrl: localStorage.getItem("iv_server_url") || "",
};

// ─── DOM Elements ────────────────────────────────────────────────
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
const toast           = $("toast");
const toastIcon       = $("toastIcon");
const toastMsg        = $("toastMsg");
const statusDot       = $("statusDot");
const statusText      = $("statusText");

// ─── Utilities ───────────────────────────────────────────────────
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

// ─── Gallery Functions ───────────────────────────────────────────
function saveToGallery(url, label) {
  const videoData = { url, label, timestamp: new Date().getTime() };
  state.videoHistory.push(videoData);
  localStorage.setItem("iv_gallery", JSON.stringify(state.videoHistory));
  renderGallery();
}

function renderGallery() {
  if (state.videoHistory.length === 0) { 
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
      <button class="btn-delete" onclick="deleteFromGallery(${idx}, event)" style="position:absolute; top:5px; right:5px; background:red; color:white; border:none; border-radius:5px; cursor:pointer;">🗑️</button>
    `;
    const vid = div.querySelector("video");
    vid.addEventListener("mouseenter", () => vid.play());
    vid.addEventListener("mouseleave", () => vid.pause());
    
    div.onclick = () => {
      state.currentVideoUrl = item.url;
      loadVideo(item.url);
      showPanels("panelPlayer", "panelHistory");
      showToast(`Loaded: ${item.label}`, "📼");
    };
    historyGrid.appendChild(div);
  });
}

window.deleteFromGallery = (idx, event) => {
  event.stopPropagation();
  if (confirm("මේ වීඩියෝව Gallery එකෙන් ඉවත් කරන්නද?")) {
    state.videoHistory.splice(idx, 1);
    localStorage.setItem("iv_gallery", JSON.stringify(state.videoHistory));
    renderGallery();
  }
};

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
    if (!response.ok) throw new Error(data.error || `Server error`);
    return data;
  } catch (err) {
    throw new Error(`Server එකට connect වෙන්න බැරි වුණා!`);
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
});

function handleImageFile(file) {
  if (file.size > 20 * 1024 * 1024) return showToast("Image 20MB ට අඩු වෙන්න ඕනෑ", "⚠️");
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

// ─── Char count & Panels ──────────────────────────────────────────
promptGenerate.addEventListener("input", () => {
  const len = promptGenerate.value.length;
  charCount.textContent = `${len} / 500`;
  if (len > 500) promptGenerate.value = promptGenerate.value.slice(0, 500);
});

function showPanel(id) {
  [panelGenerate, panelProgress, panelPlayer].forEach(p => p.style.display = "none");
  const t = $(id);
  if (t) t.style.display = "block";
}
function showPanels(...ids) {
  [panelGenerate, panelProgress, panelPlayer].forEach(p => p.style.display = "none");
  ids.forEach(id => { const p = $(id); if (p) p.style.display = "block"; });
}

// ─── Progress Animation ───────────────────────────────────────────
const circumference = 2 * Math.PI * 50;
function setProgress(pct, label) {
  progressCircle.style.strokeDashoffset = circumference - (pct / 100) * circumference;
  progressPct.textContent = `${Math.round(pct)}%`;
  if (label) progressLabel.textContent = label;
}

let progressInterval;
function startProgressSim() {
  let cur = 5;
  progressInterval = setInterval(() => {
    if (cur < 90) { cur += 1.5; setProgress(cur, "Processing with Z.ai..."); }
  }, 500);
}
function stopProgressSim() { clearInterval(progressInterval); }

// ─── 🔴 Capture Last Frame (Infinite Flow) ───
function captureLastFrame() {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = videoPlayer.videoWidth || 1280;
    canvas.height = videoPlayer.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    videoPlayer.currentTime = videoPlayer.duration || 0;
    setTimeout(() => {
      ctx.drawImage(videoPlayer, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    }, 300);
  });
}

// ─── GENERATE (පළමු වීඩියෝව) ──────────────────────────────────────
btnGenerate.addEventListener("click", async () => {
  const prompt = promptGenerate.value.trim();
  if (!prompt && !state.uploadedImageBase64) return showToast("Image එකක් හෝ prompt එකක් දෙන්න", "⚠️");

  state.isGenerating = true;
  btnGenerate.disabled = true;
  setStatus("processing", "Generating...");
  showPanel("panelProgress");
  setProgress(5, "Starting...");
  startProgressSim();

  try {
    const data = await apiCall("/api/generate", { prompt, imageBase64: state.uploadedImageBase64 });
    
    stopProgressSim();
    setProgress(100, "✅ Video ready!");
    await sleep(600);

    state.currentVideoUrl = data.videoUrl;
    loadVideo(data.videoUrl);
    
    // Gallery එකට සේව් කිරීම
    saveToGallery(data.videoUrl, `Part ${state.videoHistory.length + 1}`);

    state.isGenerating = false;
    btnGenerate.disabled = false;
    showPanels("panelPlayer", "panelHistory");
    showToast("Video generate වුණා! 🎬", "🎉");
  } catch (err) {
    stopProgressSim();
    state.isGenerating = false;
    btnGenerate.disabled = false;
    setStatus("error", "Error");
    showPanel("panelGenerate");
    showToast(err.message, "❌", 5000);
  }
});

// ─── EXTEND (දිගටම හැදීම) ────────────────────────────────────────
btnExtend.addEventListener("click", async () => {
  const prompt = promptExtend.value.trim();
  if (!prompt) return showToast("ඊළඟට වෙන දේ describe කරන්න", "⚠️");
  if (!state.currentVideoUrl) return;

  state.isGenerating = true;
  btnExtend.disabled = true;
  showPanel("panelProgress");
  setProgress(5, "අවසන් රූපය ලබාගනිමින් පවතී...");
  
  const lastFrameBase64 = await captureLastFrame();
  startProgressSim();

  try {
    const data = await apiCall("/api/generate", { prompt: prompt + " (Seamless continuation)", imageBase64: lastFrameBase64 });

    stopProgressSim();
    setProgress(100, "✅ Extension complete!");
    await sleep(600);

    state.currentVideoUrl = data.videoUrl;
    loadVideo(data.videoUrl);
    
    // Gallery එකට අලුත් කොටස සේව් කිරීම
    saveToGallery(data.videoUrl, `Part ${state.videoHistory.length + 1}`);

    promptExtend.value = "";
    state.isGenerating = false;
    btnExtend.disabled = false;
    showPanels("panelPlayer", "panelHistory");
    showToast("වීඩියෝව සම්බන්ධ විය! ✨", "🎬");
  } catch (err) {
    stopProgressSim();
    state.isGenerating = false;
    btnExtend.disabled = false;
    showPanels("panelPlayer", "panelHistory");
    showToast(err.message, "❌", 5000);
  }
});

// ─── Video Player & Playlist Playback ─────────────────────────────
function loadVideo(url) {
  videoPlayer.src = url;
  videoPlayer.load();
  videoPlayer.play().catch(() => {});
}

bigPlayBtn.addEventListener("click", () => { videoPlayer.paused ? videoPlayer.play() : videoPlayer.pause(); });

// එක දිගට ප්ලේ වීම
videoPlayer.addEventListener("ended", () => {
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
  a.download = `video_${Date.now()}.mp4`;
  a.click();
  showToast("Download start වුණා!", "⬇️");
});

btnCopyUrl.addEventListener("click", () => {
  if (!state.currentVideoUrl) return;
  navigator.clipboard.writeText(state.currentVideoUrl).then(() => showToast("URL copy වුණා!", "📋"));
});

btnReset.addEventListener("click", () => {
  if (!confirm("New project start කරන්නද? (Gallery එකේ ඒවා මැකෙන්නේ නෑ)")) return;
  state.uploadedImageBase64 = null;
  state.currentVideoUrl = null;
  fileInput.value = "";
  promptGenerate.value = "";
  promptExtend.value = "";
  previewImg.src = "";
  dropZoneIdle.style.display = "block";
  dropZonePreview.style.display = "none";
  showPanel("panelGenerate");
  renderGallery();
});

// ─── Init ─────────────────────────────────────────────────────────
(function init() {
  showPanel("panelGenerate");
  setStatus("ready", "Server Connected ✅");
  renderGallery(); // ඇප් එක ඕපන් කරද්දි Gallery එක පෙන්නනවා
})();
