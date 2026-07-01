import React, { useState, useEffect, useRef } from "react";
import { Plus, Download, Trash2, Video, AlertCircle, Play, Square, Check, Activity } from "lucide-react";
import WebcamFeed from "../components/WebcamFeed";

export default function DatasetPage({ isBackendConnected }) {
  const [targetLabel, setTargetLabel] = useState("Hello");
  const [customLabel, setCustomLabel] = useState("");
  const [totalSamples, setTotalSamples] = useState(0);
  const [labelSummary, setLabelSummary] = useState({});
  const [isRecording, setIsRecordingState] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [lastMessage, setLastMessage] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  
  const activeLandmarks = useRef(null);
  const isRecordingRef = useRef(false);
  const recordedFrames = useRef([]);

  const setIsRecording = (val) => {
    isRecordingRef.current = val;
    setIsRecordingState(val);
  };

  const defaultGestures = ["Hello", "Thank You", "Yes", "No", "Help", "Water", "Food", "Stop", "Good", "Bad"];

  useEffect(() => {
    fetchDatasetStatus();
  }, []);

  const fetchDatasetStatus = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/dataset/status");
      if (res.ok) {
        const data = await res.json();
        setTotalSamples(data.total_samples);
        setLabelSummary(data.labels_summary);
      }
    } catch (e) {
      console.error("Error fetching dataset status:", e);
    }
  };

  const handleAddCustomLabel = (e) => {
    e.preventDefault();
    if (customLabel.trim()) {
      setTargetLabel(customLabel.trim());
      setCustomLabel("");
    }
  };

  const onLandmarksDetected = (landmarks) => {
    let currentFrame = null;
    if (Array.isArray(landmarks) && Array.isArray(landmarks[0])) {
      currentFrame = landmarks[0];
    } else if (Array.isArray(landmarks)) {
      currentFrame = landmarks;
    }
    
    activeLandmarks.current = currentFrame;

    if (isRecordingRef.current && currentFrame) {
      recordedFrames.current.push(currentFrame);
      const count = recordedFrames.current.length;
      setFrameCount(count);

      if (count >= 30) {
        setIsRecording(false);
        sendSequenceDataset(recordedFrames.current);
      }
    }
  };

  const startRecording = () => {
    if (!isBackendConnected) {
      alert("Backend API is offline. Cannot record landmarks.");
      return;
    }
    
    recordedFrames.current = [];
    setFrameCount(0);
    setIsRecording(true);
    setLastMessage(null);
  };

  const sendSequenceDataset = async (frames) => {
    try {
      const flatSeq = frames.flat();
      if (flatSeq.length !== 1890) {
        console.error("Incorrect sequence length:", flatSeq.length);
        setLastMessage("Error: Sequence size mismatch.");
        setTimeout(() => setLastMessage(null), 3000);
        return;
      }

      const res = await fetch("http://localhost:8000/api/dataset/record-sequence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: targetLabel,
          landmarks_seq: flatSeq,
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setTotalSamples(data.total_samples);
        setLabelSummary(data.labels_summary);
        setLastMessage("Captured 30-frame sequence!");
        setTimeout(() => setLastMessage(null), 3000);
      } else {
        setLastMessage("Failed to save sequence.");
        setTimeout(() => setLastMessage(null), 3000);
      }
    } catch (e) {
      console.error("Error recording sequence:", e);
      setLastMessage("Error saving sequence.");
      setTimeout(() => setLastMessage(null), 3000);
    }
  };

  const stopRecording = (msg = null) => {
    setIsRecording(false);
    if (msg) {
      setLastMessage(msg);
      setTimeout(() => setLastMessage(null), 3000);
    }
  };

  const handleClearDataset = async () => {
    if (window.confirm("Are you sure you want to completely clear the dataset and delete all trained models?")) {
      try {
        const res = await fetch("http://localhost:8000/api/dataset/clear", {
          method: "DELETE",
        });
        if (res.ok) {
          setTotalSamples(0);
          setLabelSummary({});
          setLastMessage("Dataset cleared successfully.");
          setTimeout(() => setLastMessage(null), 3000);
        }
      } catch (e) {
        console.error("Error clearing dataset:", e);
      }
    }
  };

  const handleDownloadDataset = () => {
    window.open("http://localhost:8000/api/dataset/download");
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-10 grid lg:grid-cols-3 gap-8">
      
      {/* Left Column - Recording interface */}
      <div className="lg:col-span-2 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dataset Recorder</h1>
          <p className="text-xs text-slate-400">Assemble coordinates for machine learning model training</p>
        </div>

        {/* Live capture feed */}
        <WebcamFeed 
          onLandmarksDetected={onLandmarksDetected}
          showLandmarks={true}
          isActive={true}
        />

        {/* Target settings & capture controls */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row gap-4 items-end justify-between">
            {/* Label selection */}
            <div className="flex-1 flex flex-col gap-1.5 w-full">
              <label className="text-xs text-slate-400 font-semibold">Active Target Sign</label>
              <select
                value={targetLabel}
                onChange={(e) => setTargetLabel(e.target.value)}
                disabled={isRecording}
                className="w-full bg-slate-950 border border-dark-border rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-brand-500 transition-colors"
              >
                {defaultGestures.map((gesture) => (
                  <option key={gesture} value={gesture}>
                    {gesture}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Label Creator */}
            <form onSubmit={handleAddCustomLabel} className="flex-1 flex flex-col gap-1.5 w-full">
              <label className="text-xs text-slate-400 font-semibold">Or Create Custom Label</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Please"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  disabled={isRecording}
                  className="flex-1 bg-slate-950 border border-dark-border rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-brand-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={isRecording}
                  className="px-4 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl flex items-center justify-center transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>

          {/* Capture Trigger controls */}
          <div className="flex items-center justify-between border-t border-dark-border pt-4">
            <div className="flex items-center gap-3">
              {isRecording ? (
                <button
                  onClick={() => stopRecording("Recording cancelled.")}
                  className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition-all duration-300"
                >
                  <Square className="w-4 h-4 fill-white" />
                  Stop Recording
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl transition-all duration-300"
                >
                  <Play className="w-4 h-4 fill-white" />
                  Record Sequence for "{targetLabel}"
                </button>
              )}
            </div>

            {/* Capture Progress indicator */}
            <div className="flex items-center gap-3">
              {isRecording && (
                <div className="flex items-center gap-2 text-xs">
                  <Activity className="w-4 h-4 text-brand-400 animate-pulse" />
                  <span className="text-slate-400">Capturing sequence:</span>
                  <span className="font-bold text-white text-sm bg-brand-500/20 px-2 py-0.5 rounded border border-brand-500/30 animate-pulse">
                    Frame {frameCount} / 30
                  </span>
                </div>
              )}

              {lastMessage && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs">
                  <Check className="w-3.5 h-3.5" />
                  {lastMessage}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Column - Dataset Breakdown stats */}
      <div className="flex flex-col gap-6">
        
        {/* Actions panel */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4">
          <h3 className="text-sm font-bold text-slate-400 border-b border-dark-border pb-3 uppercase tracking-wider">
            Dataset Actions
          </h3>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleDownloadDataset}
              disabled={totalSamples === 0}
              className="flex items-center justify-center gap-2 w-full py-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-30 disabled:hover:bg-brand-500 text-white font-bold rounded-xl shadow-glow transition-all duration-300"
            >
              <Download className="w-4 h-4" />
              Download Dataset CSV
            </button>
            
            <button
              onClick={handleClearDataset}
              disabled={totalSamples === 0}
              className="flex items-center justify-center gap-2 w-full py-3 bg-rose-600/15 hover:bg-rose-600/30 border border-rose-500/20 disabled:opacity-30 disabled:hover:bg-rose-600/15 text-rose-400 font-bold rounded-xl transition-all duration-300"
            >
              <Trash2 className="w-4 h-4" />
              Reset & Clear Dataset
            </button>
          </div>
        </div>

        {/* Gesture Reference Guide Accordion */}
        <div className="glass-panel p-5 rounded-2xl flex flex-col gap-3">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center justify-between w-full text-sm font-bold text-slate-400 uppercase tracking-wider text-left outline-none"
            id="dataset-guide-toggle-btn"
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

        {/* Dataset Breakdown summary table */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4 flex-1">
          <h3 className="text-sm font-bold text-slate-400 border-b border-dark-border pb-3 uppercase tracking-wider flex justify-between items-center">
            <span>Landmark Summary</span>
            <span className="text-xs text-brand-400 font-semibold px-2 py-0.5 rounded bg-brand-500/10 border border-brand-500/20">
              Total: {totalSamples}
            </span>
          </h3>

          <div className="flex flex-col gap-2 overflow-y-auto max-h-[350px] pr-1">
            {Object.keys(labelSummary).length > 0 ? (
              Object.entries(labelSummary).map(([label, count]) => (
                <div
                  key={label}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-white/5 text-xs"
                >
                  <span className="font-bold text-slate-200">{label}</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/20">
                    {count} samples
                  </span>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-10 px-4 text-slate-500">
                <AlertCircle className="w-8 h-8 mb-2 text-slate-600" />
                <span className="text-xs italic">
                  Dataset file is empty. Click record to create sample landmarks.
                </span>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
