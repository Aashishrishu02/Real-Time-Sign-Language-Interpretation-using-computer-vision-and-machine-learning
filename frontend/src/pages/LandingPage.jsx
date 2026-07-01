import React from "react";
import { Hand, Volume2, Sparkles, Database, BarChart3, Languages, ArrowRight, Video } from "lucide-react";

export default function LandingPage({ setCurrentPage }) {
  return (
    <div className="w-full min-h-screen bg-dark-bg text-slate-100 flex flex-col items-center">
      
      {/* 1. Hero Section */}
      <section className="w-full max-w-7xl px-6 pt-20 pb-16 flex flex-col items-center text-center relative overflow-hidden">
        {/* Glow backdrop decorative */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />
        
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-300 text-xs font-semibold mb-6 animate-pulse">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Bridging Communication Gaps with AI</span>
        </div>

        <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 max-w-4xl leading-tight">
          Real-Time Sign Language <br />
          <span className="bg-gradient-to-r from-brand-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
            Interpretation System
          </span>
        </h1>

        <p className="text-base md:text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed">
          SignSpeak AI leverages advanced computer vision and machine learning to detect hand gestures via webcam and translate sign language into speech and text instantly.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={() => setCurrentPage("recognition")}
            className="flex items-center gap-2 px-8 py-4 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl shadow-glow hover:shadow-indigo-500/30 transition-all duration-300 transform hover:-translate-y-0.5"
            id="start-interpreting-btn"
          >
            Start Interpreting Now
            <ArrowRight className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => setCurrentPage("dataset")}
            className="flex items-center gap-2 px-8 py-4 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-semibold rounded-xl border border-dark-border transition-all duration-300"
          >
            <Database className="w-5 h-5 text-indigo-400" />
            Record Custom Signs
          </button>
        </div>
      </section>

      {/* 2. Features Grid */}
      <section className="w-full max-w-7xl px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-4xl font-extrabold mb-3">Powered by Advanced Capabilities</h2>
          <p className="text-slate-400 text-sm md:text-base max-w-lg mx-auto">
            A comprehensive suite of tools built to deliver high speed translation, model customization, and utilization metrics.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="glass-panel glass-panel-hover p-6 rounded-2xl flex flex-col">
            <div className="p-3 bg-brand-500/10 rounded-xl border border-brand-500/20 w-fit mb-4">
              <Video className="w-6 h-6 text-brand-400" />
            </div>
            <h3 className="text-lg font-bold mb-2">Real-Time Tracker</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Detects and extracts 21 coordinate points of the hand skeleton directly in the browser at 30+ frames per second.
            </p>
          </div>

          {/* Card 2 */}
          <div className="glass-panel glass-panel-hover p-6 rounded-2xl flex flex-col">
            <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 w-fit mb-4">
              <Volume2 className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="text-lg font-bold mb-2">Voice & Speech Synthesis</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Converts translated gestures to audio read-out, complete with speed control, mute options, and volume adjustments.
            </p>
          </div>

          {/* Card 3 */}
          <div className="glass-panel glass-panel-hover p-6 rounded-2xl flex flex-col">
            <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 w-fit mb-4">
              <Languages className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-lg font-bold mb-2">Dual-Language Output</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Provides text-to-speech output in English and Hindi (नमस्ते) to enable localization in diverse regions.
            </p>
          </div>

          {/* Card 4 */}
          <div className="glass-panel glass-panel-hover p-6 rounded-2xl flex flex-col">
            <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 w-fit mb-4">
              <Database className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold mb-2">Dataset Recorder</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Create custom labels, stand before the webcam, and capture custom landmarks to compile coordinates into downloadable CSVs.
            </p>
          </div>

          {/* Card 5 */}
          <div className="glass-panel glass-panel-hover p-6 rounded-2xl flex flex-col">
            <div className="p-3 bg-pink-500/10 rounded-xl border border-pink-500/20 w-fit mb-4">
              <Sparkles className="w-6 h-6 text-pink-400" />
            </div>
            <h3 className="text-lg font-bold mb-2">Interactive ML Admin</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Train custom Random Forest classifiers using the recorded coordinates and view accuracy, precision, and confusion matrices.
            </p>
          </div>

          {/* Card 6 */}
          <div className="glass-panel glass-panel-hover p-6 rounded-2xl flex flex-col">
            <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 w-fit mb-4">
              <BarChart3 className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-lg font-bold mb-2">Usage Analytics</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Monitor total recognized logs, daily usage charts, confidence rankings, and most frequently matched signs.
            </p>
          </div>
        </div>
      </section>

      {/* 3. How It Works Workflow */}
      <section className="w-full bg-slate-950/40 border-y border-dark-border py-16 flex flex-col items-center">
        <div className="max-w-7xl w-full px-6 text-center">
          <h2 className="text-2xl md:text-4xl font-extrabold mb-12">The System Architecture</h2>
          
          <div className="grid md:grid-cols-4 gap-8 relative">
            
            {/* Step 1 */}
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-brand-500 text-white font-bold flex items-center justify-center mb-4">1</div>
              <h4 className="text-lg font-semibold mb-2">Webcam Input</h4>
              <p className="text-xs text-slate-400 max-w-[200px]">The user enables the camera inside the browser translator frame.</p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-brand-500 text-white font-bold flex items-center justify-center mb-4">2</div>
              <h4 className="text-lg font-semibold mb-2">Landmark Extraction</h4>
              <p className="text-xs text-slate-400 max-w-[200px]">MediaPipe identifies 21 joints on the hand skeletal system at 30 FPS.</p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-brand-500 text-white font-bold flex items-center justify-center mb-4">3</div>
              <h4 className="text-lg font-semibold mb-2">ML Classification</h4>
              <p className="text-xs text-slate-400 max-w-[200px]">63 coordinates are normalized and sent to the FastAPI ML Predictor.</p>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-brand-500 text-white font-bold flex items-center justify-center mb-4">4</div>
              <h4 className="text-lg font-semibold mb-2">Speech Synthesis</h4>
              <p className="text-xs text-slate-400 max-w-[200px]">The predicted sign is spoken aloud and added to the translation log.</p>
            </div>

          </div>
        </div>
      </section>

      {/* 4. Footer */}
      <footer className="w-full max-w-7xl px-6 py-12 border-t border-dark-border mt-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Hand className="w-5 h-5 text-brand-400" />
          <span className="font-bold text-sm">SignSpeak AI</span>
        </div>
        <p className="text-xs text-slate-500">&copy; 2026 SignSpeak AI. Developed for Final Year Engineering Project.</p>
      </footer>
    </div>
  );
}
