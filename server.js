// Load environment variables from .env file
import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';

// Helper to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 7860;

// Debug Middleware: Log all requests with unique ID
app.use((req, res, next) => {
    req.id = crypto.randomUUID().substring(0, 8);
    console.log(`[${req.id}] ${req.method} ${req.path}`);
    next();
});

// **********************************************
// FIX #1: Serve the 'public' directory from the root URL '/'
// This allows the frontend to request /model.glb and get the file.
// IMPORTANT: This middleware should come BEFORE the 'dist' middleware
// if there are potential filename conflicts.
app.use(express.static(join(__dirname, 'public')));
// **********************************************

// Parse JSON bodies
app.use(express.json());

// Serve static files from the React build (frontend)
app.use(express.static(join(__dirname, 'dist')));

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// Secure API Proxy
app.post('/api/chat', async (req, res) => {
    try {
        const id = req.id;
        const hfToken = process.env.HF_TOKEN;
        if (!hfToken) {
            console.error(`[${id}] SERVER ERROR: HF_TOKEN is missing in environment variables. Please check your .env file.`);
            return res.status(500).json({ error: 'Server misconfiguration: HF_TOKEN missing. Create a .env file with HF_TOKEN=...' });
        }

        console.log(`[${id}] ✅ CHAT REQUEST RECEIVED`);
        console.log(`[${id}] Using Token: ${hfToken.substring(0, 5)}...`);
        console.log(`[${id}] Incoming Request Body:`, JSON.stringify(req.body, null, 2));

        // Construct the payload for Hugging Face Router (OpenAI compatible)
        let payload = { ...req.body };
        let isLegacyRequest = false;

        // FALLBACK: If the frontend sends the old 'inputs' format (cached), convert it
        if (!payload.messages && payload.inputs) {
            console.log(`[${id}] Detected legacy "inputs" format. Converting Request AND Response...`);
            isLegacyRequest = true;
            payload = {
                model: "google/gemma-2-9b-it",
                messages: [
                    { role: "system", content: "You are an ancient philosopher and a magician. Respond with profound wisdom and poetry in 5-6 sentences" },
                    { role: "user", content: payload.inputs }
                ],
                max_tokens: 200,
                temperature: 0.7
            };
        }

        // Ensure model is set if missing
        if (!payload.model) {
            payload.model = "google/gemma-2-9b-it";
        }

        // Use Qwen instead of Llama to avoid Gated Repo 404s/Auth issues
        if (payload.model.includes("Llama") || payload.model.includes("zephyr")) {
            console.log(`[${id}] Switching from ${payload.model} to google/gemma-2-9b-it to ensure availability.`);
            payload.model = "google/gemma-2-9b-it";
        }

        console.log(`[${id}] Forwarding request to Hugging Face Router for model: ${payload.model}`);
        const url = "https://router.huggingface.co/v1/chat/completions";
        console.log(`[${id}] URL: ${url}`);
        console.log(`[${id}] Payload:`, JSON.stringify(payload, null, 2));

        // Use the OpenAI-compatible endpoint
        const fetchStartTime = Date.now();
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${hfToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
        const fetchEndTime = Date.now();
        const fetchDuration = fetchEndTime - fetchStartTime;

        console.log(`[${id}] 📡 HF API responded in ${fetchDuration}ms`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[${id}] ❌ HF API Error: ${response.status} - ${errorText}`);

            if (response.status === 404) {
                console.error(`[${id}] TIP: 404 usually means the model does not exist or your token cannot access it.`);
            }

            return res.status(response.status).json({ error: `HF API Error: ${errorText}` });
        }

        const data = await response.json();

        // Log which model actually responded and preview the response
        console.log(`[${id}] ✅ Response received from model: ${data.model || payload.model}`);
        console.log(`[${id}] Response content: ${data.choices?.[0]?.message?.content?.substring(0, 150)}...`);
        console.log(`[${id}] Full response object:`, JSON.stringify(data, null, 2));

        // If client sent legacy request, it expects legacy response format!
        if (isLegacyRequest) {
            const content = data.choices?.[0]?.message?.content || "";
            // Legacy format was: { generated_text: "..." } or [{ generated_text: "..." }]
            // We'll send the object format as that's safer for our parser
            console.log(`[${id}] Converting OpenAI response back to Legacy format for client.`);
            console.log(`[${id}] 📤 Sending response:`, JSON.stringify({ generated_text: content }, null, 2));
            res.json({ generated_text: content });
        } else {
            // Send raw OpenAI format
            console.log(`[${id}] 📤 Sending OpenAI response:`, JSON.stringify(data, null, 2));
            res.json(data);
        }

        console.log(`[${id}] ✅ REQUEST COMPLETE`);

    } catch (error) {
        console.error(`[${req.id}] ❌ Proxy Error:`, error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown proxy error' });
    }
});

// **********************************************
// FIX #2: Fallback for SPA routing (serve index.html for unknown routes)
// Using a final middleware to catch everything not handled above
app.use((req, res) => {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
});
// **********************************************

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
