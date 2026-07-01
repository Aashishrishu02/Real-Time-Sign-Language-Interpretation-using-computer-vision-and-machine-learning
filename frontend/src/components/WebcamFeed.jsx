import React, { useRef, useEffect, useState } from "react";
import { Camera, CameraOff, Loader2, Sparkles } from "lucide-react";

export default function WebcamFeed({ onLandmarksDetected, isActive = true, showLandmarks = true }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [cameraError, setCameraError] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  
  // Keep refs for MediaPipe objects to clean them up properly
  const cameraRef = useRef(null);
  const handsRef = useRef(null);

  useEffect(() => {
    if (!isActive) {
      stopCamera();
      return;
    }

    // Initialize MediaPipe Hands
    const initMediaPipe = () => {
      try {
        if (!window.Hands || !window.Camera) {
          console.log("Waiting for MediaPipe script CDNs to load...");
          setTimeout(initMediaPipe, 500);
          return;
        }

        const hands = new window.Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`,
        });

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });

        hands.onResults(onResults);
        handsRef.current = hands;
        setIsModelLoading(false);
        startCamera();
      } catch (err) {
        console.error("Failed to initialize MediaPipe Hands:", err);
        setCameraError("Failed to initialize AI tracking models.");
        setIsModelLoading(false);
      }
    };

    initMediaPipe();

    return () => {
      stopCamera();
    };
  }, [isActive]);

  const startCamera = async () => {
    setCameraError(null);
    if (!videoRef.current || !handsRef.current) return;

    try {
      // Check for webcam permissions
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Stop the test stream
      stream.getTracks().forEach((track) => track.stop());

      const camera = new window.Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current && handsRef.current) {
            await handsRef.current.send({ image: videoRef.current });
          }
        },
        width: 640,
        height: 480,
      });

      cameraRef.current = camera;
      await camera.start();
      setIsCameraActive(true);
    } catch (err) {
      console.error("Error starting camera:", err);
      setCameraError("Camera access denied or device busy. Please check permissions.");
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (cameraRef.current) {
      try {
        cameraRef.current.stop();
      } catch (e) {
        console.error("Error stopping camera helper:", e);
      }
      cameraRef.current = null;
    }
    
    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    
    setIsCameraActive(false);
  };

  const onResults = (results) => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    
    // Set matching dimensions
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // If hands are detected
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      // Map all hands to flat coordinate arrays (63 floats each)
      const handsList = results.multiHandLandmarks.map((handLandmarks) => {
        const flatLandmarks = [];
        for (let i = 0; i < 21; i++) {
          const pt = handLandmarks[i];
          flatLandmarks.push(pt.x, pt.y, pt.z);
        }
        return flatLandmarks;
      });
      
      // Send list of landmarks to page callback
      onLandmarksDetected(handsList);

      // Draw hand skeletal connections if enabled
      if (showLandmarks && window.drawConnectors && window.drawLandmarks) {
        results.multiHandLandmarks.forEach((handLandmarks, index) => {
          // Color coding: primary hand in brand Indigo, secondary hand in pink
          const colorBones = index === 0 ? "#818cf8" : "#ec4899";
          const colorJoints = index === 0 ? "#e0e7ff" : "#fdf2f8";

          // Draw bones
          window.drawConnectors(ctx, handLandmarks, window.HAND_CONNECTIONS, {
            color: colorBones,
            lineWidth: 4,
          });
          
          // Draw joints
          window.drawLandmarks(ctx, handLandmarks, {
            color: colorJoints,
            lineWidth: 2,
            radius: 5,
          });
        });
      }
    } else {
      // Send null if no hand is visible in the frame
      onLandmarksDetected(null);
    }
    ctx.restore();
  };

  return (
    <div className="relative w-full rounded-2xl border border-dark-border bg-dark-card overflow-hidden shadow-glass">
      
      {/* Loading Overlay */}
      {isModelLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-dark-bg/90 z-20 gap-3">
          <Loader2 className="w-10 h-10 text-brand-400 animate-spin" />
          <span className="text-sm text-slate-400 font-semibold tracking-wide flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-brand-300 animate-bounce" />
            Loading AI Vision Models...
          </span>
        </div>
      )}

      {/* Error Overlay */}
      {cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-rose-950/20 backdrop-blur-sm z-25 text-center px-6 py-4">
          <CameraOff className="w-12 h-12 text-rose-400 mb-3" />
          <h4 className="text-lg font-bold text-rose-200 mb-1">Webcam Connection Error</h4>
          <p className="text-sm text-rose-300/80 max-w-sm">{cameraError}</p>
          <button
            onClick={startCamera}
            className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition-all duration-300"
          >
            Retry Camera Access
          </button>
        </div>
      )}

      {/* Webcam Feed Frame */}
      <div className="relative aspect-video w-full">
        {/* Hidden video element used as image source for MediaPipe */}
        <video
          ref={videoRef}
          className="hidden"
          playsInline
          muted
        />
        
        {/* Visualized canvas feed */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
        />

        {/* Video feed backdrop (when camera is starting/loading) */}
        {!isCameraActive && !cameraError && !isModelLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 gap-2">
            <Camera className="w-10 h-10 text-slate-500" />
            <span className="text-xs text-slate-400">Camera is Offline</span>
          </div>
        )}
      </div>

      {/* Camera status bottom bar */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-dark-border bg-slate-950/40 text-xs">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isCameraActive ? "bg-emerald-500" : "bg-slate-600"}`} />
          <span className="text-slate-400 font-medium">
            {isCameraActive ? "Webcam Active (Tracking Hands)" : "Webcam Disabled"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={isCameraActive ? stopCamera : startCamera}
            className={`px-3 py-1 rounded-md font-semibold transition-all duration-300 ${
              isCameraActive 
                ? "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20"
                : "bg-brand-500 text-white hover:bg-brand-600"
            }`}
          >
            {isCameraActive ? "Disable Camera" : "Enable Camera"}
          </button>
        </div>
      </div>
    </div>
  );
}
