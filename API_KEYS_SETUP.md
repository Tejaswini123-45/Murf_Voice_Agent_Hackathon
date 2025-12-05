# 🔑 API Keys Setup Guide

To enable full voice functionality with professional TTS (Murf Falcon), you need to add API keys to `server/.env`.

## Current Status
✅ **Browser TTS** - Working now (basic voice output)  
⏳ **Professional TTS** - Requires API keys (ultra-fast, natural voice)

## How to Get API Keys

### 1. Deepgram (Speech-to-Text) 🎤
**Free Tier:** $200 credit (45,000 minutes)

1. Go to: https://console.deepgram.com/signup
2. Sign up for free account
3. Navigate to: API Keys section
4. Copy your API key
5. Paste in `.env` as: `DEEPGRAM_API_KEY=your_key_here`

### 2. Google Gemini (AI Logic) 🧠
**Free Tier:** 60 requests per minute

1. Go to: https://ai.google.dev/
2. Click "Get API Key in Google AI Studio"
3. Sign in with Google account
4. Create new API key
5. Copy the key
6. Paste in `.env` as: `GEMINI_API_KEY=your_key_here`

### 3. Murf AI (Text-to-Speech) 🔊
**Trial:** Available on request

1. Go to: https://murf.ai/
2. Sign up for account
3. Contact support for API access or use trial
4. Get your API key from dashboard
5. Paste in `.env` as: `MURF_API_KEY=your_key_here`

**Alternative:** If Murf API is not available, you can use:
- **ElevenLabs** (https://elevenlabs.io/) - Excellent voice quality
- **Google Cloud TTS** (https://cloud.google.com/text-to-speech)
- **Amazon Polly** (https://aws.amazon.com/polly/)

## Quick Setup

1. Open `server/.env` file
2. Replace placeholder values with your actual keys:

```env
DEEPGRAM_API_KEY=abc123your_actual_deepgram_key_here
GEMINI_API_KEY=xyz789your_actual_gemini_key_here
MURF_API_KEY=murf456your_actual_murf_key_here
PORT=5000
```

3. Restart the server:
```bash
# Stop current server (Ctrl+C in terminal)
# Then restart:
cd server
npm start
```

## Current Fallback (No API Keys Needed)

The app now uses **Browser Text-to-Speech** which works immediately:
- ✅ No API keys required
- ✅ Works offline
- ✅ Free forever
- ⚠️ Voice quality is basic (robotic)
- ⚠️ Limited voice options

## Testing

Try these queries:
- "Show me all my transactions"
- "How much did I spend on food?"
- "What are my recent payments?"

The app will:
1. Record your voice
2. Process it (demo mode uses sample queries)
3. Query the database
4. Speak the results using browser TTS

---

**Need Help?** Check the console logs for any errors or contact support.
