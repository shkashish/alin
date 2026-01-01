import { HfInference } from '@huggingface/inference';
import * as admin from 'firebase-admin';

// Global variables to persist across warm invocations
let cachedHfToken = null;
let tokenCacheTime = 0;
const TOKEN_CACHE_DURATION = 3600000; // Cache for 1 hour

// Helper to safely initialize Firebase
function getFirebaseDb() {
    if (admin.apps.length > 0) {
        return admin.database();
    }

    console.log('[Firebase] Initializing...');

    const jsonContent = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    // In local dev, we might verify this differs, but for Vercel prod this is critical
    if (!jsonContent) {
        console.warn('[Firebase] Warning: FIREBASE_SERVICE_ACCOUNT_JSON is missing.');
        // Allow fallback if user has HF_TOKEN directly in env
        return null;
    }

    try {
        const serviceAccount = JSON.parse(jsonContent);

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: 'https://alin-2a386-default-rtdb.europe-west1.firebasedatabase.app'
        });

        console.log('[Firebase] ✅ Initialized successfully');
        return admin.database();
    } catch (error) {
        console.error('[Firebase] ❌ Initialization Error:', error);
        throw new Error(`Firebase Initialization Failed: ${error.message}`);
    }
}

async function getHfToken() {
    // 1. Check Cache
    if (cachedHfToken && (Date.now() - tokenCacheTime) < TOKEN_CACHE_DURATION) {
        console.log('[Token] Using cached HF token');
        return cachedHfToken;
    }

    // 2. Check Environment Variable (useful for local dev or simple Vercel setup)
    if (process.env.HF_TOKEN) {
        cachedHfToken = process.env.HF_TOKEN;
        tokenCacheTime = Date.now();
        console.log('[Token] Using HF_TOKEN from environment');
        return cachedHfToken;
    }

    // 3. Get from Firebase
    try {
        const db = getFirebaseDb();

        if (!db) {
            console.error('[Token] ❌ Firebase not initialized and no HF_TOKEN in env');
            return null;
        }

        const ref = db.ref('secrets/hf_token');
        const snapshot = await ref.once('value');
        const token = snapshot.val();

        if (!token) {
            throw new Error('HF_TOKEN retrieved from Firebase is empty');
        }

        cachedHfToken = token;
        tokenCacheTime = Date.now();
        console.log('[Token] ✅ Retrieved HF token from Firebase');
        return token;
    } catch (error) {
        console.error('[Token] ❌ Failed to get HF token:', error.message);
        throw error; // Re-throw to be caught by handler
    }
}

export default async function handler(req, res) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const requestId = Math.random().toString(36).substring(7);
    console.log(`[${requestId}] ✅ CHAT REQUEST RECEIVED (Vercel Function)`);

    try {
        // Get HF token
        const hfToken = await getHfToken();

        if (!hfToken) {
            console.error(`[${requestId}] SERVER ERROR: HF_TOKEN not found`);
            // Return a 500 but with specific error so it's not a "Function Invocation Failed" crash
            return res.status(500).json({
                error: 'Server Configuration Error',
                details: 'HF_TOKEN could not be retrieved. Check Firebase or Vercel Env Vars.'
            });
        }

        const messages = req.body.messages || [];
        const temperature = req.body.temperature || 0.7;
        const maxTokens = req.body.max_tokens || 200;

        if (messages.length === 0) {
            return res.status(400).json({ error: 'No messages provided' });
        }

        console.log(`[${requestId}] 📡 Calling HuggingFace Router API...`);

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

        if (!hfResponse.ok) {
            const errorText = await hfResponse.text();
            console.error(`[${requestId}] ❌ HF Router API Error: ${hfResponse.status} - ${errorText}`);
            return res.status(hfResponse.status).json({ error: `External API Error: ${errorText}` });
        }

        const response = await hfResponse.json();

        // Return OpenAI-compatible response
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

        res.status(200).json(openaiResponse);
        console.log(`[${requestId}] ✅ REQUEST COMPLETE`);

    } catch (error) {
        console.error(`[${requestId}] ❌ FATAL ERROR:`, error);
        // Important: Return JSON with error details instead of crashing
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}
