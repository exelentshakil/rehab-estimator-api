"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { UploadCloud, AlertTriangle, AlertCircle, X, Loader2, Home, Activity, Map, Ruler, Bed, Bath, ArrowRight, ActivityIcon, CheckCircle2, Search, Cpu, Sparkles, Building2, Coins } from "lucide-react";
import { cn, usd } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import Link from "next/link";
import { DemoVideo } from "@/components/DemoVideo";

interface Health {
  vision_provider: string;
  vision_live: boolean;
  queue: string;
  storage: string;
  costbook: { version: string; items: number };
}

interface Photo {
  id: string;
  data: string;
  preview: string;
}

const REGIONS = [
  "US-NATIONAL", "OH-AKRON", "OH-CLEVELAND", "TX-DALLAS", "TX-HOUSTON", "FL-TAMPA",
  "FL-MIAMI", "GA-ATLANTA", "IL-CHICAGO", "AZ-PHOENIX", "NC-CHARLOTTE", "PA-PHILADELPHIA",
  "NY-NYC", "CA-LA", "CA-SF", "WA-SEATTLE", "CO-DENVER", "MI-DETROIT", "MO-STLOUIS",
  "IN-INDIANAPOLIS", "TN-MEMPHIS", "AL-BIRMINGHAM",
];

async function downscale(file: File, max = 1280): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

export default function Page() {
  const [health, setHealth] = useState<Health | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);
  
  // Animation states for the result section
  const [analyzingStep, setAnalyzingStep] = useState(0); // 0: off, 1: uploading, 2: vision, 3: pricing, 4: complete
  const [showResults, setShowResults] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    address: "812 Kingsley Ave, Akron, OH 44305",
    square_feet: 1640,
    beds: 3,
    baths: 2,
    region_code: "OH-AKRON",
  });

  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => {});
  }, []);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = [...files].filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setError("");
    const next: Photo[] = [];
    for (const f of list.slice(0, 50)) {
      try {
        const data = await downscale(f);
        next.push({ id: `p${Date.now().toString(36)}${next.length}`, data, preview: data });
      } catch {
        /* skip unreadable file */
      }
    }
    setPhotos((prev) => [...prev, ...next].slice(0, 50));
  }, []);

  async function submit() {
    if (photos.length < 5) {
      setError("At least 5 photos are required — below that the coverage penalty makes the estimate untrustworthy.");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    setShowResults(false);
    
    // Start animation sequence
    setAnalyzingStep(1);
    setStatus("Uploading property assets...");

    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property: {
            address: form.address,
            square_feet: Number(form.square_feet),
            beds: Number(form.beds),
            baths: Number(form.baths),
            region_code: form.region_code,
          },
          photos: photos.map((p) => ({ id: p.id, data: p.data })),
        }),
      });

      const body = await res.json();

      if (res.status === 202 && body.job_id) {
        setAnalyzingStep(2);
        for (let i = 0; i < 200; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const jr = await fetch(`/api/jobs/${body.job_id}`);
          const jb = await jr.json();
          
          if (jb.status === "complete" || jb.repairs) {
            setAnalyzingStep(3);
            setStatus("Generating deterministic cost estimate...");
            
            // Artificial delay to show off the UI animation
            await new Promise(r => setTimeout(r, 1500));
            
            setAnalyzingStep(4);
            setResult(jb);
            setStatus("");
            setBusy(false);
            
            // Stagger the result mounting animation
            setTimeout(() => setShowResults(true), 100);
            return;
          }
          if (jb.status === "failed") throw new Error(jb.error || "job failed");
          
          const analyzed = jb.progress?.analyzed ?? 0;
          const total = jb.progress?.total ?? photos.length;
          setStatus(`Running vision model... ${analyzed}/${total} photos analyzed`);
          
          if (analyzed > 0) setAnalyzingStep(2);
        }
        throw new Error("timed out waiting for the job");
      }

      if (!res.ok) throw new Error(body.message || body.error || `HTTP ${res.status}`);
      
      setAnalyzingStep(3);
      await new Promise(r => setTimeout(r, 1500));
      
      setResult(body);
      setAnalyzingStep(4);
      setStatus("");
      setBusy(false);
      setTimeout(() => setShowResults(true), 100);
    } catch (e: any) {
      setError(e?.message ?? "Request failed");
      setStatus("");
      setAnalyzingStep(0);
      setBusy(false);
    }
  }

  const est = result?.estimate;

  return (
    <div className="min-h-screen bg-bg text-text selection:bg-accent/30 font-sans pb-24 transition-colors duration-300">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-line bg-bg/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-accent/10 flex items-center justify-center border border-accent/20 shadow-sm shadow-accent/10">
              <Building2 className="size-4 text-accent" />
            </div>
            <span className="font-semibold tracking-tight text-lg">RehabEstimator</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn("px-2.5 py-1 text-xs font-mono rounded-full border flex items-center gap-1.5 shadow-sm", 
              health?.vision_live ? "bg-good/10 text-good border-good/20 shadow-good/5" : "bg-warn/10 text-warn border-warn/20 shadow-warn/5"
            )}>
              <span className={cn("size-1.5 rounded-full", health?.vision_live ? "bg-good" : "bg-warn animate-pulse")} />
              {health?.vision_provider ?? "Connecting..."}
            </span>
            <div className="h-4 w-px bg-line" />
            <Link 
              href="/traffic" 
              className="text-muted hover:text-accent transition-colors flex items-center gap-1.5 text-sm font-medium mr-2"
              title="View Live Traffic"
            >
              <ActivityIcon className="size-4" />
              <span className="hidden sm:inline">Analytics</span>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Video Hero */}
        {!result && !busy && (
          <div className="mb-20 text-center animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium border border-accent/20 mb-6">
              <Sparkles className="size-4" />
              <span>AI Vision + Deterministic Pricing</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Instant Rehab Estimates<br/>From Property Photos
            </h1>
            <p className="text-muted text-lg max-w-2xl mx-auto mb-8">
              Upload your photos. The vision model scores the condition using a closed vocabulary. 
              The pricing engine outputs a regional cost estimate. 
            </p>
            <DemoVideo />
          </div>
        )}

        <div className="grid lg:grid-cols-[1fr_400px] gap-8">
          
          <div className="space-y-6">
            {/* Photos Upload */}
            <section className="bg-panel rounded-2xl border border-line p-6 shadow-sm relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-base font-semibold text-text flex items-center gap-2">
                      <UploadCloud className="size-4 text-accent" />
                      Property Photos
                    </h2>
                    <p className="text-sm text-muted">Include exterior, kitchen, baths, and bedrooms</p>
                  </div>
                  <div className="text-xs font-mono text-muted bg-panel-2 px-3 py-1.5 rounded-full border border-line shadow-inner">
                    {photos.length} / 50 
                  </div>
                </div>

                <div
                  className={cn(
                    "border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer",
                    over ? "border-accent bg-accent/5 scale-[1.02]" : "border-line hover:border-accent/50 hover:bg-panel-2",
                    photos.length === 0 ? "py-20" : "py-10"
                  )}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                  onDragLeave={() => setOver(false)}
                  onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}
                >
                  <div className="size-14 bg-panel-2 border border-line shadow-sm rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:border-accent/30 transition-transform">
                    <UploadCloud className="size-6 text-muted group-hover:text-accent transition-colors" />
                  </div>
                  <div className="text-sm font-medium">Click to browse or drag photos here</div>
                  <div className="text-xs text-muted mt-1.5">PNG, JPG up to 10MB each (resized client-side)</div>
                </div>
                <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && addFiles(e.target.files)} />

                {photos.length > 0 && (
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3 mt-6 animate-in fade-in zoom-in duration-300">
                    {photos.map((p) => (
                      <div className="relative aspect-square rounded-lg overflow-hidden border border-line shadow-sm hover:shadow-md transition-shadow group/img" key={p.id}>
                        <img src={p.preview} alt="" className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-500" />
                        <button 
                          onClick={(e) => { e.stopPropagation(); setPhotos((x) => x.filter((y) => y.id !== p.id)); }}
                          className="absolute top-1.5 right-1.5 size-6 rounded-full bg-black/60 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity hover:bg-bad"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            {/* Property Details */}
            <section className="bg-panel rounded-2xl border border-line p-6 shadow-sm">
              <h2 className="text-base font-semibold text-text mb-6 flex items-center gap-2">
                <Map className="size-4 text-accent" />
                Property Details
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-2 block">Address</label>
                  <input 
                    value={form.address} 
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full bg-panel-2 border border-line rounded-lg py-2.5 px-4 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all text-text shadow-sm"
                  />
                </div>
                
                <div>
                  <label className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-2 block">Market Region</label>
                  <select 
                    value={form.region_code} 
                    onChange={(e) => setForm({ ...form, region_code: e.target.value })}
                    className="w-full bg-panel-2 border border-line rounded-lg py-2.5 px-4 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all appearance-none text-text shadow-sm"
                  >
                    {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-2 block">Sqft</label>
                    <div className="relative">
                      <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
                      <input 
                        type="number" 
                        value={form.square_feet}
                        onChange={(e) => setForm({ ...form, square_feet: +e.target.value })}
                        className="w-full bg-panel-2 border border-line rounded-lg py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all font-mono text-text shadow-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-2 block">Beds</label>
                      <div className="relative">
                        <Bed className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted" />
                        <input 
                          type="number" 
                          value={form.beds} 
                          onChange={(e) => setForm({ ...form, beds: +e.target.value })}
                          className="w-full bg-panel-2 border border-line rounded-lg py-2.5 pl-8 pr-2 text-sm focus:outline-none focus:border-accent transition-all font-mono text-text shadow-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-2 block">Baths</label>
                      <div className="relative">
                        <Bath className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted" />
                        <input 
                          type="number" step="0.5" 
                          value={form.baths}
                          onChange={(e) => setForm({ ...form, baths: +e.target.value })}
                          className="w-full bg-panel-2 border border-line rounded-lg py-2.5 pl-8 pr-2 text-sm focus:outline-none focus:border-accent transition-all font-mono text-text shadow-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-line">
                {error && (
                  <div className="mb-4 p-3 rounded-lg bg-bad/10 border border-bad/20 flex items-start gap-2.5 animate-in shake">
                    <AlertCircle className="size-4 text-bad mt-0.5 shrink-0" />
                    <p className="text-sm text-bad leading-tight">{error}</p>
                  </div>
                )}
                
                <button 
                  className={cn(
                    "w-full font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg",
                    busy 
                      ? "bg-panel-2 text-muted cursor-not-allowed border border-line" 
                      : "bg-accent hover:bg-accent/90 text-white shadow-accent/20 hover:shadow-accent/40"
                  )}
                  onClick={submit} 
                  disabled={busy || photos.length < 5}
                >
                  {busy ? (
                    <div className="flex items-center gap-3">
                      <div className="relative size-5">
                        <div className="absolute inset-0 rounded-full border-2 border-accent/20" />
                        <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                      </div>
                      Generating...
                    </div>
                  ) : (
                    <>
                      Run AI Engine
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </button>
                {photos.length > 0 && !busy && (
                  <button 
                    className="w-full mt-3 py-2 text-sm text-muted hover:text-text transition-colors"
                    onClick={() => { setPhotos([]); setResult(null); }}
                  >
                    Clear everything
                  </button>
                )}
              </div>
            </section>
          </div>
        </div>

        {/* Loading State Animation */}
        {busy && (
          <div className="mt-12 p-8 bg-panel border border-line rounded-2xl shadow-xl animate-in fade-in slide-in-from-bottom-8 duration-500 max-w-2xl mx-auto">
            <h3 className="text-lg font-semibold mb-6 text-center">Engine Running</h3>
            
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className={cn("size-8 rounded-full flex items-center justify-center border-2 transition-colors duration-500", analyzingStep >= 1 ? "bg-accent/20 border-accent text-accent" : "border-line text-muted")}>
                  {analyzingStep > 1 ? <CheckCircle2 className="size-5" /> : <UploadCloud className="size-4" />}
                </div>
                <div className="flex-1">
                  <div className={cn("text-sm font-medium transition-colors duration-500", analyzingStep >= 1 ? "text-text" : "text-muted")}>Uploading Assets</div>
                  {analyzingStep === 1 && <div className="text-xs text-muted mt-1 font-mono">{status}</div>}
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className={cn("size-8 rounded-full flex items-center justify-center border-2 transition-colors duration-500", analyzingStep >= 2 ? "bg-accent/20 border-accent text-accent" : "border-line text-muted")}>
                  {analyzingStep > 2 ? <CheckCircle2 className="size-5" /> : analyzingStep === 2 ? <Search className="size-4 animate-pulse" /> : <Search className="size-4" />}
                </div>
                <div className="flex-1">
                  <div className={cn("text-sm font-medium transition-colors duration-500", analyzingStep >= 2 ? "text-text" : "text-muted")}>Vision Model Scoring</div>
                  {analyzingStep === 2 && <div className="text-xs text-muted mt-1 font-mono">{status}</div>}
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className={cn("size-8 rounded-full flex items-center justify-center border-2 transition-colors duration-500", analyzingStep >= 3 ? "bg-accent/20 border-accent text-accent" : "border-line text-muted")}>
                  {analyzingStep > 3 ? <CheckCircle2 className="size-5" /> : analyzingStep === 3 ? <Cpu className="size-4 animate-pulse" /> : <Cpu className="size-4" />}
                </div>
                <div className="flex-1">
                  <div className={cn("text-sm font-medium transition-colors duration-500", analyzingStep >= 3 ? "text-text" : "text-muted")}>Deterministic Pricing</div>
                  {analyzingStep === 3 && <div className="text-xs text-muted mt-1 font-mono">{status}</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results Section */}
        {result && showResults && (
          <div className="mt-12 space-y-8 animate-in fade-in slide-in-from-bottom-12 duration-700 ease-out">
            <div className="grid lg:grid-cols-[1fr_300px] gap-8">
              
              {/* Primary Metrics */}
              <section className="bg-panel rounded-2xl border border-line p-8 shadow-xl shadow-accent/5 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-50" />
                <div className="relative">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <Sparkles className="size-5 text-accent" />
                      Final Estimate
                    </h2>
                    <div className="flex gap-2">
                      <span className="px-2.5 py-1 text-[11px] font-mono rounded-full bg-panel-2 border border-line text-muted shadow-inner">
                        CostBook v{result.costbook_version}
                      </span>
                      <span className="px-2.5 py-1 text-[11px] font-mono rounded-full bg-panel-2 border border-line text-muted flex items-center gap-1.5 shadow-inner">
                        <Activity className="size-3 text-accent" />
                        {result.model?.provider}/{result.model?.model}
                      </span>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-12 items-center">
                    <div className="flex flex-col justify-center items-center p-6 bg-panel-2/80 backdrop-blur rounded-2xl border border-line/50 shadow-inner">
                      <div className="relative group">
                        <svg className="w-36 h-36 transform -rotate-90 drop-shadow-md">
                          <circle cx="72" cy="72" r="64" className="stroke-line" strokeWidth="12" fill="none" />
                          <circle 
                            cx="72" cy="72" r="64" 
                            strokeWidth="12" fill="none"
                            strokeLinecap="round"
                            className={cn(
                              "transition-all duration-[2000ms] ease-out drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]",
                              result.condition.overall_score >= 70 ? "stroke-good" : 
                              result.condition.overall_score >= 45 ? "stroke-warn" : "stroke-bad"
                            )}
                            strokeDasharray={2 * Math.PI * 64}
                            strokeDashoffset={2 * Math.PI * 64 * (1 - result.condition.overall_score / 100)}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-5xl font-bold font-mono tracking-tighter text-text">
                            {result.condition.overall_score}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs font-semibold text-muted mt-5 uppercase tracking-widest">Condition Score</div>
                      <div className="text-[11px] text-muted mt-1 font-mono bg-panel border border-line px-2 py-0.5 rounded shadow-sm">
                        Conf: {Math.round(result.condition.confidence * 100)}%
                      </div>
                    </div>

                    <div className="flex flex-col justify-center">
                      <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-2 flex items-center gap-2">
                        <Coins className="size-4 text-accent" />
                        Expected Rehab
                      </div>
                      <div className="text-5xl lg:text-6xl font-bold font-mono tracking-tight mb-8 text-text drop-shadow-sm">
                        {usd(est.expected)}
                      </div>
                      
                      <div className="space-y-2">
                        <div className="h-3 rounded-full bg-panel-2 relative overflow-hidden flex shadow-inner border border-line/50">
                          <div 
                            className="absolute top-0 bottom-0 bg-gradient-to-r from-accent/60 to-accent rounded-full transition-all duration-[1500ms] ease-out delay-500"
                            style={{ 
                              left: `${((est.low - (est.low * 0.9)) / ((est.high * 1.1) - (est.low * 0.9))) * 100}%`,
                              width: `${((est.high - est.low) / ((est.high * 1.1) - (est.low * 0.9))) * 100}%` 
                            }}
                          />
                          <div 
                            className="absolute top-0 bottom-0 w-1.5 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)] z-10 transition-all duration-[1500ms] ease-out delay-500"
                            style={{ left: `${((est.expected - (est.low * 0.9)) / ((est.high * 1.1) - (est.low * 0.9))) * 100}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs font-mono text-muted font-medium">
                          <span>{usd(est.low)}</span>
                          <span>{usd(est.high)}</span>
                        </div>
                      </div>
                      
                      <div className="mt-6 pt-4 border-t border-line/50 grid grid-cols-2 gap-4">
                        <div className="bg-panel-2/50 p-3 rounded-lg border border-line/50">
                          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-1">Market</div>
                          <div className="text-sm font-mono text-text">{result.estimate.region_code} × {result.estimate.region_multiplier}</div>
                        </div>
                        <div className="bg-panel-2/50 p-3 rounded-lg border border-line/50">
                          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-1">Contingency</div>
                          <div className="text-sm font-mono text-text">+{Math.round(result.estimate.contingency_pct * 100)}%</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {result.warnings?.length > 0 && (
                    <div className="mt-8 bg-warn/10 border border-warn/30 rounded-xl p-5 shadow-sm">
                      <div className="flex items-center gap-2 text-warn font-semibold mb-3">
                        <AlertTriangle className="size-5" />
                        Warnings
                      </div>
                      <ul className="space-y-2">
                        {result.warnings.map((w: string, i: number) => (
                          <li key={i} className="text-sm text-warn/90 flex gap-2">
                            <span className="opacity-50 mt-1">•</span> {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>

              {/* Component Breakdowns */}
              <section className="bg-panel rounded-2xl border border-line p-6 shadow-sm flex flex-col hover:shadow-md transition-shadow">
                <h2 className="text-base font-semibold mb-1">Component Analysis</h2>
                <p className="text-[11px] text-muted mb-6 uppercase tracking-wider font-semibold">Scale: 0 (replace) to 5 (new)</p>
                
                <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                  {result.condition.components.map((c: any, idx: number) => (
                    <div key={c.component} className="animate-in slide-in-from-right-4 fade-in fill-mode-both" style={{ animationDelay: `${idx * 50}ms`, animationDuration: '500ms' }}>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="capitalize font-medium text-text/90">{c.component.replace("_", " ")}</span>
                        <span className="font-mono text-muted text-xs bg-panel-2 px-1.5 py-0.5 rounded border border-line">
                          <span className={cn(
                            "font-bold",
                            c.score >= 3.5 ? "text-good" : c.score >= 2 ? "text-warn" : "text-bad"
                          )}>{c.score.toFixed(1)}</span>
                          <span className="opacity-50">/5</span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-panel-2 overflow-hidden shadow-inner border border-line/30">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all duration-1000 ease-out",
                            c.score >= 3.5 ? "bg-good" : c.score >= 2 ? "bg-warn" : "bg-bad"
                          )}
                          style={{ width: `${(c.score / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Coverage Gaps */}
            {result.coverage.missing.length > 0 && (
              <section className="bg-panel rounded-2xl border border-line p-6 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 fill-mode-both">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-base font-semibold text-text">Coverage Gaps</h2>
                    <p className="text-sm text-muted mt-1">
                      {result.coverage.photos_analyzed} photos analyzed · coverage score {Math.round(result.coverage.score * 100)}%
                    </p>
                  </div>
                </div>
                
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {result.coverage.missing.map((g: any, i: number) => (
                    <div className="p-4 rounded-xl bg-panel-2 border border-line hover:border-line/80 transition-colors" key={i}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={cn(
                          "px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded font-bold shadow-sm",
                          g.severity === 'critical' ? "bg-bad/20 text-bad border border-bad/30" : "bg-warn/20 text-warn border border-warn/30"
                        )}>
                          {g.severity}
                        </span>
                        <strong className="capitalize text-sm">{g.component.replace("_", " ")}</strong>
                      </div>
                      <p className="text-sm text-muted leading-relaxed">{g.impact}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Line Items */}
            <section className="bg-panel rounded-2xl border border-line shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500 fill-mode-both">
              <div className="p-6 border-b border-line bg-panel-2/30">
                <h2 className="text-base font-semibold">Repair Line Items</h2>
                <p className="text-sm text-muted mt-1">Transparent pricing tied directly to cost book items and measured quantities.</p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-[11px] font-semibold uppercase tracking-widest text-muted bg-panel-2 border-b border-line">
                    <tr>
                      <th className="px-6 py-4">Item & Basis</th>
                      <th className="px-6 py-4 text-right">Quantity</th>
                      <th className="px-6 py-4 text-right">Unit Cost</th>
                      <th className="px-6 py-4 text-right hidden sm:table-cell">Low</th>
                      <th className="px-6 py-4 text-right">Expected</th>
                      <th className="px-6 py-4 text-right hidden md:table-cell">High</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/50">
                    {result.repairs.map((r: any) => (
                      <tr key={r.cost_item_id} className="hover:bg-panel-2/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="font-medium text-text group-hover:text-accent transition-colors">{r.label}</div>
                          <div className="text-xs font-mono text-muted mt-1 opacity-70">
                            <span className="bg-line/50 px-1 py-0.5 rounded mr-1">{r.cost_item_id}</span>
                            {r.driving_defects.join(", ")}
                          </div>
                          <div className="text-xs text-muted mt-2 border-l-2 border-accent/30 pl-3 py-0.5 italic">
                            {r.basis}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-mono whitespace-nowrap">
                          {r.quantity} {r.unit}
                        </td>
                        <td className="px-6 py-4 text-right font-mono whitespace-nowrap text-muted">
                          {usd(r.unit_cost_expected)}
                        </td>
                        <td className="px-6 py-4 text-right font-mono whitespace-nowrap text-muted hidden sm:table-cell">
                          {usd(r.low)}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold whitespace-nowrap text-text">
                          {usd(r.expected)}
                        </td>
                        <td className="px-6 py-4 text-right font-mono whitespace-nowrap text-muted hidden md:table-cell">
                          {usd(r.high)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-panel-2 border-t border-line font-medium">
                    <tr>
                      <td className="px-6 py-5">
                        <div className="font-semibold">Subtotal (National Base)</div>
                        <div className="text-xs text-muted font-normal mt-1">Before region multiplier and contingency</div>
                      </td>
                      <td className="px-6 py-5"></td>
                      <td className="px-6 py-5"></td>
                      <td className="px-6 py-5 text-right font-mono text-muted hidden sm:table-cell">{usd(est.subtotal_low)}</td>
                      <td className="px-6 py-5 text-right font-mono text-xl text-accent">{usd(est.subtotal_expected)}</td>
                      <td className="px-6 py-5 text-right font-mono text-muted hidden md:table-cell">{usd(est.subtotal_high)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
