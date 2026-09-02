"use client";

import { Play, Pause, Maximize2 } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function DemoVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div 
      className="relative rounded-2xl overflow-hidden border border-line bg-panel shadow-2xl group max-w-4xl mx-auto my-12"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Browser Chrome Header */}
      <div className="h-10 bg-panel-2 border-b border-line flex items-center px-4 gap-2">
        <div className="flex gap-1.5">
          <div className="size-3 rounded-full bg-[#ff5f56]" />
          <div className="size-3 rounded-full bg-[#ffbd2e]" />
          <div className="size-3 rounded-full bg-[#27c93f]" />
        </div>
        <div className="mx-auto bg-panel border border-line rounded text-[11px] px-24 py-1 text-muted font-mono flex items-center gap-2">
          <span className="size-2 rounded-sm bg-accent/50" />
          rehab-estimator-api.vercel.app
        </div>
      </div>

      <div className="relative aspect-video bg-black cursor-pointer" onClick={togglePlay}>
        <video 
          ref={videoRef}
          src="/assets/demo.webm" 
          className="w-full h-full object-cover opacity-90 transition-opacity duration-500"
          autoPlay
          muted
          loop
          playsInline
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
        
        {/* Play Button Overlay */}
        <div className={cn(
          "absolute inset-0 flex items-center justify-center transition-all duration-300 bg-black/20 backdrop-blur-[1px]",
          isPlaying ? "opacity-0 scale-110 pointer-events-none" : "opacity-100 scale-100"
        )}>
          <div className="size-16 rounded-full bg-accent text-white flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.4)]">
            <Play className="size-6 ml-1" fill="currentColor" />
          </div>
        </div>

        {/* Gradient Overlay bottom for smooth fade */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}
