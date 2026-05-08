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

// 🔴 ඔයා ලබාදුන් Fal.ai API Key එක මෙතන ස්ථිරවම යොදා ඇත
const FAL_KEY = "fc0b7e03-d519-487e-92b7-20b99a2124e7:af7b8a506444be5d657cf41527c46de2";

// ─── Fal.ai (Luma Dream Machine) Generate Video ───
app.post('/api/generate', async (req, res) => {
    try {
        const { prompt, imageBase64 } = req.body;

        let payload = {
            prompt: prompt || "Cinematic beautiful motion",
        };

        if (imageBase64) {
            payload.image_url = imageBase64; // පින්තූරයක් තිබේ නම් එය යොදාගනී
        }

        // 1. Fal.ai Queue එකට වීඩියෝව හදන්න යැවීම
        const startRes = await fetch('https://queue.fal.run/fal-ai/luma-dream-machine', {
            method: 'POST',
            headers: {
                'Authorization': `Key ${FAL_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const startData = await startRes.json();
        if (!startRes.ok) throw new Error(startData.detail || "Fal.ai සර්වර් දෝෂයකි.");

        const requestId = startData.request_id;
        let videoUrl = null;

        // 2. වීඩියෝව හැදෙනකම් පරීක්ෂා කිරීම (Polling)
        while (true) {
            await new Promise(resolve => setTimeout(resolve, 3000)); // තත්පර 3න් 3ට බලනවා

            const statusRes = await fetch(`https://queue.fal.run/fal-ai/luma-dream-machine/requests/${requestId}/status`, {
                method: 'GET',
                headers: { 'Authorization': `Key ${FAL_KEY}` }
            });
            const statusData = await statusRes.json();

            if (statusData.status === 'COMPLETED') {
                // වීඩියෝව හැදී අවසන් නම් URL එක ගැනීම
                const resultRes = await fetch(`https://queue.fal.run/fal-ai/luma-dream-machine/requests/${requestId}`, {
                    headers: { 'Authorization': `Key ${FAL_KEY}` }
                });
                const resultData = await resultRes.json();
                videoUrl = resultData.video.url; 
                break;
            } else if (statusData.status === 'IN_QUEUE' || statusData.status === 'IN_PROGRESS') {
                console.log(`[Fal.ai] Processing video...`);
                continue;
            } else {
                throw new Error("වීඩියෝව සෑදීම අසාර්ථක විය.");
            }
        }

        res.json({ videoUrl: videoUrl });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// ─── Fal.ai Extend Video ───
app.post('/api/extend', async (req, res) => {
    try {
        const { prompt } = req.body;

        let payload = {
            prompt: prompt + " (Seamless continuation, highly detailed, cinematic)",
        };

        const startRes = await fetch('https://queue.fal.run/fal-ai/luma-dream-machine', {
            method: 'POST',
            headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const startData = await startRes.json();
        if (!startRes.ok) throw new Error(startData.detail || "Extension error");

        const requestId = startData.request_id;
        let videoUrl = null;

        while (true) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            const statusRes = await fetch(`https://queue.fal.run/fal-ai/luma-dream-machine/requests/${requestId}/status`, {
                headers: { 'Authorization': `Key ${FAL_KEY}` }
            });
            const statusData = await statusRes.json();

            if (statusData.status === 'COMPLETED') {
                const resultRes = await fetch(`https://queue.fal.run/fal-ai/luma-dream-machine/requests/${requestId}`, {
                    headers: { 'Authorization': `Key ${FAL_KEY}` }
                });
                const resultData = await resultRes.json();
                videoUrl = resultData.video.url; 
                break;
            } else if (statusData.status === 'IN_QUEUE' || statusData.status === 'IN_PROGRESS') {
                continue;
            } else {
                throw new Error("Extension generation failed.");
            }
        }

        res.json({ videoUrl: videoUrl });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[Fal.ai] Server running on port ${PORT}`));
