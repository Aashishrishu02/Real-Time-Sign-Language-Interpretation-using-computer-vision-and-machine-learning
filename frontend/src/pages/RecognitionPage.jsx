import React, { useState, useEffect, useRef } from "react";
import { Volume2, VolumeX, RefreshCw, Download, Mic, Hand, Trash2, Copy, ArrowLeftRight } from "lucide-react";
import WebcamFeed from "../components/WebcamFeed";
import { API_URL, WS_URL } from "../config";

export default function RecognitionPage({ isBackendConnected }) {
  const [currentGesture, setCurrentGesture] = useState(null);
  const [confidence, setConfidence] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [sentence, setSentence] = useState("");
  const [history, setHistory] = useState([]);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [language, setLanguage] = useState("English");
  const [showGuide, setShowGuide] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  // ML sequence references
  const bufferRef = useRef([]);
  const lastPredictionTime = useRef(0);
  const lastMovementTimeRef = useRef(Date.now());
  const isSigningRef = useRef(false);
  const hasUncommittedSignRef = useRef(false);
  const hasUncommittedSentenceRef = useRef(false);
  const currentSignPredictionsRef = useRef([]);
  const wsRef = useRef(null);

  // Set up WebSocket connection for real-time predictions
  useEffect(() => {
    let reconnectTimeout = null;
    let ws = null;
    let isComponentMounted = true;
    let retryCount = 0;
    const maxRetryDelay = 10000;

    const connectWebSocket = () => {
      if (!isComponentMounted) return;
      
      console.log("Connecting to WebSocket prediction server...");
      try {
        ws = new WebSocket(`${WS_URL}/api/ws/predict`);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isComponentMounted) return;
          console.log("WebSocket prediction connection established.");
          setWsConnected(true);
          retryCount = 0; // reset retry counter
        };

        ws.onmessage = (event) => {
          if (!isComponentMounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data.success) {
              // Push predicted gesture labels (except Neutral, Error, Unknown) to active sign predictions log
              if (data.gesture !== "Neutral" && data.gesture !== "Error" && data.gesture !== "Unknown") {
                currentSignPredictionsRef.current.push(data.gesture);
              }
              
              setCurrentGesture(data.translated_text);
              setConfidence(data.confidence);
            }
          } catch (err) {
            console.error("Error parsing WebSocket prediction message:", err);
          }
        };

        ws.onerror = (err) => {
          console.error("WebSocket prediction error:", err);
        };

        ws.onclose = (event) => {
          if (!isComponentMounted) return;
          setWsConnected(false);
          wsRef.current = null;
          console.log(`WebSocket prediction closed. Code: ${event.code}. Reason: ${event.reason}`);
          
          // Exponential backoff reconnect
          const delay = Math.min(1000 * Math.pow(2, retryCount), maxRetryDelay);
          retryCount++;
          console.log(`Reconnecting to WebSocket in ${delay}ms...`);
          reconnectTimeout = setTimeout(connectWebSocket, delay);
        };
      } catch (err) {
        console.error("Failed to construct WebSocket:", err);
        setWsConnected(false);
        wsRef.current = null;
        reconnectTimeout = setTimeout(connectWebSocket, 5000);
      }
    };

    connectWebSocket();

    return () => {
      isComponentMounted = false;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounted");
        wsRef.current = null;
      }
    };
  }, []);

  // Load settings and history on mount
  useEffect(() => {
    fetchSettings();
    fetchHistory();
  }, []);

  // Set up background timer for pause segmentation checks
  useEffect(() => {
    const timer = setInterval(() => {
      checkSegmentationTimers(Date.now());
    }, 500);
    return () => clearInterval(timer);
  }, [language, liveTranscript, sentence]);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings`);
      if (res.ok) {
        const data = await res.json();
        setLanguage(data.language);
        setVolume(data.volume);
        setIsMuted(!data.auto_speak);
      }
    } catch (e) {
      console.error("Error fetching settings:", e);
    }
  };

  const updateSettings = async (updates) => {
    try {
      await fetch(`${API_URL}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: updates.language !== undefined ? updates.language : language,
          volume: updates.volume !== undefined ? updates.volume : volume,
          auto_speak: updates.auto_speak !== undefined ? updates.auto_speak : !isMuted,
        }),
      });
    } catch (e) {
      console.error("Error saving settings:", e);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (e) {
      console.error("Error fetching conversation history:", e);
    }
  };

  const computeVelocity = (frame1, frame2) => {
    if (!frame1 || !frame2) return 0;
    let sumDist = 0;
    for (let i = 0; i < 21; i++) {
      const dx = frame2[i * 3] - frame1[i * 3];
      const dy = frame2[i * 3 + 1] - frame1[i * 3 + 1];
      const dz = frame2[i * 3 + 2] - frame1[i * 3 + 2];
      sumDist += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    return sumDist / 21;
  };

  const onLandmarksDetected = (handsList) => {
    const now = Date.now();
    const hasHands = handsList && handsList.length > 0;

    if (hasHands) {
      const landmarks = Array.isArray(handsList[0]) ? handsList[0] : handsList;
      
      bufferRef.current.push(landmarks);
      if (bufferRef.current.length > 30) {
        bufferRef.current.shift();
      }

      let velocity = 0;
      if (bufferRef.current.length >= 2) {
        const frame1 = bufferRef.current[bufferRef.current.length - 2];
        const frame2 = bufferRef.current[bufferRef.current.length - 1];
        velocity = computeVelocity(frame1, frame2);
      }

      // If hand moves above movement threshold, update timers
      if (velocity >= 0.005) {
        lastMovementTimeRef.current = now;
        isSigningRef.current = true;
        hasUncommittedSignRef.current = true;
      }

      // Predict sequence at 4 FPS (250ms) using the 30-frame sliding window
      if (now - lastPredictionTime.current > 250) {
        lastPredictionTime.current = now;
        if (bufferRef.current.length === 30) {
          performPrediction(bufferRef.current.flat());
        }
      }
    } else {
      // Clear sequence buffer if hands leave frame
      bufferRef.current = [];
    }

    checkSegmentationTimers(now);
  };

  const performPrediction = async (landmarksSeq) => {
    // 1. Try sending via WebSocket first for high-efficiency, real-time performance
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ landmarks_seq: landmarksSeq }));
        return; // Success!
      } catch (err) {
        console.warn("WebSocket send failed. Falling back to HTTP prediction.", err);
      }
    }

    // 2. HTTP Fallback if WebSocket is not open or fails
    if (!isBackendConnected) return;

    try {
      const res = await fetch(`${API_URL}/api/predict/sequence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ landmarks_seq: landmarksSeq }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          // Push predicted gesture labels (except Neutral, Error, Unknown) to active sign predictions log
          if (data.gesture !== "Neutral" && data.gesture !== "Error" && data.gesture !== "Unknown") {
            currentSignPredictionsRef.current.push(data.gesture);
          }
          
          setCurrentGesture(data.translated_text);
          setConfidence(data.confidence);
        }
      }
    } catch (e) {
      console.error("HTTP fallback prediction error:", e);
    }
  };

  const checkSegmentationTimers = (now) => {
    const elapsedSinceMovement = (now - lastMovementTimeRef.current) / 1000;

    // 1. Word segmentation pause (2 seconds)
    if (isSigningRef.current && elapsedSinceMovement >= 2.0 && hasUncommittedSignRef.current) {
      commitActiveSign();
    }

    // 2. Sentence finalization pause (5 seconds)
    if (elapsedSinceMovement >= 5.0 && hasUncommittedSentenceRef.current) {
      finalizeSentence();
    }
  };

  const commitActiveSign = () => {
    hasUncommittedSignRef.current = false;
    isSigningRef.current = false;

    const predictions = currentSignPredictionsRef.current;
    if (predictions.length === 0) return;

    // Determine the most frequent gesture prediction during the signing period
    const freq = {};
    predictions.forEach((p) => {
      freq[p] = (freq[p] || 0) + 1;
    });

    let bestGesture = null;
    let maxCount = 0;
    Object.entries(freq).forEach(([g, count]) => {
      if (count > maxCount) {
        maxCount = count;
        bestGesture = g;
      }
    });

    currentSignPredictionsRef.current = [];

    if (bestGesture) {
      setLiveTranscript((prev) => {
        const next = prev ? prev + " " + bestGesture : bestGesture;
        hasUncommittedSentenceRef.current = true;
        return next;
      });

      // Show confirmed gesture feedback
      const translated = TRANSLATIONS[language]?.[bestGesture] || bestGesture;
      setCurrentGesture(translated);
      setConfidence(1.0);
    }
  };

  const finalizeSentence = async () => {
    hasUncommittedSentenceRef.current = false;

    let transcriptText = "";
    setLiveTranscript((prev) => {
      transcriptText = prev;
      return "";
    });

    if (!transcriptText.trim()) return;

    try {
      // 1. Query translation from backend
      const transRes = await fetch(`${API_URL}/api/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: transcriptText,
          target_language: language,
        }),
      });

      let translatedText = transcriptText;
      if (transRes.ok) {
        const transData = await transRes.json();
        if (transData.success) {
          translatedText = transData.translated_text;
        }
      }

      setSentence(translatedText);

      // 2. TTS Read sentence aloud
      speakText(translatedText);

      // 3. Save logs to database conversation history
      const saveRes = await fetch(`${API_URL}/api/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcriptText,
          translation: translatedText,
          language: language,
        }),
      });

      if (saveRes.ok) {
        fetchHistory();
      }
    } catch (e) {
      console.error("Error finalising sentence:", e);
    }
  };

  const speakText = (text) => {
    if (isMuted || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = volume;
    utterance.lang = language === "Hindi" ? "hi-IN" : "en-US";
    window.speechSynthesis.speak(utterance);
  };

  const handleLanguageChange = (e) => {
    const lang = e.target.value;
    setLanguage(lang);
    updateSettings({ language: lang });
  };

  const handleVolumeChange = (e) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    updateSettings({ volume: vol });
  };

  const handleMuteToggle = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    updateSettings({ auto_speak: !newMutedState });
  };

  const handleResetSentence = () => {
    setLiveTranscript("");
    setSentence("");
    currentSignPredictionsRef.current = [];
    isSigningRef.current = false;
    hasUncommittedSignRef.current = false;
    hasUncommittedSentenceRef.current = false;
  };

  const handleRemoveLastWord = () => {
    if (liveTranscript) {
      setLiveTranscript((prev) => {
        const words = prev.trim().split(" ");
        if (words.length <= 1) return "";
        words.pop();
        return words.join(" ");
      });
    } else if (sentence) {
      setSentence((prev) => {
        const words = prev.trim().split(" ");
        if (words.length <= 1) return "";
        words.pop();
        return words.join(" ");
      });
    }
  };

  const handleCopySentence = () => {
    const textToCopy = sentence || liveTranscript;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      alert("Copied to clipboard!");
    }
  };

  const handleDownloadTranscriptFile = () => {
    if (history.length === 0) {
      alert("No conversation history to download.");
      return;
    }
    const fileContent = history
      .map((log) => {
        const time = new Date(log.timestamp).toLocaleString();
        return `[${time}] (${log.language})\nTranscript: ${log.transcript}\nTranslation: ${log.translation}\n`;
      })
      .join("\n");

    const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `signspeak_conversation_transcript_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearHistory = async () => {
    if (window.confirm("Are you sure you want to delete the conversation history?")) {
      try {
        const res = await fetch(`${API_URL}/api/history`, {
          method: "DELETE",
        });
        if (res.ok) {
          setHistory([]);
        }
      } catch (e) {
        console.error("Error clearing history:", e);
      }
    }
  };

  // Local helper for quick static UI translations
  const TRANSLATIONS = {
    English: {
      Hello: "Hello", "Thank You": "Thank You", Yes: "Yes", No: "No", Help: "Help",
      Water: "Water", Food: "Food", Stop: "Stop", Good: "Good", Bad: "Bad",
      Neutral: "Neutral", Unknown: "Unknown", Error: "Error"
    },
    Hindi: {
      Hello: "नमस्ते", "Thank You": "धन्यवाद", Yes: "हाँ", No: "नहीं", Help: "मदद",
      Water: "पानी", Food: "खाना", Stop: "रुकिए", Good: "अच्छा", Bad: "खराब",
      Neutral: "न्यूट्रल", Unknown: "अज्ञात", Error: "त्रुटि"
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-10 flex flex-col gap-8 animate-fade-in">
      
      {/* Top section: Interpreter and Sidebar feedback */}
      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Left Column (Video feed + Transcript) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight">Continuous Sign Interpreter</h1>
                {wsConnected ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-glow-green animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    WS Active
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    HTTP Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">Stream sequence frames continuously to translate sentence blocks</p>
            </div>
            
            <button
              onClick={() => setShowSkeleton(!showSkeleton)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-300 ${
                showSkeleton
                  ? "bg-brand-500/10 text-brand-400 border-brand-500/20"
                  : "bg-slate-900 text-slate-400 border-dark-border"
              }`}
            >
              {showSkeleton ? "Hide Skeleton" : "Show Skeleton"}
            </button>
          </div>

          <WebcamFeed 
            onLandmarksDetected={onLandmarksDetected} 
            showLandmarks={showSkeleton}
            isActive={true}
          />

          {/* Transcript Panel */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-dark-border pb-3">
              <span className="text-xs text-slate-400 font-semibold tracking-wider uppercase flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-brand-400" />
                Real-Time Transcript Panel
              </span>
              <div className="flex gap-3">
                <button
                  onClick={handleRemoveLastWord}
                  disabled={!liveTranscript && !sentence}
                  className="text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 text-xs transition-colors flex items-center gap-1 font-semibold"
                  title="Remove last word"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  Backspace
                </button>
                <button
                  onClick={handleCopySentence}
                  disabled={!liveTranscript && !sentence}
                  className="text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 text-xs transition-colors flex items-center gap-1 font-semibold"
                  title="Copy text"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </button>
                <button
                  onClick={handleResetSentence}
                  disabled={!liveTranscript && !sentence}
                  className="text-slate-400 hover:text-rose-400 disabled:opacity-30 disabled:hover:text-slate-400 text-xs transition-colors flex items-center gap-1 font-semibold"
                  title="Clear sentence buffer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Clear
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {/* Live Transcript Buffer */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Live Transcript (Accumulating Words)</span>
                <div className="bg-slate-950/60 rounded-xl p-3 min-h-[50px] flex items-center border border-white/5">
                  {liveTranscript ? (
                    <span className="text-sm font-semibold text-slate-300 tracking-wide">
                      {liveTranscript}
                    </span>
                  ) : (
                    <span className="text-slate-600 text-xs italic">
                      Signing words will buffer here...
                    </span>
                  )}
                </div>
              </div>

              {/* Final Sentence Translation */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] text-brand-400 font-bold uppercase tracking-wider">Final Sentence ({language})</span>
                <div className="bg-brand-500/5 rounded-xl p-4 min-h-[70px] flex items-center border border-brand-500/10">
                  {sentence ? (
                    <span className="text-base md:text-lg font-bold text-white tracking-wide glow-text">
                      {sentence}
                    </span>
                  ) : (
                    <span className="text-slate-600 text-xs italic">
                      Finalized translation will appear here after a 5-second pause...
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column (Controls Sidebar) */}
        <div className="flex flex-col gap-6">
          
          {/* Prediction feedback box */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col gap-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/5 blur-2xl rounded-full pointer-events-none" />
            
            <h3 className="text-sm font-bold text-slate-400 border-b border-dark-border pb-3 uppercase tracking-wider">
              Live Word Detector
            </h3>

            <div className="flex flex-col items-center justify-center py-4 text-center">
              {currentGesture ? (
                <>
                  <span className="text-5xl font-black text-white glow-text tracking-wide mb-3 animate-fade-in">
                    {currentGesture}
                  </span>
                  
                  <div className="w-full max-w-[200px] mt-4">
                    <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                      <span>LSTM Confidence</span>
                      <span>{Math.round(confidence * 100)}%</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-white/5">
                      <div
                        className="bg-brand-500 h-2.5 rounded-full transition-all duration-300 shadow-glow"
                        style={{ width: `${confidence * 100}%` }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center py-6">
                  <Hand className="w-12 h-12 text-slate-600 animate-bounce mb-3" />
                  <span className="text-sm text-slate-500 italic">No hands tracking</span>
                </div>
              )}
            </div>
          </div>

          {/* Voice Output synthesis controls */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col gap-5">
            <h3 className="text-sm font-bold text-slate-400 border-b border-dark-border pb-3 uppercase tracking-wider">
              Voice Settings
            </h3>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 font-semibold">Speech Language</label>
              <select
                value={language}
                onChange={handleLanguageChange}
                className="w-full bg-slate-950 border border-dark-border rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-brand-500 transition-colors"
              >
                <option value="English">English</option>
                <option value="Hindi">Hindi (हिंदी)</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-4">
              <button
                onClick={handleMuteToggle}
                className="p-3 bg-slate-950 hover:bg-slate-900 text-slate-300 hover:text-white rounded-xl border border-dark-border transition-colors"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-brand-400" />}
              </button>
              <div className="flex-1 flex flex-col gap-1">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Volume</span>
                  <span>{Math.round(volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={handleVolumeChange}
                  disabled={isMuted}
                  className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-brand-500 disabled:opacity-30"
                />
              </div>
            </div>
          </div>

          {/* Gesture reference guides */}
          <div className="glass-panel p-5 rounded-2xl flex flex-col gap-3">
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="flex items-center justify-between w-full text-sm font-bold text-slate-400 uppercase tracking-wider text-left outline-none"
              id="recognition-guide-toggle-btn"
            >
              <span>Gesture Guide Reference</span>
              <span className="text-[10px] text-brand-400 font-bold bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20">
                {showGuide ? "Hide Guide" : "Show Guide"}
              </span>
            </button>
            
            {showGuide && (
              <div className="mt-1 rounded-xl overflow-hidden border border-white/5 bg-slate-950/40 p-2 animate-fade-in">
                <img 
                  src="/gesture_guide.png" 
                  alt="Sign Language Gesture Reference Guide" 
                  className="w-full h-auto rounded-lg shadow-sm"
                />
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Bottom Panel: Conversation logs */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-dark-border pb-3">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
            Conversation Logs History
          </h3>
          <div className="flex gap-3">
            <button
              onClick={handleDownloadTranscriptFile}
              disabled={history.length === 0}
              className="flex items-center gap-1 text-slate-400 hover:text-brand-300 disabled:opacity-30 disabled:hover:text-slate-400 text-xs transition-colors font-semibold"
              title="Download text logs"
            >
              <Download className="w-3.5 h-3.5" />
              Download TXT
            </button>
            <button
              onClick={handleClearHistory}
              disabled={history.length === 0}
              className="flex items-center gap-1 text-slate-400 hover:text-rose-400 disabled:opacity-30 disabled:hover:text-slate-400 text-xs transition-colors font-semibold"
              title="Delete all history"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear logs
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-1">
          {history.length > 0 ? (
            history.map((log) => (
              <div
                key={log.id}
                className="flex flex-col gap-2 p-4 rounded-xl bg-slate-950/40 border border-white/5 text-xs transition-all hover:border-white/10"
              >
                <div className="flex justify-between items-center text-[10px] text-slate-500 border-b border-white/5 pb-1">
                  <span>
                    {new Date(log.timestamp).toLocaleString([], {
                      dateStyle: "short",
                      timeStyle: "medium",
                    })}
                  </span>
                  <span className="text-brand-400 font-bold uppercase tracking-wider">
                    {log.language}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-start gap-2">
                    <span className="text-[9px] bg-slate-800 text-slate-400 px-1 py-0.5 rounded font-bold uppercase select-none mt-0.5">
                      Transcript
                    </span>
                    <span className="text-slate-200 font-medium">{log.transcript}</span>
                  </div>
                  {log.language !== "English" && (
                    <div className="flex items-start gap-2">
                      <span className="text-[9px] bg-brand-500/20 text-brand-400 px-1 py-0.5 rounded font-bold uppercase select-none mt-0.5">
                        Translation
                      </span>
                      <span className="text-white font-bold">{log.translation}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="md:col-span-2 flex flex-col items-center justify-center py-10 text-slate-500 text-xs italic">
              No conversation logs captured yet. Complete a sign sequence to generate logs.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
