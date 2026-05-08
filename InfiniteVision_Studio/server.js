require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const https = require("https");
const http = require("http");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── CORS — fix "Failed to Fetch" ────────────────────────────────
app.use(cors({ origin: "*", methods: ["GET","POST","OPTIONS"], allowedHeaders: ["Content-Type","Authorization","x-api-token"] }));
app.options("*", cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ─── Native HTTPS request (no node-fetch needed) ─────────────────
function httpsRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: options.method || "GET",
      headers: options.headers || {},
    };
    const req = lib.request(reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    if (body) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

async function replicateRequest(endpoint, method, body, apiToken) {
  const result = await httpsRequest(
    `https://api.replicate.com/v1${endpoint}`,
    { method, headers: { "Authorization": `Bearer ${apiToken}`, "Content-Type": "application/json" } },
    body
  );
  if (result.status >= 400) {
    throw new Error(result.body?.detail || result.body?.error || `HTTP ${result.status}`);
  }
  return result.body;
}

async function pollForCompletion(predictionId, apiToken, maxAttempts = 120, intervalMs = 4000) {
  for (let i = 0; i < maxAttempts; i++) {
    const p = await replicateRequest(`/predictions/${predictionId}`, "GET", null, apiToken);
    console.log(`[Poll] ${predictionId} → ${p.status} (${i+1}/${maxAttempts})`);
    if (p.status === "succeeded") return p;
    if (p.status === "failed" || p.status === "canceled") throw new Error(p.error || `Prediction ${p.status}`);
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error("Timed out waiting for video generation.");
}

function extractVideoUrl(output) {
  if (!output) return null;
  if (typeof output === "string") return output;
  if (Array.isArray(output)) return output[0];
  return null;
}

// ─── Health ───────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "InfiniteVision Studio running 🚀", port: PORT });
});

// ─── Generate ─────────────────────────────────────────────────────
app.post("/api/generate", async (req, res) => {
  const { imageBase64, imageUrl, prompt, apiToken } = req.body;
  const token = apiToken || process.env.REPLICATE_API_TOKEN;
  if (!token) return res.status(401).json({ error: "No API token. Add it in ⚙️ Settings." });
  if (!prompt) return res.status(400).json({ error: "Prompt is required." });

  try {
    console.log("\n[Generate] Prompt:", prompt);
    const input = { prompt, aspect_ratio: "16:9", loop: false };
    if (imageBase64) input.start_image_url = imageBase64;
    else if (imageUrl) input.start_image_url = imageUrl;

    const prediction = await replicateRequest("/models/luma/ray/predictions", "POST", { input }, token);
    console.log("[Generate] ID:", prediction.id, "Status:", prediction.status);

    if (prediction.status === "succeeded") {
      return res.json({ videoUrl: extractVideoUrl(prediction.output), predictionId: prediction.id });
    }

    const completed = await pollForCompletion(prediction.id, token);
    const videoUrl = extractVideoUrl(completed.output);
    if (!videoUrl) throw new Error("No video URL in response.");

    console.log("[Generate] ✅", videoUrl);
    return res.json({ videoUrl, predictionId: completed.id });
  } catch (err) {
    console.error("[Generate] ❌", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Extend ───────────────────────────────────────────────────────
app.post("/api/extend", async (req, res) => {
  const { sourceVideoUrl, prompt, apiToken } = req.body;
  const token = apiToken || process.env.REPLICATE_API_TOKEN;
  if (!token) return res.status(401).json({ error: "No API token. Add it in ⚙️ Settings." });
  if (!sourceVideoUrl) return res.status(400).json({ error: "sourceVideoUrl is required." });
  if (!prompt) return res.status(400).json({ error: "Prompt is required." });

  try {
    console.log("\n[Extend] Source:", sourceVideoUrl);
    console.log("[Extend] Prompt:", prompt);
    const input = { prompt, aspect_ratio: "16:9", loop: false, start_video_url: sourceVideoUrl };
    const prediction = await replicateRequest("/models/luma/ray/predictions", "POST", { input }, token);
    console.log("[Extend] ID:", prediction.id, "Status:", prediction.status);

    if (prediction.status === "succeeded") {
      return res.json({ videoUrl: extractVideoUrl(prediction.output), predictionId: prediction.id });
    }

    const completed = await pollForCompletion(prediction.id, token);
    const videoUrl = extractVideoUrl(completed.output);
    if (!videoUrl) throw new Error("No video URL in response.");

    console.log("[Extend] ✅", videoUrl);
    return res.json({ videoUrl, predictionId: completed.id });
  } catch (err) {
    console.error("[Extend] ❌", err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/status/:id", async (req, res) => {
  const token = req.headers["x-api-token"] || process.env.REPLICATE_API_TOKEN;
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    const p = await replicateRequest(`/predictions/${req.params.id}`, "GET", null, token);
    return res.json(p);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║     🎬  InfiniteVision Studio             ║");
  console.log(`║  ✅  http://localhost:${PORT}               ║`);
  console.log("║  ✅  Native HTTPS (no node-fetch)         ║");
  console.log("║  ✅  CORS all origins                     ║");
  console.log("╚══════════════════════════════════════════╝\n");
});
