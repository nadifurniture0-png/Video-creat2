const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', provider: 'Z.ai (100% Free)' });
});

// 🔴 ඔයා ලබාදුන් අලුත්ම Z.ai API Key එක
const ZAI_KEY = "7ea876cf15a44df78674c97e63c007f1.furCMPwCsdWiHUdz";

app.post('/api/generate', async (req, res) => {
    try {
        const { prompt, imageBase64 } = req.body;
        if (!prompt) return res.status(400).json({ error: "Prompt එකක් අවශ්‍යයි." });

        let payload = { model: "cogvideox-flash", prompt: prompt };
        if (imageBase64) { payload.image_url = imageBase64; }

        let startData;
        let retries = 5; 

        while (retries > 0) {
            const startRes = await fetch('https://open.bigmodel.cn/api/paas/v4/videos/generations', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${ZAI_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            startData = await startRes.json();

            if (startData.error && startData.error.message && startData.error.message.includes("访问量过大")) {
                console.log(`[Z.ai] Busy. Retrying... (${retries})`);
                retries--;
                await new Promise(r => setTimeout(r, 5000));
            } else { break; }
        }

        if (startData.error) throw new Error(startData.error.message || "හදිසි දෝෂයකි.");

        const taskId = startData.id;
        let videoUrl = null;

        while (true) {
            await new Promise(r => setTimeout(r, 4000));
            const pollRes = await fetch(`https://open.bigmodel.cn/api/paas/v4/async-result/${taskId}`, {
                headers: { 'Authorization': `Bearer ${ZAI_KEY}` }
            });
            const pollData = await pollRes.json();

            if (pollData.task_status === 'SUCCESS') {
                videoUrl = pollData.video_result[0].url; 
                break;
            } else if (pollData.task_status === 'FAIL') {
                throw new Error("වීඩියෝව සෑදීම අසාර්ථක විය.");
            }
        }
        res.json({ videoUrl: videoUrl });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 InfiniteVision Server Running with Z.ai`));
