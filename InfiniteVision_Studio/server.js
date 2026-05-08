const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());

// 🔴 වැදගත්: පින්තූර Base64 විදිහට එන නිසා ලිමිට් එක 50MB කළා
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

// සර්වර් එක වැඩද බලන්න
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', provider: 'Fal.ai (Luma)' });
});

// 🔴 ඔයාගේ Fal.ai API Key එක
const FAL_KEY = "fc0b7e03-d519-487e-92b7-20b99a2124e7:af7b8a506444be5d657cf41527c46de2";

// ─── Infinite Video Generation (Image-to-Video) ───
app.post('/api/generate', async (req, res) => {
    try {
        const { prompt, imageBase64 } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: "Prompt එකක් අවශ්‍යයි." });
        }

        // 1. Fal.ai වෙත යවන Payload එක සකස් කිරීම
        // පරණ වීඩියෝවේ අන්තිම frame එක imageBase64 විදිහට මෙතනට ලැබෙනවා
        let inputData = {
            prompt: prompt,
            aspect_ratio: "16:9",
            loop: false
        };

        if (imageBase64) {
            inputData.image_url = imageBase64; // මෙතනින් තමයි වීඩියෝ දෙක සම්බන්ධ වෙන්නේ
        }

        console.log(`[Fal.ai] Starting generation... Prompt: ${prompt}`);

        // 2. Fal.ai සර්වර් එකට ඉල්ලීම යැවීම
        const response = await fetch('https://queue.fal.run/fal-ai/luma-dream-machine', {
            method: 'POST',
            headers: {
                'Authorization': `Key ${FAL_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(inputData)
        });

        const startData = await response.json();
        if (!response.ok) throw new Error(startData.detail || "Fal.ai සර්වර් එක සමඟ සම්බන්ධ විය නොහැක.");

        const requestId = startData.request_id;
        console.log(`[Fal.ai] Request ID: ${requestId}`);

        // 3. වීඩියෝව හැදෙනකම් පොඩි වෙලාවක් රැඳී සිට පරීක්ෂා කිරීම (Polling)
        // සටහන: Vercel වල තත්පර 10කට වඩා මේක බලාගෙන හිටියොත් Timeout වෙන්න පුළුවන්. 
        // ඒ නිසා අපි සර්වර් එකේම බලාගෙන ඉන්නවා හැකි උපරිම වෙලාව.
        let videoUrl = null;
        let attempts = 0;
        const maxAttempts = 30; // තත්පර 90ක් (3s * 30) බලාගෙන ඉන්නවා

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            attempts++;

            const statusRes = await fetch(`https://queue.fal.run/fal-ai/luma-dream-machine/requests/${requestId}/status`, {
                headers: { 'Authorization': `Key ${FAL_KEY}` }
            });
            const statusData = await statusRes.json();

            console.log(`[Fal.ai] Status: ${statusData.status} (Attempt ${attempts})`);

            if (statusData.status === 'COMPLETED') {
                const resultRes = await fetch(`https://queue.fal.run/fal-ai/luma-dream-machine/requests/${requestId}`, {
                    headers: { 'Authorization': `Key ${FAL_KEY}` }
                });
                const resultData = await resultRes.json();
                videoUrl = resultData.video.url;
                break;
            } else if (statusData.status === 'ERROR') {
                throw new Error("වීඩියෝව සෑදීම අසාර්ථක විය.");
            }
        }

        if (!videoUrl) throw new Error("වීඩියෝව සෑදීමට වැඩි වෙලාවක් ගතවිය. නැවත උත්සාහ කරන්න.");

        // සාර්ථක නම් වීඩියෝ ලින්ක් එක යවනවා
        res.json({ videoUrl: videoUrl });

    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 InfiniteVision Server running on port ${PORT}`));
