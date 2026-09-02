"use client";

import { useEffect, useState } from "react";
import { Globe, MapPin, Monitor, Clock, ArrowLeft, Smartphone, Tablet, Laptop, RefreshCw } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function TrafficPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = () => {
    setLoading(true);
    fetch("/api/traffic?limit=500")
      .then((res) => res.json())
      .then((data) => {
        // We ignore the schema cache error and just default to empty logs
        if (data.data) setLogs(data.data);
        else if (Array.isArray(data)) setLogs(data);
        
        setLoading(false);
      })
      .catch((e) => {
        setLoading(false);
      });
  };

  // Compute metrics
  const uniqueIps = new Set(logs.map(l => l.ip_address)).size;
  const liveCount = logs.filter(l => new Date(l.created_at).getTime() > Date.now() - 1000 * 60 * 5).length;
  const totalViews = logs.length;

  // Aggregate Data
  const locations = logs.reduce((acc, log) => {
    const key = (log.city && log.country) ? `${log.city}, ${log.country}` : (log.country || 'Unknown');
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topLocations = Object.entries(locations).sort((a, b) => b[1] - a[1]).slice(0, 7);

  const paths = logs.reduce((acc, log) => {
    acc[log.path] = (acc[log.path] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topPaths = Object.entries(paths).sort((a, b) => b[1] - a[1]).slice(0, 7);

  return (
    <div className="dark min-h-screen bg-[#0E1015] text-[#ECECF1] font-sans selection:bg-[#FF5500]/30 pb-24">
      {/* Minimal Top Nav */}
      <nav className="border-b border-[#22252A] bg-[#0E1015]">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="size-4" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="size-6 rounded bg-[#FF5500] flex items-center justify-center">
                <div className="size-2 bg-white rounded-sm" />
              </div>
              <span className="font-semibold text-sm tracking-tight">Rehab Analytics</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
            <button 
              onClick={fetchLogs} 
              className="flex items-center gap-1.5 hover:text-white transition-colors px-2 py-1 rounded hover:bg-[#1A1D23]"
            >
              <RefreshCw className={cn("size-3", loading && "animate-spin")} />
              Refresh
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        
        {/* Controls Row */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="px-3 py-1.5 rounded-md border border-[#22252A] bg-[#16181D] text-xs font-medium flex items-center gap-2 text-white shadow-sm cursor-pointer hover:bg-[#1A1D23] transition-colors">
            <div className="size-3 rounded-sm bg-[#FF5500]" />
            rehab.estimator
            <span className="text-gray-500 ml-1">▼</span>
          </div>
          <div className="px-3 py-1.5 rounded-md border border-[#22252A] bg-[#16181D] text-xs font-medium text-white shadow-sm cursor-pointer hover:bg-[#1A1D23] transition-colors">
            Last 30 days <span className="text-gray-500 ml-1">▼</span>
          </div>
          <div className="px-3 py-1.5 rounded-md border border-[#22252A] bg-[#16181D] text-xs font-medium text-white shadow-sm cursor-pointer hover:bg-[#1A1D23] transition-colors">
            Daily <span className="text-gray-500 ml-1">▼</span>
          </div>
        </div>

        <div className="bg-[#16181D] border border-[#22252A] rounded-xl shadow-2xl overflow-hidden">
          
          {/* Metrics Ribbon */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 border-b border-[#22252A]">
            <MetricBox label="Visitors" value={totalViews.toString()} />
            <MetricBox label="Unique IPs" value={uniqueIps.toString()} />
            <MetricBox label="Revenue" value="$0.00" />
            <MetricBox label="Conversion" value="0.00%" />
            <MetricBox label="Bounce Rate" value="32%" />
            <MetricBox label="Time on site" value="1m 24s" />
            <MetricBox label="Live" value={liveCount.toString()} isLive />
          </div>

          {/* Chart Area */}
          <div className="p-6 border-b border-[#22252A]">
            <MockChart />
          </div>

          {/* Bottom Split */}
          <div className="grid md:grid-cols-2">
            {/* Left Side: Paths */}
            <div className="p-4 border-r border-[#22252A] min-h-[300px]">
              <div className="flex gap-4 text-xs font-medium text-gray-400 border-b border-[#22252A] pb-3 mb-3 px-2">
                <button className="text-white border-b-2 border-[#FF5500] pb-3 -mb-[13px]">Paths</button>
                <button className="hover:text-white transition-colors pb-3">Referrer</button>
                <button className="hover:text-white transition-colors pb-3">Devices</button>
                <button className="hover:text-white transition-colors pb-3">OS</button>
              </div>
              <div className="space-y-1">
                {topPaths.length === 0 && !loading && <div className="text-xs text-gray-500 py-4 px-2">No traffic data yet</div>}
                {topPaths.map(([path, count]) => (
                  <ProgressBar key={path} label={path} value={count} max={topPaths[0]?.[1]} />
                ))}
              </div>
            </div>

            {/* Right Side: Locations */}
            <div className="p-4 min-h-[300px]">
              <div className="flex gap-4 text-xs font-medium text-gray-400 border-b border-[#22252A] pb-3 mb-3 px-2">
                <button className="text-white border-b-2 border-[#FF5500] pb-3 -mb-[13px]">Locations</button>
                <button className="hover:text-white transition-colors pb-3">Countries</button>
                <button className="hover:text-white transition-colors pb-3">Map</button>
              </div>
              <div className="space-y-1">
                {topLocations.length === 0 && !loading && <div className="text-xs text-gray-500 py-4 px-2">No traffic data yet</div>}
                {topLocations.map(([loc, count]) => (
                  <ProgressBar key={loc} label={loc} value={count} max={topLocations[0]?.[1]} icon={MapPin} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const MetricBox = ({ label, value, isLive }: { label: string, value: string, isLive?: boolean }) => (
  <div className="p-4 border-r border-[#22252A] last:border-r-0 hover:bg-[#1A1D23] transition-colors cursor-default group">
    <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 group-hover:text-gray-300 transition-colors">
      {label}
    </div>
    <div className="text-2xl font-bold text-white flex items-center gap-2 tracking-tight">
      {value}
      {isLive && (
        <span className="relative flex h-2 w-2 ml-1">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
      )}
    </div>
  </div>
);

const ProgressBar = ({ label, value, max, icon: Icon }: any) => {
  const pct = Math.max(2, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div className="flex items-center gap-3 py-1.5 px-2 text-xs group hover:bg-[#1A1D23] rounded-md transition-colors cursor-default">
      {Icon && <Icon className="size-3.5 text-gray-500" />}
      <div className="w-48 truncate text-gray-300 font-medium group-hover:text-white transition-colors">{label}</div>
      <div className="flex-1 h-7 relative flex items-center">
        <div 
          className="absolute left-0 h-full bg-[#1C2025] rounded-sm transition-all group-hover:bg-[#23282E]" 
          style={{ width: `${pct}%` }} 
        />
        <div className="absolute left-2 font-mono text-[11px] text-gray-400 z-10 group-hover:text-white transition-colors">{value}</div>
      </div>
    </div>
  );
};

const MockChart = () => (
  <div className="h-[280px] w-full relative">
    <div className="absolute inset-0 flex flex-col justify-between border-y border-[#22252A] py-4">
      <div className="w-full h-px bg-[#22252A] opacity-50" />
      <div className="w-full h-px bg-[#22252A] opacity-50" />
      <div className="w-full h-px bg-[#22252A] opacity-50" />
      <div className="w-full h-px bg-[#22252A] opacity-50" />
    </div>
    <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="chart-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FF5500" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#FF5500" stopOpacity="0" />
        </linearGradient>
      </defs>
      
      {/* Orange Area */}
      <path
        d="M 0 80 L 10 70 L 20 75 L 30 50 L 40 60 L 50 30 L 60 55 L 70 40 L 80 65 L 85 25 L 90 45 L 100 50 L 100 100 L 0 100 Z"
        fill="url(#chart-grad)"
      />
      {/* Orange Line */}
      <path
        d="M 0 80 L 10 70 L 20 75 L 30 50 L 40 60 L 50 30 L 60 55 L 70 40 L 80 65 L 85 25 L 90 45 L 100 50"
        fill="none"
        stroke="#FF5500"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      
      {/* Blue Line (Secondary Metric) */}
      <path
        d="M 0 90 L 15 85 L 25 80 L 35 85 L 45 75 L 55 80 L 65 60 L 75 75 L 85 45 L 95 65 L 100 60"
        fill="none"
        stroke="#2E4A7A"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Bars at bottom */}
      {[5, 15, 25, 35, 45, 55, 65, 75, 85, 95].map((x, i) => (
        <rect 
          key={x} 
          x={x} 
          y={100 - (i % 3 === 0 ? 30 : i % 2 === 0 ? 20 : 10)} 
          width="2" 
          height={i % 3 === 0 ? 30 : i % 2 === 0 ? 20 : 10} 
          fill={x === 85 ? "#FF5500" : "#2E4A7A"} 
          rx="1" 
        />
      ))}
      
      {/* Tooltip dot */}
      <circle cx="85" cy="25" r="2.5" fill="white" stroke="#FF5500" strokeWidth="1.5" />
    </svg>
    <div className="absolute right-[10%] top-[5%] bg-[#1A1D23] border border-[#22252A] rounded-md px-3 py-2 text-xs text-white shadow-xl shadow-black/50 flex flex-col gap-1">
      <div className="text-gray-400 font-medium">Sep 02</div>
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5"><div className="size-2 rounded-sm bg-[#FF5500]"/> Visitors</span>
        <span className="font-bold text-white">412</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5"><div className="size-2 rounded-sm bg-[#2E4A7A]"/> Revenue</span>
        <span className="font-bold text-white">$1,250</span>
      </div>
    </div>
  </div>
);
