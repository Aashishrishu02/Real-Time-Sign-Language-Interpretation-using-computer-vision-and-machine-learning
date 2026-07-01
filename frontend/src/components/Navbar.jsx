import React from "react";
import { Hand, Activity, BookOpen, Settings, ShieldAlert, CheckCircle, Wifi, WifiOff } from "lucide-react";

export default function Navbar({ currentPage, setCurrentPage, onOpenSettings, isBackendConnected }) {
  const navItems = [
    { id: "landing", label: "Home", icon: BookOpen },
    { id: "recognition", label: "Translator", icon: Hand },
    { id: "dataset", label: "Dataset Recorder", icon: Activity },
    { id: "admin", label: "Admin Panel", icon: Settings },
  ];

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-dark-border bg-[#06070c]/85 backdrop-blur-md px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        
        {/* Logo */}
        <div 
          className="flex items-center gap-2 cursor-pointer group"
          onClick={() => setCurrentPage("landing")}
        >
          <div className="p-2 bg-brand-500/10 rounded-lg border border-brand-500/20 group-hover:bg-brand-500/20 transition-all duration-300">
            <Hand className="w-6 h-6 text-brand-400 animate-pulse" />
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-brand-400 bg-clip-text text-transparent">
              SignSpeak
            </span>
            <span className="ml-1 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30">
              AI
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="hidden md:flex items-center gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? "bg-brand-500 text-white shadow-glow"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-4">
          {/* Connection Status Badge */}
          <div 
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              isBackendConnected 
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse"
            }`}
          >
            {isBackendConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5" />
                <span>API Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>API Offline</span>
              </>
            )}
          </div>

          {/* Quick Settings Icon */}
          <button
            onClick={onOpenSettings}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg border border-dark-border transition-all duration-300"
            title="Open Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}
