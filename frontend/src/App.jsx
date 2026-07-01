import React, { useState, useEffect } from "react";
import { X, Volume2, VolumeX, ShieldAlert, Sparkles, Sliders, Settings } from "lucide-react";
import Navbar from "./components/Navbar";
import LandingPage from "./pages/LandingPage";
import RecognitionPage from "./pages/RecognitionPage";
import DatasetPage from "./pages/DatasetPage";
import AdminPage from "./pages/AdminPage";

export default function App() {
  const [currentPage, setCurrentPage] = useState("landing");
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    language: "English",
    volume: 1.0,
    auto_speak: true,
  });

  // Perform API connectivity check on mount and poll every 3 seconds
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/settings");
        if (res.ok) {
          setIsBackendConnected(true);
          const data = await res.json();
          setSettings(data);
        } else {
          setIsBackendConnected(false);
        }
      } catch (err) {
        setIsBackendConnected(false);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveSettings = async (updatedSettings) => {
    const newSettings = { ...settings, ...updatedSettings };
    setSettings(newSettings);
    
    if (isBackendConnected) {
      try {
        await fetch("http://localhost:8000/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newSettings),
        });
      } catch (e) {
        console.error("Failed to sync settings with backend:", e);
      }
    }
  };

  const handleResetHistory = async () => {
    if (window.confirm("Are you sure you want to delete all speech history logs?")) {
      try {
        const res = await fetch("http://localhost:8000/api/analytics/history/clear", {
          method: "DELETE",
        });
        if (res.ok) {
          alert("Speech logs reset successfully.");
        }
      } catch (e) {
        console.error("Error clearing speech logs:", e);
      }
    }
  };

  // Render active page component
  const renderPage = () => {
    switch (currentPage) {
      case "landing":
        return <LandingPage setCurrentPage={setCurrentPage} />;
      case "recognition":
        return <RecognitionPage isBackendConnected={isBackendConnected} />;
      case "dataset":
        return <DatasetPage isBackendConnected={isBackendConnected} />;
      case "admin":
        return <AdminPage isBackendConnected={isBackendConnected} />;
      default:
        return <LandingPage setCurrentPage={setCurrentPage} />;
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg text-slate-100 flex flex-col font-sans select-none overflow-x-hidden">
      
      {/* Top Navigation */}
      <Navbar
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isBackendConnected={isBackendConnected}
      />

      {/* Main Page Content Body */}
      <main className="flex-1 w-full relative">
        {renderPage()}
      </main>

      {/* Settings Modal (Frosted Glass Glassmorphism UI) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="relative w-full max-w-md bg-dark-card border border-dark-border rounded-2xl glass-panel p-6 shadow-glow overflow-hidden">
            {/* Glow backdrop decorative */}
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-brand-500/10 blur-xl rounded-full" />
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-dark-border pb-4 mb-5">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-brand-400" />
                <h3 className="text-base font-extrabold text-white">System Settings</h3>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-1.5 hover:bg-white/5 rounded-lg border border-dark-border text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form list settings */}
            <div className="flex flex-col gap-5">
              
              {/* Output Language select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400 font-semibold">Interpretation Output Language</label>
                <select
                  value={settings.language}
                  onChange={(e) => handleSaveSettings({ language: e.target.value })}
                  className="w-full bg-slate-950 border border-dark-border rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-brand-500 transition-colors"
                >
                  <option value="English">English</option>
                  <option value="Hindi">Hindi (हिंदी)</option>
                </select>
              </div>

              {/* Mute Voice checkbox */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-white/5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold text-slate-200">Auto-Play Voice Synthesis</span>
                  <span className="text-[10px] text-slate-500">Enable voice speech output automatically</span>
                </div>
                <button
                  onClick={() => handleSaveSettings({ auto_speak: !settings.auto_speak })}
                  className={`p-2.5 rounded-lg border transition-all duration-300 ${
                    settings.auto_speak
                      ? "bg-brand-500/10 text-brand-400 border-brand-500/20"
                      : "bg-slate-900 text-slate-500 border-dark-border"
                  }`}
                >
                  {settings.auto_speak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
              </div>

              {/* Volume scale range */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-xs text-slate-400 font-semibold">
                  <span>Voice Pitch Volume</span>
                  <span>{Math.round(settings.volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.volume}
                  onChange={(e) => handleSaveSettings({ volume: parseFloat(e.target.value) })}
                  disabled={!settings.auto_speak}
                  className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-brand-500 disabled:opacity-30"
                />
              </div>

              {/* Maintenance actions */}
              <div className="border-t border-dark-border pt-4 mt-2 flex flex-col gap-2.5">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Maintenance Controls</span>
                <button
                  onClick={handleResetHistory}
                  className="w-full py-2.5 bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/20 text-rose-400 hover:text-rose-300 text-xs font-semibold rounded-xl transition-all duration-300"
                >
                  Clear History Recognition Logs
                </button>
              </div>

            </div>

            {/* Bottom buttons */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl text-xs shadow-glow transition-colors"
              >
                Close Settings
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
