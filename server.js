// Load environment variables from .env file
import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';
import { HfInference } from '@huggingface/inference';
import * as admin from 'firebase-admin';

// Helper to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin SDK
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || join(__dirname, 'serviceAccountKey.json');
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');

if (Object.keys(serviceAccount).length > 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://alin-2a386-default-rtdb.europe-west1.firebasedatabase.app'
    });
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        databaseURL: 'https://alin-2a386-default-rtdb.europe-west1.firebasedatabase.app'
    });
}

const db = admin.database();
let cachedHfToken = null;
let tokenCacheTime = 0;
const TOKEN_CACHE_DURATION = 3600000; // Cache for 1 hour

async function getHfToken() {
    try {
        // Check if we have a cached token that's still valid
        if (cachedHfToken && (Date.now() - tokenCacheTime) < TOKEN_CACHE_DURATION) {
            console.log('[Token] Using cached HF token');
            return cachedHfToken;
        }

        // Try to get from environment first (for local development)
        if (process.env.HF_TOKEN) {
            cachedHfToken = process.env.HF_TOKEN;
            tokenCacheTime = Date.now();
            console.log('[Token] Using HF_TOKEN from .env');
            return cachedHfToken;
        }

        // Get from Firebase Realtime Database
        const ref = db.ref('secrets/hf_token');
        const snapshot = await ref.once('value');
        const token = snapshot.val();

        if (!token) {
            throw new Error('HF_TOKEN not found in Firebase');
        }

        cachedHfToken = token;
        tokenCacheTime = Date.now();
        console.log('[Token] ✅ Retrieved HF token from Firebase');
        return token;
    } catch (error) {
        console.error('[Token] ❌ Failed to get HF token:', error instanceof Error ? error.message : error);
        return null;
    }
}

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

// Direct HuggingFace Router API Call
app.post('/api/chat', async (req, res) => {
    try {
        const id = req.id;
        
        // Get HF token from Firebase or environment
        const hfToken = await getHfToken();
        
        if (!hfToken) {
            console.error(`[${id}] SERVER ERROR: HF_TOKEN not found in Firebase or .env`);
            return res.status(500).json({ error: 'Server misconfiguration: HF_TOKEN missing. Add it to Firebase at /secrets/hf_token' });
        }

        console.log(`[${id}] ✅ CHAT REQUEST RECEIVED`);
        console.log(`[${id}] Using Token: ${hfToken.substring(0, 5)}...`);
        console.log(`[${id}] Incoming Request Body:`, JSON.stringify(req.body, null, 2));

        // Extract messages from request
        const messages = req.body.messages || [];
        const temperature = req.body.temperature || 0.7;
        const maxTokens = req.body.max_tokens || 200;

        if (messages.length === 0) {
            return res.status(400).json({ error: 'No messages provided' });
        }

        console.log(`[${id}] 📡 Calling HuggingFace Router API directly...`);
        console.log(`[${id}] Messages:`, JSON.stringify(messages, null, 2));

        const fetchStartTime = Date.now();

        // Call HF Router's OpenAI-compatible endpoint directly (not through a Space)
        const hfResponse = await fetch(`https://router.huggingface.co/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${hfToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'google/gemma-2-9b-it',
                messages: messages,
                max_tokens: maxTokens,
                temperature: temperature
            })
        });

        const fetchEndTime = Date.now();
        const fetchDuration = fetchEndTime - fetchStartTime;

        console.log(`[${id}] 📡 HF Router API responded in ${fetchDuration}ms`);

        if (!hfResponse.ok) {
            const errorText = await hfResponse.text();
            console.error(`[${id}] ❌ HF Router API Error: ${hfResponse.status} - ${errorText}`);
            throw new Error(`HF Router API Error: ${hfResponse.status} - ${errorText}`);
        }

        const response = await hfResponse.json();
        console.log(`[${id}] ✅ Response received:`, JSON.stringify(response, null, 2));

        // Parse OpenAI-compatible response directly from router
        const generatedText = response?.choices?.[0]?.message?.content || "";
        
        const openaiResponse = {
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: 'google/gemma-2-9b-it',
            choices: [
                {
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: generatedText.trim()
                    },
                    finish_reason: 'stop'
                }
            ],
            usage: {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0
            }
        };

        console.log(`[${id}] 📤 Sending OpenAI-compatible response:`, JSON.stringify(openaiResponse, null, 2));
        res.json(openaiResponse);
        console.log(`[${id}] ✅ REQUEST COMPLETE`);

    } catch (error) {
        console.error(`[${req.id}] ❌ HF Router API Error:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: `HF Router API Error: ${errorMessage}` });
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
