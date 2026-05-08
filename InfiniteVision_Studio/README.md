# 🎬 InfiniteVision Studio

**AI-Powered Image-to-Video Generation & Video Extension Platform**

A cinematic, immersive web application for generating videos from images and extending them infinitely using the Replicate AI API.

---

## ✨ Features

- **Image-to-Video**: Upload any image as a starting frame and animate it with AI
- **Video Extension**: Seamlessly continue any generated video with a new prompt
- **Cinematic UI**: Deep black + glowing purple/blue accent dark theme
- **Secure Backend**: Your API key stays on your machine, never exposed
- **Video History**: Track and replay your entire generation sequence
- **Keyboard Shortcuts**: `Cmd+Enter` to generate, `Cmd+,` for settings

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment (Optional)

```bash
cp .env.example .env
# Edit .env and add your Replicate API Token (or use the UI settings)
```

### 3. Start the Server

```bash
# Production
npm start

# Development (auto-restart on changes)
npm run dev
```

### 4. Open the App

Visit **http://localhost:3000** in your browser.

---

## 🔑 Getting a Replicate API Token

1. Sign up at [replicate.com](https://replicate.com)
2. Go to [Account → API Tokens](https://replicate.com/account/api-tokens)
3. Create a new token
4. Click ⚙️ **Settings** in the app and paste your token

---

## 🤖 AI Models

The app supports multiple Replicate models:

| Model | Description |
|-------|-------------|
| **Luma Ray** (default) | High quality, great for cinematic content |
| **MiniMax Video-01** | Fast generation, good for animation |
| **Luma Ray Flash 2** | Fastest option, lower quality |

---

## 📁 Project Structure

```
InfiniteVision_Studio/
├── server.js          # Express backend (API proxy + polling)
├── package.json       # Node.js dependencies
├── .env.example       # Environment variables template
├── .env               # Your local config (create from .env.example)
└── public/
    ├── index.html     # Main UI
    ├── style.css      # Cinematic dark theme
    └── script.js      # Upload, generate, extend & polling logic
```

---

## 🎯 How It Works

### Image-to-Video (Step 1)
1. Drag & drop your starting image (or skip for text-only)
2. Describe the animation in the prompt
3. Click **Generate Video** — the backend securely calls Replicate
4. Your video appears in the player

### Video Extension (Step 2)
1. After generation, type what happens next in "Extend Video"
2. Click **Extend This Video**
3. The extension uses your current video as context
4. All versions appear in the **Sequence History** panel

---

## 🔧 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/generate` | Image-to-video generation |
| `POST` | `/api/extend` | Video-to-video extension |
| `GET` | `/api/status/:id` | Poll prediction status |
| `GET` | `/api/health` | Health check |

---

## ⚡ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Enter` | Generate video |
| `Cmd/Ctrl + ,` | Open settings |
| `Escape` | Close modal |

---

## 📋 Requirements

- **Node.js** 18+
- **Replicate API Token** (free tier available)
- Modern browser (Chrome, Firefox, Safari, Edge)

---

## 🛠️ Troubleshooting

**"No API token provided"** → Open Settings (⚙️) and add your Replicate token

**Video generation takes long** → This is normal! AI video generation takes 2–5 minutes. The progress bar simulates progress while the server polls Replicate.

**CORS errors** → Make sure you're accessing `http://localhost:3000`, not opening index.html directly as a file.

**"Prediction failed"** → Check your Replicate account has billing set up (video generation costs credits).

---

## 📜 License

MIT — Build freely, create infinitely.

---

*Built with ❤️ using Node.js, Express, and the Replicate AI API*
