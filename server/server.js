require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const path = require('path');
const { createClient } = require('@deepgram/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const analytics = require('./analytics');
const { generateIntelligentResponse } = require('./intelligentResponses');

const app = express();
const PORT = process.env.PORT || 5000;
const DB_PATH = path.join(__dirname, 'bank.db');

// Middleware
app.use(cors());
app.use(express.json());

// Multer configuration for audio uploads (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

// Initialize AI clients
const DEMO_MODE = !process.env.DEEPGRAM_API_KEY || process.env.DEEPGRAM_API_KEY === 'your_deepgram_api_key_here';

let deepgram = null;
let genAI = null;

if (!DEMO_MODE) {
  deepgram = createClient(process.env.DEEPGRAM_API_KEY);
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

if (DEMO_MODE) {
  console.log('\n⚠️  RUNNING IN DEMO MODE - Add real API keys to .env for full functionality\n');
}

// Database connection
function getDbConnection() {
  return new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('[DB ERROR] Failed to connect:', err.message);
    }
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'VoiceBank Pro API is running', mode: DEMO_MODE ? 'demo' : 'production' });
});

// Analytics endpoints
app.get('/api/analytics/spending', async (req, res) => {
  try {
    const data = await analytics.getSpendingAnalytics();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/analytics/trends', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const data = await analytics.getSpendingTrends(days);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/analytics/insights', async (req, res) => {
  try {
    const data = await analytics.generateInsights();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/analytics/anomalies', async (req, res) => {
  try {
    const data = await analytics.detectAnomalies();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/analytics/top-merchants', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const data = await analytics.getTopMerchants(limit);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/analytics/budget/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const budget = parseInt(req.query.budget) || 10000;
    const data = await analytics.getBudgetAnalysis(category, budget);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/analytics/compare/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const data = await analytics.getComparativeAnalysis(category);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get available voice personas
app.get('/api/personas', (req, res) => {
  res.json(VOICE_PERSONAS);
});

// Text processing endpoint (for browser speech recognition)
app.post('/api/process-text', express.json(), async (req, res) => {
  console.log('\n[API] 📝 New text request received');

  try {
    const { text, persona = 'friendly', language = 'english' } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }

    const transcript = text.trim();
    console.log(`[TEXT] ✅ Received: "${transcript}"`);

    // STEP 2: Natural Language to SQL
    console.log('[STEP 2] 🧠 Converting to SQL...');
    let sqlQuery = '';

    const lowerTranscript = transcript.toLowerCase();
    
    // Handle different query types
    if (lowerTranscript.includes('all') && lowerTranscript.includes('transaction')) {
      // "Show me all my transactions"
      sqlQuery = "SELECT * FROM transactions ORDER BY date DESC LIMIT 20";
    } else if (lowerTranscript.includes('food')) {
      // "How much did I spend on food?"
      sqlQuery = "SELECT * FROM transactions WHERE category = 'Food' ORDER BY date DESC";
    } else if (lowerTranscript.includes('recent') || lowerTranscript.includes('latest')) {
      // "What are my recent payments?"
      sqlQuery = "SELECT * FROM transactions ORDER BY date DESC LIMIT 10";
    } else if (lowerTranscript.includes('above') || lowerTranscript.includes('over') || lowerTranscript.includes('1000')) {
      // "Show transactions above 1000 rupees"
      const amount = lowerTranscript.match(/\d+/)?.[0] || 1000;
      sqlQuery = `SELECT * FROM transactions WHERE amount > ${amount} ORDER BY date DESC`;
    } else if (lowerTranscript.includes('upi')) {
      // "List all UPI payments"
      sqlQuery = "SELECT * FROM transactions WHERE method = 'UPI' ORDER BY date DESC";
    } else if (lowerTranscript.includes('category') || lowerTranscript.includes('categories')) {
      // Category-wise breakdown
      sqlQuery = "SELECT category, SUM(amount) as total, COUNT(*) as count FROM transactions GROUP BY category ORDER BY total DESC";
    } else if (lowerTranscript.includes('top') && (lowerTranscript.includes('expense') || lowerTranscript.includes('spending'))) {
      sqlQuery = "SELECT beneficiary, SUM(amount) as total, COUNT(*) as count FROM transactions GROUP BY beneficiary ORDER BY total DESC LIMIT 5";
    } else if (lowerTranscript.includes('shopping')) {
      sqlQuery = "SELECT * FROM transactions WHERE category = 'Shopping' ORDER BY date DESC";
    } else if (lowerTranscript.includes('transport')) {
      sqlQuery = "SELECT * FROM transactions WHERE category = 'Transport' ORDER BY date DESC";
    } else if (lowerTranscript.includes('entertainment')) {
      sqlQuery = "SELECT * FROM transactions WHERE category = 'Entertainment' ORDER BY date DESC";
    } else if (lowerTranscript.includes('total') || lowerTranscript.includes('sum')) {
      sqlQuery = "SELECT SUM(amount) as total, COUNT(*) as count FROM transactions";
    } else if (lowerTranscript.includes('most') || lowerTranscript.includes('highest')) {
      sqlQuery = "SELECT category, SUM(amount) as total FROM transactions GROUP BY category ORDER BY total DESC LIMIT 1";
    } else {
      // Default: show recent transactions
      sqlQuery = "SELECT * FROM transactions ORDER BY date DESC LIMIT 10";
    }
    
    console.log(`[STEP 2] ✅ Generated SQL: ${sqlQuery}`);

    // STEP 3: Execute SQL Query
    console.log('[STEP 3] 💾 Executing SQL query...');
    let dbResults = [];

    try {
      const db = getDbConnection();
      
      dbResults = await new Promise((resolve, reject) => {
        db.all(sqlQuery, [], (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });

      db.close();
      console.log(`[STEP 3] ✅ Query returned ${dbResults.length} rows`);
    } catch (err) {
      console.error('[STEP 3 ERROR]', err.message);
      return res.status(500).json({ error: 'Database query failed', details: err.message });
    }

    // STEP 4: Generate Intelligent, Contextual Summary
    console.log('[STEP 4] 📝 Generating intelligent response...');
    
    // Determine query type
    let queryType = 'default';
    if (lowerTranscript.includes('top') && (lowerTranscript.includes('expense') || lowerTranscript.includes('spending'))) {
      queryType = 'top_expenses';
    } else if (lowerTranscript.includes('category') || lowerTranscript.includes('categories')) {
      queryType = 'category';
    } else if (lowerTranscript.includes('food')) {
      queryType = 'food';
    } else if (lowerTranscript.includes('most') || lowerTranscript.includes('highest')) {
      queryType = 'most';
    } else if (lowerTranscript.includes('recent') || lowerTranscript.includes('latest')) {
      queryType = 'recent';
    } else if (lowerTranscript.includes('total') || lowerTranscript.includes('sum')) {
      queryType = 'total';
    }
    
    // Generate intelligent response with context and insights
    const summary = generateIntelligentResponse(queryType, dbResults, transcript);
    
    console.log(`[STEP 4] ✅ Intelligent Summary: "${summary}"`);

    // Return JSON response with text and metadata
    return res.json({ 
      text: summary,
      transcript: transcript,
      results: dbResults,
      browserSpeech: true,
      message: 'Using browser speech recognition with intelligent responses'
    });

  } catch (err) {
    console.error('[API ERROR]', err.message);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Main voice processing endpoint
app.post('/api/process-voice', upload.single('audio'), async (req, res) => {
  console.log('\n[API] 🎤 New voice request received');

  try {
    // Validate audio file
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const audioBuffer = req.file.buffer;
    console.log(`[API] Audio file size: ${audioBuffer.length} bytes`);

    // STEP 1: Speech-to-Text (Deepgram or Demo)
    console.log('[STEP 1] 🎧 Transcribing audio...');
    let transcript = '';
    
    if (DEMO_MODE) {
      // Demo mode: Analyze audio duration to guess query type
      // Longer audio = more complex query
      const audioDuration = audioBuffer.length;
      
      // Use a rotating pattern based on request count to simulate variety
      const queryPatterns = [
        'What are my top expenses?',
        'Show me all my transactions',
        'How much did I spend on food?',
        'What are my recent payments?',
        'Show transactions above 1000 rupees',
        'List my shopping expenses',
        'Show me spending by category',
        'What did I spend the most on?'
      ];
      
      // Use timestamp to create variety (changes every 10 seconds)
      const index = Math.floor(Date.now() / 10000) % queryPatterns.length;
      transcript = queryPatterns[index];
      
      console.log(`[STEP 1] ✅ Demo Transcript: "${transcript}"`);
      console.log(`[STEP 1] ⚠️  NOTE: In demo mode - not actually transcribing your voice`);
      console.log(`[STEP 1] 💡 Add API keys to .env to enable real speech recognition`);
    } else {
      try {
        const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
          audioBuffer,
          {
            model: 'nova-2',
            smart_format: true,
          }
        );

        if (error) {
          throw new Error(`Deepgram error: ${JSON.stringify(error)}`);
        }

        transcript = result.results.channels[0].alternatives[0].transcript;
        console.log(`[STEP 1] ✅ Transcript: "${transcript}"`);

        if (!transcript || transcript.trim().length === 0) {
          return res.status(400).json({ error: 'Could not transcribe audio. Please speak clearly.' });
        }
      } catch (err) {
        console.error('[STEP 1 ERROR]', err.message);
        return res.status(500).json({ error: 'Speech recognition failed', details: err.message });
      }
    }

    // STEP 2: Natural Language to SQL (Gemini or Demo)
    console.log('[STEP 2] 🧠 Converting to SQL...');
    let sqlQuery = '';

    if (DEMO_MODE) {
      // Demo mode: Improved keyword matching for better query understanding
      const lowerTranscript = transcript.toLowerCase();
      
      if (lowerTranscript.includes('top') && (lowerTranscript.includes('expense') || lowerTranscript.includes('spending'))) {
        // Top expenses query
        sqlQuery = "SELECT beneficiary, SUM(amount) as total, COUNT(*) as count FROM transactions GROUP BY beneficiary ORDER BY total DESC LIMIT 5";
      } else if (lowerTranscript.includes('category') || lowerTranscript.includes('categories')) {
        // Spending by category
        sqlQuery = "SELECT category, SUM(amount) as total, COUNT(*) as count FROM transactions GROUP BY category ORDER BY total DESC";
      } else if (lowerTranscript.includes('food')) {
        sqlQuery = "SELECT * FROM transactions WHERE category = 'Food' ORDER BY date DESC LIMIT 10";
      } else if (lowerTranscript.includes('shopping')) {
        sqlQuery = "SELECT * FROM transactions WHERE category = 'Shopping' ORDER BY date DESC LIMIT 10";
      } else if (lowerTranscript.includes('transport') || lowerTranscript.includes('uber') || lowerTranscript.includes('ola')) {
        sqlQuery = "SELECT * FROM transactions WHERE category = 'Transport' ORDER BY date DESC LIMIT 10";
      } else if (lowerTranscript.includes('1000') || lowerTranscript.includes('above') || lowerTranscript.includes('over')) {
        sqlQuery = "SELECT * FROM transactions WHERE amount > 1000 ORDER BY date DESC LIMIT 10";
      } else if (lowerTranscript.includes('recent') || lowerTranscript.includes('latest')) {
        sqlQuery = "SELECT * FROM transactions ORDER BY date DESC LIMIT 5";
      } else if (lowerTranscript.includes('total') || lowerTranscript.includes('sum')) {
        sqlQuery = "SELECT SUM(amount) as total, COUNT(*) as count FROM transactions";
      } else if (lowerTranscript.includes('most') || lowerTranscript.includes('highest')) {
        // What did I spend the most on
        sqlQuery = "SELECT category, SUM(amount) as total FROM transactions GROUP BY category ORDER BY total DESC LIMIT 1";
      } else {
        // Default: show all transactions
        sqlQuery = "SELECT * FROM transactions ORDER BY date DESC LIMIT 10";
      }
      console.log(`[STEP 2] ✅ Demo SQL: ${sqlQuery}`);
    } else {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        
        const sqlPrompt = `You are a Banking SQL Expert. 
Schema: transactions(id INTEGER, date TEXT, beneficiary TEXT, amount INTEGER, category TEXT, method TEXT)

Rules:
- Convert natural language to SQL
- "20k" means 20000, "5k" means 5000
- "last week" means last 7 days
- "today" means current date
- Return ONLY the raw SQL SELECT query, no explanations, no markdown, no code blocks
- Use SQLite syntax

User query: "${transcript}"

SQL:`;

        const result = await model.generateContent(sqlPrompt);
        const response = await result.response;
        sqlQuery = response.text().trim();
        
        // Clean up any markdown formatting
        sqlQuery = sqlQuery.replace(/```sql/g, '').replace(/```/g, '').trim();
        
        console.log(`[STEP 2] ✅ Generated SQL: ${sqlQuery}`);
      } catch (err) {
        console.error('[STEP 2 ERROR]', err.message);
        return res.status(500).json({ error: 'Failed to generate SQL query', details: err.message });
      }
    }

    // STEP 3: Execute SQL Query
    console.log('[STEP 3] 💾 Executing SQL query...');
    let dbResults = [];

    try {
      const db = getDbConnection();
      
      dbResults = await new Promise((resolve, reject) => {
        db.all(sqlQuery, [], (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });

      db.close();
      console.log(`[STEP 3] ✅ Query returned ${dbResults.length} rows`);
    } catch (err) {
      console.error('[STEP 3 ERROR]', err.message);
      return res.status(500).json({ error: 'Database query failed', details: err.message });
    }

    // STEP 4: Generate Natural Language Summary (Gemini or Demo)
    console.log('[STEP 4] 📝 Generating voice response...');
    let summary = '';

    if (DEMO_MODE) {
      // Demo mode: Improved summary generation based on query type
      const lowerTranscript = transcript.toLowerCase();
      
      if (dbResults.length === 0) {
        summary = "I couldn't find any transactions matching your query.";
      } else if (lowerTranscript.includes('top') && (lowerTranscript.includes('expense') || lowerTranscript.includes('spending'))) {
        // Top expenses response
        const topItems = dbResults.slice(0, 3).map((item, idx) => 
          `${idx + 1}. ${item.beneficiary} with ${item.total} rupees`
        ).join(', ');
        summary = `Your top expenses are: ${topItems}`;
      } else if (lowerTranscript.includes('category') || lowerTranscript.includes('categories')) {
        // Category breakdown
        const categories = dbResults.map((item, idx) => 
          `${item.category}: ${item.total} rupees`
        ).join(', ');
        summary = `Your spending by category is: ${categories}`;
      } else if (lowerTranscript.includes('most') || lowerTranscript.includes('highest')) {
        // Highest spending
        const top = dbResults[0];
        summary = `You spent the most on ${top.category} with a total of ${top.total} rupees.`;
      } else if (lowerTranscript.includes('total') || lowerTranscript.includes('sum')) {
        // Total spending
        const result = dbResults[0];
        summary = `Your total spending is ${result.total} rupees across ${result.count} transactions.`;
      } else if (dbResults.length === 1) {
        const txn = dbResults[0];
        if (txn.total) {
          // Aggregated result
          summary = `The total is ${txn.total} rupees with ${txn.count || 1} transactions.`;
        } else {
          // Single transaction
          summary = `I found one transaction: ${txn.amount} rupees to ${txn.beneficiary} in the ${txn.category} category.`;
        }
      } else {
        // Multiple transactions
        const total = dbResults.reduce((sum, txn) => sum + (txn.amount || txn.total || 0), 0);
        const first = dbResults[0];
        const merchantOrCategory = first.beneficiary || first.category;
        summary = `I found ${dbResults.length} transactions totaling ${total} rupees. The most recent was ${first.amount || first.total} rupees to ${merchantOrCategory}.`;
      }
      console.log(`[STEP 4] ✅ Demo Summary: "${summary}"`);
    } else {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        
        const summaryPrompt = `You are a friendly voice banking assistant.

User asked: "${transcript}"

Database results: ${JSON.stringify(dbResults)}

Summarize this in ONE short, natural sentence for a voice assistant. Be conversational and helpful. If no results, say so politely.

Response:`;

        const result = await model.generateContent(summaryPrompt);
        const response = await result.response;
        summary = response.text().trim();
        
        console.log(`[STEP 4] ✅ Summary: "${summary}"`);
      } catch (err) {
        console.error('[STEP 4 ERROR]', err.message);
        return res.status(500).json({ error: 'Failed to generate summary', details: err.message });
      }
    }

    // STEP 5: Text-to-Speech (Murf Falcon or Demo)
    console.log('[STEP 5] 🔊 Generating speech...');
    
    if (DEMO_MODE) {
      // Demo mode: Return text response
      console.log('[STEP 5] ✅ Demo mode - returning text response');
      return res.json({ 
        text: summary,
        transcript: transcript,
        results: dbResults,
        demo: true,
        message: 'Add API keys to .env for voice output'
      });
    }
    
    try {
      const murfResponse = await axios.post(
        'https://api.murf.ai/v1/speech/generate',
        {
          voiceId: 'en-US-falcon',
          text: summary,
          format: 'mp3',
          sampleRate: 24000,
          speed: 0
        },
        {
          headers: {
            'api-key': process.env.MURF_API_KEY,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer'
        }
      );

      console.log('[STEP 5] ✅ Audio generated successfully');
      
      // Return audio to client
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': murfResponse.data.length
      });
      res.send(Buffer.from(murfResponse.data));
      
      console.log('[API] ✅ Response sent to client\n');
    } catch (err) {
      console.error('[STEP 5 ERROR]', err.response?.data || err.message);
      
      // Fallback: return text response if TTS fails
      return res.json({ 
        text: summary, 
        error: 'TTS generation failed, returning text',
        details: err.response?.data || err.message 
      });
    }

  } catch (err) {
    console.error('[API ERROR]', err.message);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 VoiceBank Server running on http://localhost:${PORT}`);
  console.log(`📊 Database: ${DB_PATH}`);
  console.log(`🎤 Ready to process voice queries!\n`);
});
