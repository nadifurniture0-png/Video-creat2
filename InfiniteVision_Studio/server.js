require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ─── Replicate API Helper ──────────────────────────────────────────────────────
const REPLICATE_BASE_URL = "https://api.replicate.com/v1";

async function replicateRequest(endpoint, method, body, apiToken) {
  const response = await fetch(`${REPLICATE_BASE_URL}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      Prefer: "wait",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Replicate API error: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

// ─── Polling Helper ────────────────────────────────────────────────────────────
async function pollForCompletion(predictionId, apiToken, maxAttempts = 120, intervalMs = 3000) {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const prediction = await replicateRequest(
      `/predictions/${predictionId}`,
      "GET",
      null,
      apiToken
    );

    console.log(`[Poll] Prediction ${predictionId} — Status: ${prediction.status} (attempt ${attempts + 1})`);

    if (prediction.status === "succeeded") {
      return prediction;
    }

    if (prediction.status === "failed" || prediction.status === "canceled") {
      throw new Error(
        prediction.error || `Prediction ${prediction.status}: ${predictionId}`
      );
    }

    // Still processing — wait and retry
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    attempts++;
  }

  throw new Error(`Prediction timed out after ${maxAttempts} polling attempts.`);
}

// ─── Route: Health Check ────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "InfiniteVision Studio is running 🚀" });
});

// ─── Route: Image-to-Video Generation ─────────────────────────────────────────
app.post("/api/generate", async (req, res) => {
  const { imageUrl, imageBase64, prompt, apiToken } = req.body;

  const token = apiToken || process.env.REPLICATE_API_TOKEN;

  if (!token) {
    return res.status(401).json({
      error: "No API token provided. Please add your Replicate API Token in Settings.",
    });
  }

  if (!prompt) {
    return res.status(400).json({ error: "A prompt is required to generate a video." });
  }

  try {
    console.log("[Generate] Starting Image-to-Video generation...");
    console.log("[Generate] Prompt:", prompt);

    // Build the input payload for luma/ray (supports image + prompt)
    const input = {
      prompt: prompt,
      aspect_ratio: "16:9",
      loop: false,
    };

    // Attach image if provided
    if (imageUrl) {
      input.start_image_url = imageUrl;
    } else if (imageBase64) {
      input.start_image_url = imageBase64;
    }

    // Create prediction using luma/ray model
    const prediction = await replicateRequest(
      "/models/luma/ray/predictions",
      "POST",
      { input },
      token
    );

    console.log("[Generate] Prediction created:", prediction.id, "Status:", prediction.status);

    // If already succeeded (sync response)
    if (prediction.status === "succeeded") {
      const videoUrl = Array.isArray(prediction.output)
        ? prediction.output[0]
        : prediction.output;
      return res.json({ videoUrl, predictionId: prediction.id });
    }

    // Otherwise poll until done
    const completed = await pollForCompletion(prediction.id, token);
    const videoUrl = Array.isArray(completed.output)
      ? completed.output[0]
      : completed.output;

    console.log("[Generate] ✅ Video generated:", videoUrl);
    return res.json({ videoUrl, predictionId: completed.id });
  } catch (err) {
    console.error("[Generate] ❌ Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Route: Video Extension (Video-to-Video) ────────────────────────────────────
app.post("/api/extend", async (req, res) => {
  const { sourceVideoUrl, prompt, apiToken } = req.body;

  const token = apiToken || process.env.REPLICATE_API_TOKEN;

  if (!token) {
    return res.status(401).json({
      error: "No API token provided. Please add your Replicate API Token in Settings.",
    });
  }

  if (!sourceVideoUrl) {
    return res.status(400).json({ error: "A source video URL is required to extend a video." });
  }

  if (!prompt) {
    return res.status(400).json({ error: "A continuation prompt is required." });
  }

  try {
    console.log("[Extend] Starting Video Extension...");
    console.log("[Extend] Source video:", sourceVideoUrl);
    console.log("[Extend] Continuation prompt:", prompt);

    // Build the input payload — luma/ray supports end_image_url / video
    const input = {
      prompt: prompt,
      aspect_ratio: "16:9",
      loop: false,
    };

    // Try to use the video as a start/end frame reference
    // luma/ray supports start_image_url (first frame) — we use the last frame concept
    // For video-to-video extension we pass the video URL as start context
    input.start_video_url = sourceVideoUrl;

    // Create prediction using luma/ray model
    const prediction = await replicateRequest(
      "/models/luma/ray/predictions",
      "POST",
      { input },
      token
    );

    console.log("[Extend] Prediction created:", prediction.id, "Status:", prediction.status);

    // If already succeeded
    if (prediction.status === "succeeded") {
      const videoUrl = Array.isArray(prediction.output)
        ? prediction.output[0]
        : prediction.output;
      return res.json({ videoUrl, predictionId: prediction.id });
    }

    // Poll until done
    const completed = await pollForCompletion(prediction.id, token);
    const videoUrl = Array.isArray(completed.output)
      ? completed.output[0]
      : completed.output;

    console.log("[Extend] ✅ Extended video generated:", videoUrl);
    return res.json({ videoUrl, predictionId: completed.id });
  } catch (err) {
    console.error("[Extend] ❌ Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Route: Poll Prediction Status ─────────────────────────────────────────────
app.get("/api/status/:predictionId", async (req, res) => {
  const { predictionId } = req.params;
  const apiToken = req.headers["x-api-token"];
  const token = apiToken || process.env.REPLICATE_API_TOKEN;

  if (!token) {
    return res.status(401).json({ error: "No API token provided." });
  }

  try {
    const prediction = await replicateRequest(
      `/predictions/${predictionId}`,
      "GET",
      null,
      token
    );
    return res.json(prediction);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Catch-all: Serve index.html ────────────────────────────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ─── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log("\n╔════════════════════════════════════════════╗");
  console.log("║       🎬 InfiniteVision Studio              ║");
  console.log("╠════════════════════════════════════════════╣");
  console.log(`║  Server running at http://localhost:${PORT}   ║`);
  console.log("║  Image-to-Video + Video Extension Ready    ║");
  console.log("╚════════════════════════════════════════════╝\n");
});
