import React, { useRef, useEffect, useState } from "react";
import { X, Tv, Monitor, Sparkles, AlertCircle, GripVertical } from "lucide-react";
import { motion } from "motion/react";
import Visualizer from "./Visualizer";

interface ScreenSharePiPProps {
  stream: MediaStream;
  onStop: () => void;
  onSendFrame: (base64Data: string) => void;
  appState: "idle" | "listening" | "processing" | "speaking";
}

export default function ScreenSharePiP({ stream, onStop, onSendFrame, appState }: ScreenSharePiPProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [frameCount, setFrameCount] = useState(0);

  // Bind stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Handle meta loaded
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDimensions({
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight,
      });
    }
  };

  // Capture frame loop (1 FPS)
  useEffect(() => {
    if (!stream) return;

    let flashTimeout: NodeJS.Timeout;

    const intervalId = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused || video.ended) return;

      let canvas = canvasRef.current;
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvasRef.current = canvas;
      }

      if (video.videoWidth > 0 && video.videoHeight > 0) {
        // Resizing to 640px wide keeps processing light and fits Gemini API requirements perfectly
        const targetWidth = 640;
        const targetHeight = Math.round((targetWidth / video.videoWidth) * video.videoHeight);

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
          try {
            const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
            const base64Data = dataUrl.split(",")[1];
            if (base64Data) {
              onSendFrame(base64Data);
              setFrameCount((prev) => prev + 1);

              // Trigger transmission flash indicator
              setIsTransmitting(true);
              clearTimeout(flashTimeout);
              flashTimeout = setTimeout(() => setIsTransmitting(false), 200);
            }
          } catch (err) {
            console.error("Failed to capture frame in PiP:", err);
          }
        }
      }
    }, 1000); // 1 FPS

    return () => {
      clearInterval(intervalId);
      clearTimeout(flashTimeout);
    };
  }, [stream, onSendFrame]);

  const getAmbientBorderAndShadow = () => {
    switch (appState) {
      case "listening":
        return "border-teal-500/60 shadow-[0_0_30px_rgba(139,92,246,0.35)]";
      case "processing":
        return "border-sky-500/60 shadow-[0_0_30px_rgba(56,189,248,0.35)]";
      case "speaking":
        return "border-amber-500/60 shadow-[0_0_30px_rgba(236,72,153,0.35)]";
      default:
        return "border-blue-500/30 shadow-[0_0_25px_rgba(6,182,212,0.15)]";
    }
  };

  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ opacity: 0, scale: 0.85, y: 50 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: 50 }}
      className={`fixed bottom-24 right-6 w-72 md:w-80 bg-[#070c10]/95 backdrop-blur-md rounded-[2.5rem] border-2 z-50 overflow-hidden cursor-grab active:cursor-grabbing select-none transition-all duration-500 relative group ${getAmbientBorderAndShadow()}`}
      id="zoya-pip-window"
    >
      {/* Subtle grip-handle icon—a grid of 6 small dots—using absolute positioning at top-left */}
      <div 
        className="absolute top-2 left-2 z-30 bg-[#0a141c]/90 border border-blue-500/50 rounded-md p-1 shadow-md opacity-80 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center"
        title="Grip to drag and reposition"
      >
        <div className="grid grid-cols-2 gap-[2px]">
          <span className="w-[3px] h-[3px] rounded-full bg-blue-400" />
          <span className="w-[3px] h-[3px] rounded-full bg-blue-400" />
          <span className="w-[3px] h-[3px] rounded-full bg-blue-400/60" />
          <span className="w-[3px] h-[3px] rounded-full bg-blue-400" />
          <span className="w-[3px] h-[3px] rounded-full bg-blue-400" />
          <span className="w-[3px] h-[3px] rounded-full bg-blue-400/60" />
        </div>
      </div>

      {/* HUD Header / Drag Handle */}
      <div className="flex items-center justify-between px-3 py-2.5 pl-8 bg-[#0a141c] border-b border-white/5">
        <div className="flex items-center gap-2.5">
          {/* Tactile Textured Grab Handle Cue */}
          <div 
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-blue-950/40 border border-blue-500/30 text-blue-400 hover:text-blue-300 hover:bg-blue-950/65 hover:border-blue-400/50 transition-all cursor-grab active:cursor-grabbing"
            title="Grip & Drag to reposition"
          >
            {/* Knurled Dot Grid & Parallel Line Texture */}
            <div className="flex gap-1.5 items-center">
              {/* 3x3 Grid of Dots */}
              <div className="grid grid-cols-2 gap-[2px]">
                <div className="w-[3px] h-[3px] rounded-full bg-blue-400/80" />
                <div className="w-[3px] h-[3px] rounded-full bg-blue-400/80" />
                <div className="w-[3px] h-[3px] rounded-full bg-blue-400/30" />
                <div className="w-[3px] h-[3px] rounded-full bg-blue-400/80" />
                <div className="w-[3px] h-[3px] rounded-full bg-blue-400/80" />
                <div className="w-[3px] h-[3px] rounded-full bg-blue-400/30" />
              </div>
              {/* Parallel Ridges */}
              <div className="flex gap-[2px] h-3.5 items-center">
                <span className="w-[1.5px] h-full bg-blue-400/75 rounded-full" />
                <span className="w-[1.5px] h-full bg-blue-400/40 rounded-full animate-pulse" />
                <span className="w-[1.5px] h-full bg-blue-400/75 rounded-full" />
              </div>
            </div>
            <GripVertical size={13} className="opacity-80" />
            <span className="text-[10px] font-mono font-bold tracking-widest text-blue-400/90 uppercase">GRIP</span>
          </div>
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </div>
          <span className="text-xs font-mono tracking-wider text-blue-400 uppercase font-semibold">
            ZOYA'S VISION • LIVE
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-white/40">
            {dimensions.width > 0 ? `${dimensions.width}x${dimensions.height}` : "Detecting..."}
          </span>
          <button
            onClick={onStop}
            className="p-1 rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
            title="Stop Screen Sharing"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Video Preview Frame */}
      <div className="relative aspect-video bg-[#070c10] flex items-center justify-center p-2 overflow-hidden">
        {/* Minimized Ambient Glow Visualizer in Background */}
        <div className="absolute inset-0 z-0">
          <Visualizer state={appState} minimized />
        </div>

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={handleLoadedMetadata}
          className="w-full h-full object-cover rounded-xl border border-white/5 relative z-10 shadow-lg"
        />

        {/* HUD Scanline overlay */}
        <div className="absolute inset-0 bg-scanlines pointer-events-none opacity-10 z-15 rounded-xl" />

        {/* Glowing Indicator for active sync */}
        <div className="absolute top-4 left-4 px-2 py-0.5 rounded-md bg-black/75 border border-white/10 text-[9px] font-mono text-blue-300 flex items-center gap-1.5 backdrop-blur-sm z-20 shadow-md">
          <div className={`h-1.5 w-1.5 rounded-full ${isTransmitting ? "bg-teal-400 animate-pulse" : "bg-blue-400"}`} />
          {frameCount} FRAMES SENT
        </div>

        <div className="absolute bottom-4 right-4 px-2 py-0.5 rounded-md bg-black/75 border border-white/10 text-[9px] font-mono text-teal-300 flex items-center gap-1.5 backdrop-blur-sm z-20 shadow-md">
          1 FPS RATE
        </div>
      </div>

      {/* Instructions Overlay hint */}
      <div className="px-4 py-2 bg-[#05090d] text-center flex items-center justify-center gap-1.5 text-[10px] font-mono text-white/40 border-t border-white/5">
        <Monitor size={10} className="text-blue-400/70" />
        <span>Drag anywhere to reposition preview</span>
      </div>
    </motion.div>
  );
}
