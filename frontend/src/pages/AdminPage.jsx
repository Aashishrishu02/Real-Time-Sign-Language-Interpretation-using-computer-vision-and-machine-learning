import React, { useState, useEffect } from "react";
import { Play, Upload, Check, Loader2, Sparkles, TrendingUp, Shield, HelpCircle, FileDown, AlertTriangle } from "lucide-react";
import { API_URL } from "../config";

export default function AdminPage({ isBackendConnected }) {
  const [isTraining, setIsTraining] = useState(false);
  const [activeModel, setActiveModel] = useState(null);
  const [modelList, setModelList] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [accuracy, setAccuracy] = useState(0);
  const [precision, setPrecision] = useState(0);
  const [recall, setRecall] = useState(0);
  const [confusionMatrix, setConfusionMatrix] = useState([]);
  const [matrixLabels, setMatrixLabels] = useState([]);

  useEffect(() => {
    fetchActiveModel();
    fetchModelList();
  }, []);

  const getLabelsForSize = (size) => {
    const default10 = ["Bad", "Food", "Good", "Hello", "Help", "No", "Stop", "Thank You", "Water", "Yes"];
    const default11 = ["Bad", "Food", "Good", "Hello", "Help", "Neutral", "No", "Stop", "Thank You", "Water", "Yes"];
    if (size === 11) return default11;
    return default10;
  };

  const fetchActiveModel = async () => {
    try {
      const res = await fetch(`${API_URL}/api/model/active`);
      if (res.ok) {
        const data = await res.json();
        setActiveModel(data);
        setAccuracy(data.accuracy);
        setPrecision(data.precision);
        setRecall(data.recall);
        setConfusionMatrix(data.confusion_matrix);
        
        const size = data.confusion_matrix ? data.confusion_matrix.length : 10;
        setMatrixLabels(getLabelsForSize(size));
      }
    } catch (e) {
      console.error("Error fetching active model:", e);
    }
  };

  const fetchModelList = async () => {
    try {
      const res = await fetch(`${API_URL}/api/model/list`);
      if (res.ok) {
        const data = await res.json();
        setModelList(data);
      }
    } catch (e) {
      console.error("Error fetching model list:", e);
    }
  };

  const handleTrainModel = async () => {
    if (!isBackendConnected) return;
    setIsTraining(true);
    try {
      const res = await fetch(`${API_URL}/api/model/train`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setAccuracy(data.accuracy);
        setPrecision(data.precision);
        setRecall(data.recall);
        setConfusionMatrix(data.confusion_matrix);
        setMatrixLabels(data.labels);
        
        // Refresh active model and model checkpoints
        await fetchActiveModel();
        await fetchModelList();
        
        alert(`Model trained successfully: ${data.model_name}`);
      } else {
        const err = await res.json();
        alert(`Training failed: ${err.detail || "Unknown error"}`);
      }
    } catch (e) {
      console.error("Error training model:", e);
      alert("Error connection failed during training.");
    } finally {
      setIsTraining(false);
    }
  };

  const handleActivateModel = async (modelId) => {
    try {
      const res = await fetch(`${API_URL}/api/model/activate/${modelId}`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchActiveModel();
        await fetchModelList();
      }
    } catch (e) {
      console.error("Error activating model:", e);
    }
  };

  const handleFileChange = (e) => {
    setUploadFile(e.target.files[0]);
    setUploadMessage("");
  };

  const handleUploadModel = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;

    setIsUploading(true);
    setUploadMessage("");
    const formData = new FormData();
    formData.append("file", uploadFile);

    try {
      const res = await fetch(`${API_URL}/api/model/upload`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setUploadMessage("Model weights loaded and activated successfully!");
        setUploadFile(null);
        // Clear input element
        document.getElementById("model-file-input").value = "";
        
        await fetchActiveModel();
        await fetchModelList();
      } else {
        const err = await res.json();
        setUploadMessage(`Upload failed: ${err.detail || "Error loading file"}`);
      }
    } catch (e) {
      console.error("Error uploading model:", e);
      setUploadMessage("Failed to upload model file.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-10 flex flex-col gap-8">
      
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="w-6 h-6 text-brand-400" />
          Model Training & Diagnostics
        </h1>
        <p className="text-xs text-slate-400">Evaluate classifier accuracy, compute weights, and manage deployment checkpoints</p>
      </div>

      {/* Accuracy Diagnostics Stats row */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Active Model Name card */}
        <div className="glass-panel p-5 rounded-2xl flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-brand-500/5 blur-xl rounded-full" />
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Active Weights</span>
          <span className="text-lg font-black text-white mt-1 overflow-hidden text-ellipsis whitespace-nowrap block" title={activeModel?.model_name}>
            {activeModel ? activeModel.model_name : "None (Using Heuristics)"}
          </span>
          <span className="text-[10px] text-slate-400 mt-2">
            Created: {activeModel ? new Date(activeModel.created_at).toLocaleDateString() : "N/A"}
          </span>
        </div>

        {/* Accuracy Card */}
        <div className="glass-panel p-5 rounded-2xl flex flex-col">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Accuracy Score</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-3xl font-black text-white mt-1">
            {activeModel ? `${(accuracy * 100).toFixed(1)}%` : "0.0%"}
          </span>
          <span className="text-[10px] text-emerald-400 mt-2 flex items-center gap-0.5">
            Test Set Evaluation
          </span>
        </div>

        {/* Precision Card */}
        <div className="glass-panel p-5 rounded-2xl flex flex-col">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Weighted Precision</span>
            <Sparkles className="w-4 h-4 text-brand-400" />
          </div>
          <span className="text-3xl font-black text-white mt-1">
            {activeModel ? `${(precision * 100).toFixed(1)}%` : "0.0%"}
          </span>
          <span className="text-[10px] text-slate-400 mt-2">Relevance of true results</span>
        </div>

        {/* Recall Card */}
        <div className="glass-panel p-5 rounded-2xl flex flex-col">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Weighted Recall</span>
            <HelpCircle className="w-4 h-4 text-indigo-400" />
          </div>
          <span className="text-3xl font-black text-white mt-1">
            {activeModel ? `${(recall * 100).toFixed(1)}%` : "0.0%"}
          </span>
          <span className="text-[10px] text-slate-400 mt-2">Coverage of ground truth</span>
        </div>

      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Left Columns (Training trigger and Confusion Matrix diagnostics) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Training Panel Trigger */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-6">
            <div className="flex flex-col gap-1 max-w-md">
              <h3 className="text-lg font-bold text-white">Train Classification Weights</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Fits a PyTorch LSTM Sequence Classifier on the trajectories saved in your local dataset. Validates using a 20% test-split.
              </p>
            </div>
            
            <button
              onClick={handleTrainModel}
              disabled={isTraining || !isBackendConnected}
              className="flex items-center justify-center gap-2 px-6 py-3.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-30 text-white font-bold rounded-xl shadow-glow transition-all duration-300 transform active:scale-95"
            >
              {isTraining ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Computing Model...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-white" />
                  Train Model Now
                </>
              )}
            </button>
          </div>

          {/* Confusion Matrix visualizer */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4">
            <div className="border-b border-dark-border pb-3">
              <h3 className="text-base font-bold text-white">Confusion Matrix Heatmap</h3>
              <p className="text-xs text-slate-400">Actual categories (rows) vs Predicted results (columns)</p>
            </div>

            {confusionMatrix.length > 0 ? (
              <div className="overflow-x-auto">
                <div className="min-w-[450px]">
                  {/* Column titles */}
                  <div 
                    className="grid text-center font-bold text-[10px] text-slate-500 mb-1 border-b border-white/5 pb-1"
                    style={{ gridTemplateColumns: `repeat(${matrixLabels.length + 1}, minmax(0, 1fr))` }}
                  >
                    <div></div>
                    {matrixLabels.map((lbl) => (
                      <div key={lbl} className="truncate" title={lbl}>{lbl.slice(0, 3)}</div>
                    ))}
                  </div>
 
                  {/* Row loops */}
                  <div className="flex flex-col gap-1">
                    {confusionMatrix.map((row, rIdx) => (
                      <div 
                        key={rIdx} 
                        className="grid items-center text-center"
                        style={{ gridTemplateColumns: `repeat(${matrixLabels.length + 1}, minmax(0, 1fr))` }}
                      >
                        {/* Row title */}
                        <div className="text-left font-bold text-[10px] text-slate-500 truncate pr-1" title={matrixLabels[rIdx]}>
                          {matrixLabels[rIdx] ? matrixLabels[rIdx].slice(0, 5) : `Row ${rIdx}`}
                        </div>
                        
                        {/* Cell counts */}
                        {row.map((val, cIdx) => {
                          const isCorrect = rIdx === cIdx;
                          let bgClass = "bg-slate-950 text-slate-600";
                          if (val > 0) {
                            bgClass = isCorrect 
                              ? "bg-brand-500/20 text-brand-400 font-bold border border-brand-500/40" 
                              : "bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20";
                          }
                          return (
                            <div
                              key={cIdx}
                              className={`aspect-square flex items-center justify-center rounded text-xs transition-all duration-300 ${bgClass}`}
                              title={`Actual: ${matrixLabels[rIdx] || `Row ${rIdx}`}, Predicted: ${matrixLabels[cIdx] || `Col ${cIdx}`} (${val} times)`}
                            >
                              {val}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500 border border-dashed border-dark-border rounded-xl">
                <AlertTriangle className="w-8 h-8 mb-2 text-slate-600 animate-bounce" />
                <span className="text-xs italic">Train a model to display diagnostic confusion matrices</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (Upload custom model and active checkpoints list) */}
        <div className="flex flex-col gap-6">
          
          {/* Custom weights uploader */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4">
            <h3 className="text-sm font-bold text-slate-400 border-b border-dark-border pb-3 uppercase tracking-wider">
              Upload External Model
            </h3>
            
            <form onSubmit={handleUploadModel} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <input
                  type="file"
                  id="model-file-input"
                  accept=".pt"
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-indigo-400 hover:file:bg-slate-800 transition-all duration-300"
                />
                <p className="text-[10px] text-slate-500">Supported format: .pt PyTorch weight dictionaries</p>
              </div>

              <button
                type="submit"
                disabled={isUploading || !uploadFile}
                className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 disabled:opacity-30 text-indigo-300 font-bold rounded-xl text-xs transition-all duration-300"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    Upload & Deploy weights
                  </>
                )}
              </button>

              {uploadMessage && (
                <div className={`mt-2 text-xs p-2.5 rounded border ${
                  uploadMessage.includes("success") 
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                }`}>
                  {uploadMessage}
                </div>
              )}
            </form>
          </div>

          {/* Trained Models list checkpoints */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4 flex-1">
            <h3 className="text-sm font-bold text-slate-400 border-b border-dark-border pb-3 uppercase tracking-wider">
              Model Checkpoints
            </h3>

            <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[300px] pr-1">
              {modelList.length > 0 ? (
                modelList.map((model) => (
                  <div
                    key={model.id}
                    className={`flex flex-col p-3 rounded-xl border text-xs gap-2 transition-all duration-300 ${
                      model.is_active
                        ? "bg-brand-500/10 border-brand-500/30 shadow-sm"
                        : "bg-slate-950/40 border-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200 truncate pr-1" title={model.model_name}>
                        {model.model_name}
                      </span>
                      {model.is_active ? (
                        <span className="flex items-center gap-0.5 text-[10px] font-semibold text-brand-400 uppercase">
                          <Check className="w-3.5 h-3.5" /> Active
                        </span>
                      ) : (
                        <button
                          onClick={() => handleActivateModel(model.id)}
                          className="px-2 py-0.5 rounded bg-slate-900 border border-dark-border text-slate-400 hover:text-white transition-colors"
                        >
                          Activate
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-white/5 pt-1.5">
                      <span>Accuracy: {(model.accuracy * 100).toFixed(0)}%</span>
                      <span>{new Date(model.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              ) : (
                <span className="text-slate-500 text-xs italic text-center py-6">
                  No model checkpoints logged
                </span>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
