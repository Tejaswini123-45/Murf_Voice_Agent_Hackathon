import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import './AppPro.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const API_URL = 'http://localhost:5000/api';

function AppPro() {
  const [status, setStatus] = useState('idle');
  const [statusText, setStatusText] = useState('Click the microphone to start');
  const [error, setError] = useState(null);
  const [insights, setInsights] = useState(null);
  const [spendingData, setSpendingData] = useState(null);
  const [trendsData, setTrendsData] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [topMerchants, setTopMerchants] = useState([]);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [jsonResponse, setJsonResponse] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const audioRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log('Speech recognized:', transcript);
        setTranscript(transcript);
        handleVoiceQuery(transcript);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setError(`Speech recognition error: ${event.error}`);
        setStatus('idle');
        setStatusText('Click the microphone to start');
        setIsRecording(false);
      };

      recognitionRef.current.onend = () => {
        console.log('Speech recognition ended');
        setIsRecording(false);
      };
    }
  }, []);



  // Load analytics on mount
  useEffect(() => {
    loadAnalytics();
    const interval = setInterval(loadAnalytics, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadAnalytics = async () => {
    try {
      const [insightsRes, spendingRes, trendsRes, anomaliesRes, merchantsRes] = await Promise.all([
        axios.get(`${API_URL}/analytics/insights`),
        axios.get(`${API_URL}/analytics/spending`),
        axios.get(`${API_URL}/analytics/trends?days=7`),
        axios.get(`${API_URL}/analytics/anomalies`),
        axios.get(`${API_URL}/analytics/top-merchants?limit=5`)
      ]);

      setInsights(insightsRes.data);
      setSpendingData(spendingRes.data);
      setTrendsData(trendsRes.data);
      setAnomalies(anomaliesRes.data);
      setTopMerchants(merchantsRes.data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
  };

  const handleVoiceQuery = async (voiceTranscript) => {
    setStatus('processing');
    setStatusText('Processing your request...');
    setError(null);
    setResponse('');
    setError(null);
    setResponse('');

    try {
      // Send the transcript directly to backend for processing
      const voiceResponse = await axios.post(`${API_URL}/process-text`, {
        text: voiceTranscript
      }, {
        responseType: 'arraybuffer',
      });

      const contentType = voiceResponse.headers['content-type'];
      
      if (contentType && contentType.includes('audio')) {
        const audioBlob = new Blob([voiceResponse.data], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);

        setStatus('playing');
        setStatusText('Playing response...');

        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onended = () => {
          setStatus('idle');
          setStatusText('Click the microphone to start');
          URL.revokeObjectURL(audioUrl);
          loadAnalytics(); // Refresh data after query
        };

        audio.onerror = (e) => {
          console.error('Audio playback error:', e);
          setError('Failed to play audio response');
          setStatus('idle');
          setStatusText('Click the microphone to start');
        };

        await audio.play();
      } else {
        const text = new TextDecoder().decode(voiceResponse.data);
        const jsonResponse = JSON.parse(text);
        
        if (jsonResponse.text) {
          setStatus('playing');
          setResponse(jsonResponse.text);
          setTranscript(jsonResponse.transcript || '');
          setJsonResponse(jsonResponse);
          setStatusText(jsonResponse.text);
          
          // Use browser TTS with natural, friendly voice
          if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(jsonResponse.text);
            
            // Get available voices and select a natural female voice
            const voices = window.speechSynthesis.getVoices();
            const preferredVoices = voices.filter(voice => 
              (voice.name.includes('Female') || voice.name.includes('Samantha') || 
               voice.name.includes('Karen') || voice.name.includes('Zira') ||
               voice.name.includes('Google') && voice.lang.startsWith('en')) &&
              !voice.name.includes('Male')
            );
            
            if (preferredVoices.length > 0) {
              utterance.voice = preferredVoices[0];
            }
            
            // Natural, friendly settings
            utterance.rate = 0.95; // Slightly slower for clarity
            utterance.pitch = 1.1; // Slightly higher for friendliness
            utterance.volume = 1.0;
            
            utterance.onend = () => {
              setStatus('idle');
              setStatusText('Click the microphone to start');
              loadAnalytics(); // Refresh data
            };
            
            utterance.onerror = (e) => {
              console.error('Speech synthesis error:', e);
              setStatus('idle');
              setTimeout(() => {
                setStatusText('Click the microphone to start');
              }, 3000);
            };
            
            window.speechSynthesis.speak(utterance);
          } else {
            setStatus('idle');
            setTimeout(() => {
              setStatusText('Click the microphone to start');
              loadAnalytics();
            }, 5000);
          }
        } else {
          throw new Error(jsonResponse.error || 'Unknown error');
        }
      }
    } catch (err) {
      console.error('Error processing voice:', err);
      setError(err.response?.data?.error || err.message || 'Failed to process voice request');
      setStatus('idle');
      setStatusText('Click the microphone to start');
    }
  };

  const handleMicClick = () => {
    if (isRecording) {
      // Stop recording
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      setStatus('processing');
      setStatusText('Processing your request...');
    } else {
      // Start recording
      setError(null);
      setTranscript('');
      setResponse('');
      setJsonResponse(null);
      
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsRecording(true);
          setStatus('recording');
          setStatusText('Listening... Speak your query');
        } catch (err) {
          console.error('Failed to start recognition:', err);
          setError('Failed to start speech recognition. Please check microphone permissions.');
        }
      } else {
        setError('Speech recognition not supported in this browser. Please use Chrome, Edge, or Safari.');
      }
    }
  };

  const getMicButtonClass = () => {
    if (isRecording) return 'mic-button recording';
    if (status === 'processing') return 'mic-button processing';
    if (status === 'playing') return 'mic-button playing';
    return 'mic-button';
  };

  const getMicIcon = () => {
    if (isRecording) return '🎙️';
    if (status === 'processing') return '⚙️';
    if (status === 'playing') return '🔊';
    return '🎤';
  };

  // Chart data
  const categoryChartData = spendingData ? {
    labels: spendingData.map(item => item.category),
    datasets: [{
      label: 'Spending by Category',
      data: spendingData.map(item => item.total),
      backgroundColor: [
        'rgba(255, 99, 132, 0.8)',
        'rgba(54, 162, 235, 0.8)',
        'rgba(255, 206, 86, 0.8)',
        'rgba(75, 192, 192, 0.8)',
        'rgba(153, 102, 255, 0.8)',
        'rgba(255, 159, 64, 0.8)',
      ],
      borderWidth: 0,
    }]
  } : null;

  const trendsChartData = trendsData ? {
    labels: trendsData.map(item => new Date(item.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
    datasets: [{
      label: 'Daily Spending',
      data: trendsData.map(item => item.total),
      borderColor: 'rgb(102, 126, 234)',
      backgroundColor: 'rgba(102, 126, 234, 0.1)',
      tension: 0.4,
      fill: true,
    }]
  } : null;

  return (
    <div className="app-pro">
      {/* Header */}
      <header className="header-pro">
        <div className="header-content">
          <h1 className="title-pro">🏦 VoiceBank Pro</h1>
          <p className="subtitle-pro">AI-Powered Voice Banking Analytics</p>
        </div>
      </header>

      <div className="main-container">
        {/* Left Panel - Voice Interface */}
        <div className="voice-panel">
          <div className="voice-interface">
            <button
              className={getMicButtonClass()}
              onClick={handleMicClick}
              disabled={status === 'processing' || status === 'playing'}
            >
              <span className="mic-icon">{getMicIcon()}</span>
            </button>

            <div className="status-container">
              <p className={`status-text ${status}`}>{statusText}</p>
              {transcript && (
                <div className="transcript-box">
                  <strong>You said:</strong> "{transcript}"
                  {jsonResponse && jsonResponse.browserSpeech && (
                    <small style={{display: 'block', marginTop: '8px', opacity: 0.7, color: '#43e97b'}}>
                      ✅ Using browser speech recognition (actually listening to you!)
                    </small>
                  )}
                  {jsonResponse && jsonResponse.demo && (
                    <small style={{display: 'block', marginTop: '8px', opacity: 0.7}}>
                      ⚠️ Demo mode: Add API keys for professional voice recognition
                    </small>
                  )}
                </div>
              )}
              {response && (
                <div className="response-box">
                  <strong>Response:</strong> {response}
                </div>
              )}
              {error && <p className="error-text">❌ {error}</p>}
            </div>

            <div className="quick-queries">
              <h3>💬 Try asking:</h3>
              <ul>
                <li>"What are my top expenses?"</li>
                <li>"Tell me a story about my spending"</li>
                <li>"Show me spending by category"</li>
                <li>"How much did I spend on food?"</li>
                <li>"Mera total spending kitna hai?" (Hinglish)</li>
              </ul>
              <div style={{marginTop: '15px', padding: '10px', background: 'rgba(67, 233, 123, 0.2)', borderRadius: '8px', fontSize: '0.85rem'}}>
                <strong>🎯 Pro Tip:</strong> Try different personas to see how the response changes!
              </div>
            </div>
          </div>

          {/* Insights Panel */}
          {insights && insights.insights && insights.insights.length > 0 && (
            <div className="insights-panel">
              <h3>💡 AI Insights</h3>
              {insights.insights.map((insight, idx) => (
                <div key={idx} className={`insight-card ${insight.priority}`}>
                  <span className="insight-icon">
                    {insight.type === 'spending' && '💰'}
                    {insight.type === 'anomaly' && '⚠️'}
                    {insight.type === 'trend' && '📈'}
                  </span>
                  <p>{insight.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Panel - Analytics Dashboard */}
        <div className="analytics-panel">
          <h2 className="panel-title">📊 Real-Time Analytics</h2>

          {/* Spending by Category */}
          {categoryChartData && (
            <div className="chart-container">
              <h3>Spending by Category</h3>
              <Doughnut data={categoryChartData} options={{ responsive: true, maintainAspectRatio: true }} />
            </div>
          )}

          {/* Spending Trends */}
          {trendsChartData && (
            <div className="chart-container">
              <h3>7-Day Spending Trend</h3>
              <Line data={trendsChartData} options={{ responsive: true, maintainAspectRatio: true }} />
            </div>
          )}

          {/* Top Merchants */}
          {topMerchants && topMerchants.length > 0 && (
            <div className="merchants-container">
              <h3>Top Merchants</h3>
              <div className="merchants-list">
                {topMerchants.map((merchant, idx) => (
                  <div key={idx} className="merchant-card">
                    <div className="merchant-rank">#{idx + 1}</div>
                    <div className="merchant-info">
                      <strong>{merchant.beneficiary}</strong>
                      <span>₹{merchant.total_spent.toLocaleString()} • {merchant.transaction_count} transactions</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Anomalies */}
          {anomalies && anomalies.length > 0 && (
            <div className="anomalies-container">
              <h3>⚠️ Unusual Transactions</h3>
              <div className="anomalies-list">
                {anomalies.slice(0, 3).map((txn, idx) => (
                  <div key={idx} className="anomaly-card">
                    <span className="anomaly-amount">₹{txn.amount}</span>
                    <span className="anomaly-merchant">{txn.beneficiary}</span>
                    <span className="anomaly-date">{new Date(txn.date).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="footer-pro">
        <p>🎯 Real-time analytics • 🔊 Voice-powered • 🧠 AI insights</p>
      </footer>
    </div>
  );
}

export default AppPro;
