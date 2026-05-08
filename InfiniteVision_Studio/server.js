const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());

// පින්තූර අප්ලෝඩ් කරන්න ලොකු සයිස් එකක් (50MB) ලබා දීම
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// ─── Z.ai (CogVideoX-Flash) Generate ───
app.post('/api/generate', async (req, res) => {
    try {
        const apiToken = req.body.apiToken;
        const { prompt, imageBase64 } = req.body;

        if (!apiToken) {
            return res.status(400).json({ error: "Z.ai API Token එක Settings වලට ඇතුළත් කරන්න!" });
        }

        let payload = {
            model: "cogvideox-flash", // 🔴 අලුත්ම නොමිලේ දෙන මොඩල් එක 
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

        if (startData.error) throw new Error(startData.error.message || "වීඩියෝව ආරම්භ කිරීමට නොහැකි විය.");

        const taskId = startData.id;
        let videoUrl = null;

        while (true) {
            await new Promise(resolve => setTimeout(resolve, 4000));
            const pollRes = await fetch(`https://open.bigmodel.cn/api/paas/v4/async-result/${taskId}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${apiToken}` }
            });
            const pollData = await pollRes.json();

            if (pollData.task_status === 'SUCCESS') {
                videoUrl = pollData.video_result[0].url; break;
            } else if (pollData.task_status === 'FAIL') {
                throw new Error("වීඩියෝව සෑදීම අසාර්ථක විය.");
            }
        }

        res.json({ videoUrl: videoUrl });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// ─── Z.ai (CogVideoX-Flash) Extend ───
app.post('/api/extend', async (req, res) => {
    try {
        const apiToken = req.body.apiToken;
        const { prompt } = req.body;

        if (!apiToken) return res.status(400).json({ error: "Z.ai API Token missing" });

        const startRes = await fetch('https://open.bigmodel.cn/api/paas/v4/videos/generations', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                model: "cogvideox-flash", // 🔴 අලුත්ම නොමිලේ දෙන මොඩල් එක
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
