import { HfInference } from '@huggingface/inference';
import * as admin from 'firebase-admin';

// Global variables for caching
let cachedHfToken = null;
let tokenCacheTime = 0;
const TOKEN_CACHE_DURATION = 3600000; // 1 hour

// Helper to safely initialize Firebase
function getFirebaseDb() {
    // Prevent multiple initializations (essential for hot reloads/warm starts)
    if (admin.apps && admin.apps.length > 0) {
        return admin.database();
    }

    console.log('[Firebase] Initializing...');

    const jsonContent = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (!jsonContent) {
        console.warn('[Firebase] Warning: FIREBASE_SERVICE_ACCOUNT_JSON is missing.');
        return null;
    }

    try {
        const serviceAccount = JSON.parse(jsonContent);

        // CRITICAL FIX: Handle newlines in private key which might be escaped in Vercel Env Vars
        if (serviceAccount.private_key) {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: 'https://alin-2a386-default-rtdb.europe-west1.firebasedatabase.app'
        });

        console.log('[Firebase] ✅ Initialized successfully');
        return admin.database();
    } catch (error) {
        console.error('[Firebase] ❌ Initialization Error:', error);
        // Do not throw here, allow fallback to checks later
        return null;
    }
}

async function getHfToken() {
    // 1. Check Cache
    if (cachedHfToken && (Date.now() - tokenCacheTime) < TOKEN_CACHE_DURATION) {
        console.log('[Token] Using cached HF token');
        return cachedHfToken;
    }

    // 2. Check Environment Variable (Fastest Fallback)
    if (process.env.HF_TOKEN) {
        cachedHfToken = process.env.HF_TOKEN;
        tokenCacheTime = Date.now();
        console.log('[Token] Using HF_TOKEN from environment');
        return cachedHfToken;
    }

    // 3. Get from Firebase
    const db = getFirebaseDb();

    if (!db) {
        console.error('[Token] ❌ Firebase not initialized and no HF_TOKEN in env');
        return null; // Will trigger 500 in handler with clear message
    }

    try {
        const ref = db.ref('secrets/hf_token');
        const snapshot = await ref.once('value');
        const token = snapshot.val();

        if (!token) {
            console.error('[Token] Key secrets/hf_token is empty in Firebase');
            return null;
        }

        cachedHfToken = token;
        tokenCacheTime = Date.now();
        console.log('[Token] ✅ Retrieved HF token from Firebase');
        return token;
    } catch (error) {
        console.error('[Token] ❌ Failed to read from Firebase:', error.message);
        return null;
    }
}

export default async function handler(req, res) {
    // Handle CORS Preflight (if usage ever changes to cross-origin)
    if (req.method === 'OPTIONS') {
        return res.status(200).send('ok');
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const requestId = Math.random().toString(36).substring(7);
    console.log(`[${requestId}] ✅ CHAT REQUEST`);

    try {
        const hfToken = await getHfToken();

        if (!hfToken) {
            console.error(`[${requestId}] FATAL: HF_TOKEN missing`);
            return res.status(500).json({
                error: 'Server Configuration Error',
                message: 'Could not retrieve HF_TOKEN from Firebase or Environment.',
                hint: 'Check FIREBASE_SERVICE_ACCOUNT_JSON or add HF_TOKEN env var.'
            });
        }

        const { messages, temperature = 0.7, max_tokens = 200 } = req.body;

        if (!messages || messages.length === 0) {
            return res.status(400).json({ error: 'No messages provided' });
        }

        console.log(`[${requestId}] 📡 Calling HuggingFace internal router...`);

        const hfResponse = await fetch(`https://router.huggingface.co/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${hfToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'google/gemma-2-9b-it',
                messages,
                max_tokens,
                temperature
            })
        });

        if (!hfResponse.ok) {
            const errorText = await hfResponse.text();
            console.error(`[${requestId}] ❌ HF Error: ${hfResponse.status} - ${errorText}`);
            return res.status(hfResponse.status).json({
                error: 'AI Provider Error',
                details: errorText
            });
        }

        const response = await hfResponse.json();

        // Parse OpenAI-compatible response
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
            usage: response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
        };

        return res.status(200).json(openaiResponse);

    } catch (error) {
        console.error(`[${requestId}] ❌ CRITICAL HANDLER ERROR:`, error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: error.message
        });
    }
}
