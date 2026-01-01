# Firebase Setup for HuggingFace Token

## Overview
The application now stores the HuggingFace API token in Firebase Realtime Database instead of in environment variables. This keeps the token secure and out of your codebase.

## Setup Instructions

### 1. Add Token to Firebase Realtime Database

Go to [Firebase Console](https://console.firebase.google.com/) → Your Project → Realtime Database:

1. Click on your database (alin-2a386)
2. Click the **+** button next to "Realtime Database" to create a new path or navigate to the database
3. Create the following structure:
   ```
   secrets/
     └─ hf_token: "hf_YOUR_TOKEN_HERE"
   ```

You can do this by:
- Click on the root and add a child: `secrets`
- Under `secrets`, add a child: `hf_token`
- Set its value to your HuggingFace token

Or use the JSON import feature to paste:
```json
{
  "secrets": {
    "hf_token": "hf_YOUR_TOKEN_HERE"
  }
}
```

### 2. Set Firebase Security Rules (Optional but Recommended)

Go to **Rules** tab in Firebase Realtime Database:

```json
{
  "rules": {
    "secrets": {
      ".read": false,
      ".write": false,
      "hf_token": {
        ".read": "auth != null && auth.uid == 'server'"
      }
    }
  }
}
```

### 3. Deploy to Vercel

When deploying to Vercel:

1. Go to your Vercel project settings → Environment Variables
2. Add `FIREBASE_SERVICE_ACCOUNT_JSON` with your Firebase service account JSON:
   - Go to Firebase Console → Project Settings → Service Accounts
   - Click "Generate new private key"
   - Copy the entire JSON and paste it as the env var value

3. The app will automatically:
   - Use Firebase on production (from `FIREBASE_SERVICE_ACCOUNT_JSON`)
   - Use local `.env` HF_TOKEN during development

### 4. Local Development

For local development, you can:

**Option A: Use `.env` file (easiest)**
```
HF_TOKEN=hf_YOUR_TOKEN_HERE
```

**Option B: Use Firebase locally (mirrors production)**
- Set up service account file and add `FIREBASE_SERVICE_ACCOUNT_JSON` to `.env`

## Security Benefits

✅ **Token never in code** - Not in git, not in repo
✅ **Token never exposed** - Server-side only, never sent to browser
✅ **Cached for performance** - Tokens cached for 1 hour to reduce Firebase reads
✅ **Easy token rotation** - Just update Firebase, no redeploy needed
✅ **Works with Vercel** - Automatic fallback to Firebase on production

## Token Rotation

To rotate the token without redeploying:
1. Generate new token on HuggingFace
2. Update the value in Firebase at `/secrets/hf_token`
3. The cached token expires after 1 hour (or restart server immediately)

## Troubleshooting

If the server can't fetch the token:
- Check Firebase rules allow read access
- Verify service account has proper permissions
- Check that the path is exactly: `/secrets/hf_token`
- Check server logs for detailed error messages
