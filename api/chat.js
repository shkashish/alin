import { HfInference } from '@huggingface/inference';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');

if (!admin.apps.length) {
    if (Object.keys(serviceAccount).length > 0) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: 'https://alin-2a386-default-rtdb.europe-west1.firebasedatabase.app'
        });
        console.log('[Firebase] ✅ Initialized with service account');
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            databaseURL: 'https://alin-2a386-default-rtdb.europe-west1.firebasedatabase.app'
        });
        console.log('[Firebase] ✅ Initialized with application default');
    }
}

const db = admin.apps.length ? admin.database() : null;
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

        // Try to get from environment first
        if (process.env.HF_TOKEN) {
            cachedHfToken = process.env.HF_TOKEN;
            tokenCacheTime = Date.now();
            console.log('[Token] Using HF_TOKEN from environment');
            return cachedHfToken;
        }

        if (!db) {
            console.error('[Token] ❌ Firebase not initialized and no HF_TOKEN in env');
            return null;
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

export default async function handler(req, res) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const requestId = Math.random().toString(36).substring(7);
    console.log(`[${requestId}] ✅ CHAT REQUEST RECEIVED (Vercel Function)`);

    try {
        // Get HF token from Firebase or environment
        const hfToken = await getHfToken();

        if (!hfToken) {
            console.error(`[${requestId}] SERVER ERROR: HF_TOKEN not found`);
            return res.status(500).json({ error: 'Server misconfiguration: HF_TOKEN missing.' });
        }

        // Extract messages from request
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
            throw new Error(`HF Router API Error: ${hfResponse.status}`);
        }

        const response = await hfResponse.json();
        console.log(`[${requestId}] ✅ Response received:`, JSON.stringify(response, null, 2));

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

        console.log(`[${requestId}] 📤 Sending OpenAI-compatible response`);
        res.status(200).json(openaiResponse);
        console.log(`[${requestId}] ✅ REQUEST COMPLETE`);

    } catch (error) {
        console.error(`[${requestId}] ❌ Error:`, error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
}
