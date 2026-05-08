const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());

// 🔴 පින්තූර අප්ලෝඩ් කරන්න ලොකු සයිස් එකක් (50MB) ලබා දීම අනිවාර්යයි
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// ─── Health Check (Frontend එකෙන් සර්වර් එක බලන තැන) ───
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// ─── Zhipu AI (CogVideoX) Image-to-Video Generation ───
app.post('/api/generate', async (req, res) => {
    try {
        // UI එකේ Settings වලින් එන Z.ai API Key එක
        const apiToken = req.body.apiToken;
        const { prompt, imageBase64 } = req.body;

        if (!apiToken) {
            return res.status(400).json({ error: "Z.ai API Token එක Settings වලට ඇතුළත් කරන්න!" });
        }

        // 1. Z.ai වෙත ඉල්ලීම යැවීම
        let payload = {
            model: "cogvideox", // Zhipu AI හි වීඩියෝ මොඩලය
            prompt: prompt
        };

        if (imageBase64) {
            payload.image_url = imageBase64;
        }

        const startRes = await fetch('https://open.bigmodel.cn/api/paas/v4/videos/generations', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const startData = await startRes.json();

        if (startData.error) {
            throw new Error(startData.error.message || "Z.ai එකෙන් වීඩියෝව ආරම්භ කිරීමට නොහැකි විය.");
        }

        const taskId = startData.id;
        console.log(`[Z.ai] Task Started: ${taskId}`);

        // 2. වීඩියෝව හැදෙනකම් Backend එකෙන් පරීක්ෂා කිරීම (Polling)
        let videoUrl = null;
        while (true) {
            await new Promise(resolve => setTimeout(resolve, 4000)); // තත්පර 4ක් රැඳීම

            const pollRes = await fetch(`https://open.bigmodel.cn/api/paas/v4/async-result/${taskId}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${apiToken}` }
            });

            const pollData = await pollRes.json();

            if (pollData.task_status === 'SUCCESS') {
                videoUrl = pollData.video_result[0].url;
                console.log(`[Z.ai] Task Success: ${videoUrl}`);
                break;
            } else if (pollData.task_status === 'FAIL') {
                throw new Error("Z.ai වීඩියෝව සෑදීම අසාර්ථක විය.");
            }
            // PROCESSING නම් දිගටම Loop එක වැඩ කරයි
        }

        // සාර්ථක වුණාම Frontend එකට Video URL එක යවනවා
        res.json({ videoUrl: videoUrl });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// ─── Extend Video (Z.ai සඳහා සකස් කරන ලදී) ───
app.post('/api/extend', async (req, res) => {
    try {
        const apiToken = req.body.apiToken;
        const { prompt } = req.body;

        if (!apiToken) return res.status(400).json({ error: "Z.ai API Token missing" });

        // CogVideoX එකේ Video-to-Video නැති නිසා, කතාව දිගටම යන විදිහට අලුත් Scene එකක් හදනවා
        const startRes = await fetch('https://open.bigmodel.cn/api/paas/v4/videos/generations', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                model: "cogvideox", 
                prompt: prompt + " (Cinematic continuation, exact same style and characters)" 
            })
        });

        const startData = await startRes.json();
        if (startData.error) throw new Error(startData.error.message);

        const taskId = startData.id;
        let videoUrl = null;

        while (true) {
            await new Promise(resolve => setTimeout(resolve, 4000));
            const pollRes = await fetch(`https://open.bigmodel.cn/api/paas/v4/async-result/${taskId}`, {
                headers: { 'Authorization': `Bearer ${apiToken}` }
            });
            const pollData = await pollRes.json();

            if (pollData.task_status === 'SUCCESS') {
                videoUrl = pollData.video_result[0].url; break;
            } else if (pollData.task_status === 'FAIL') {
                throw new Error("Extension generation failed.");
            }
        }

        res.json({ videoUrl: videoUrl });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[Z.ai] Server running on port ${PORT}`));
