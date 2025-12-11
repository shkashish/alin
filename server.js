import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Helper to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 7860;

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

// Secure API Proxy
app.post('/api/chat', async (req, res) => {
    try {
        // NOTE: The HF_TOKEN environment variable MUST be set in your Space Settings (Variables section)
        const hfToken = process.env.HF_TOKEN;
        if (!hfToken) {
            console.error('HF_TOKEN is missing');
            return res.status(500).json({ error: 'Server misconfiguration: HF_TOKEN missing' });
        }

        // We use the Llama-3.2-3B model which is fast and reliable
        const response = await fetch("https://api-inference.huggingface.co/models/meta-llama/Llama-3.2-3B-Instruct", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${hfToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(req.body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HF API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        res.json(data);

    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown proxy error' });
    }
});

// **********************************************
// FIX #2: Fallback for SPA routing (serve index.html for unknown routes)
// Corrected from app.get('*') to app.get('/{*any}') for Express v5 compatibility.
app.get('/{*any}', (req, res) => { 
    res.sendFile(join(__dirname, 'dist', 'index.html'));
});
// **********************************************

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
