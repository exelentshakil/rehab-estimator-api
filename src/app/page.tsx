"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { UploadCloud, AlertTriangle, AlertCircle, X, Loader2, Home, Activity, Map, Ruler, Bed, Bath, ArrowRight, ActivityIcon } from "lucide-react";
import { cn, usd } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import Link from "next/link";

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
    setStatus("Uploading and classifying photos…");

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
        for (let i = 0; i < 200; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const jr = await fetch(`/api/jobs/${body.job_id}`);
          const jb = await jr.json();
          if (jb.status === "complete" || jb.repairs) {
            setResult(jb);
            setStatus("");
            setBusy(false);
            return;
          }
          if (jb.status === "failed") throw new Error(jb.error || "job failed");
          setStatus(`${jb.status}… ${jb.progress?.analyzed ?? 0}/${jb.progress?.total ?? photos.length} photos`);
        }
        throw new Error("timed out waiting for the job");
      }

      if (!res.ok) throw new Error(body.message || body.error || `HTTP ${res.status}`);
      setResult(body);
      setStatus("");
    } catch (e: any) {
      setError(e?.message ?? "Request failed");
      setStatus("");
    } finally {
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
            <div className="size-8 rounded-lg bg-accent/10 flex items-center justify-center border border-accent/20">
              <Home className="size-4 text-accent" />
            </div>
            <span className="font-semibold tracking-tight text-lg">RehabEstimator</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn("px-2.5 py-1 text-xs font-mono rounded-full border flex items-center gap-1.5", 
              health?.vision_live ? "bg-good/10 text-good border-good/20" : "bg-warn/10 text-warn border-warn/20"
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
              <span className="hidden sm:inline">Traffic</span>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-[1fr_400px] gap-8">
          
          <div className="space-y-8">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">New Estimate</h1>
              <p className="text-muted text-sm max-w-2xl">
                Upload 5-50 photos of the property. Our vision model scores the condition using a closed vocabulary, 
                and our deterministic engine produces a regional cost estimate.
              </p>
            </div>

            {/* Photos Upload */}
            <section className="bg-panel rounded-2xl border border-line p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-base font-semibold text-text">Property Photos</h2>
                  <p className="text-sm text-muted">Include exterior, kitchen, baths, and bedrooms</p>
                </div>
                <div className="text-xs font-mono text-muted bg-panel-2 px-3 py-1.5 rounded-full border border-line">
                  {photos.length} / 50 
                </div>
              </div>

              <div
                className={cn(
                  "border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer group",
                  over ? "border-accent bg-accent/5" : "border-line hover:border-accent/50 hover:bg-panel-2",
                  photos.length === 0 ? "py-20" : "py-10"
                )}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}
              >
                <div className="size-12 bg-panel-2 border border-line rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:border-accent/30 transition-transform">
                  <UploadCloud className="size-5 text-muted group-hover:text-accent transition-colors" />
                </div>
                <div className="text-sm font-medium">Click to browse or drag photos here</div>
                <div className="text-xs text-muted mt-1">PNG, JPG up to 10MB each (resized client-side)</div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && addFiles(e.target.files)} />

              {photos.length > 0 && (
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3 mt-6">
                  {photos.map((p) => (
                    <div className="relative aspect-square rounded-lg overflow-hidden border border-line group" key={p.id}>
                      <img src={p.preview} alt="" className="w-full h-full object-cover" />
                      <button 
                        onClick={(e) => { e.stopPropagation(); setPhotos((x) => x.filter((y) => y.id !== p.id)); }}
                        className="absolute top-1.5 right-1.5 size-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="space-y-6">
            {/* Property Details */}
            <section className="bg-panel rounded-2xl border border-line p-6 shadow-sm">
              <h2 className="text-base font-semibold text-text mb-6">Property Details</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted uppercase tracking-wider mb-2 block">Address</label>
                  <div className="relative">
                    <Map className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
                    <input 
                      value={form.address} 
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      className="w-full bg-panel-2 border border-line rounded-lg py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all text-text"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="text-xs font-medium text-muted uppercase tracking-wider mb-2 block">Market</label>
                  <select 
                    value={form.region_code} 
                    onChange={(e) => setForm({ ...form, region_code: e.target.value })}
                    className="w-full bg-panel-2 border border-line rounded-lg py-2.5 px-4 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all appearance-none text-text"
                  >
                    {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="text-xs font-medium text-muted uppercase tracking-wider mb-2 block">Sqft</label>
                    <div className="relative">
                      <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
                      <input 
                        type="number" 
                        value={form.square_feet}
                        onChange={(e) => setForm({ ...form, square_feet: +e.target.value })}
                        className="w-full bg-panel-2 border border-line rounded-lg py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all font-mono text-text"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-muted uppercase tracking-wider mb-2 block">Beds</label>
                      <div className="relative">
                        <Bed className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted" />
                        <input 
                          type="number" 
                          value={form.beds} 
                          onChange={(e) => setForm({ ...form, beds: +e.target.value })}
                          className="w-full bg-panel-2 border border-line rounded-lg py-2.5 pl-8 pr-2 text-sm focus:outline-none focus:border-accent transition-all font-mono text-text"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted uppercase tracking-wider mb-2 block">Baths</label>
                      <div className="relative">
                        <Bath className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted" />
                        <input 
                          type="number" step="0.5" 
                          value={form.baths}
                          onChange={(e) => setForm({ ...form, baths: +e.target.value })}
                          className="w-full bg-panel-2 border border-line rounded-lg py-2.5 pl-8 pr-2 text-sm focus:outline-none focus:border-accent transition-all font-mono text-text"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-line">
                {error && (
                  <div className="mb-4 p-3 rounded-lg bg-bad/10 border border-bad/20 flex items-start gap-2.5">
                    <AlertCircle className="size-4 text-bad mt-0.5 shrink-0" />
                    <p className="text-sm text-bad leading-tight">{error}</p>
                  </div>
                )}
                
                <button 
                  className="w-full bg-accent hover:bg-accent/90 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={submit} 
                  disabled={busy || photos.length < 5}
                >
                  {busy ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {status || "Evaluating..."}
                    </>
                  ) : (
                    <>
                      Generate Estimate
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

        {/* Results Section */}
        {result && (
          <div className="mt-12 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid lg:grid-cols-[1fr_300px] gap-8">
              
              {/* Primary Metrics */}
              <section className="bg-panel rounded-2xl border border-line p-8 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-semibold">Estimate Results</h2>
                  <div className="flex gap-2">
                    <span className="px-2.5 py-1 text-xs font-mono rounded bg-panel-2 border border-line text-muted">
                      CostBook v{result.costbook_version}
                    </span>
                    <span className="px-2.5 py-1 text-xs font-mono rounded bg-panel-2 border border-line text-muted flex items-center gap-1.5">
                      <Activity className="size-3" />
                      {result.model?.provider}/{result.model?.model}
                    </span>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-12">
                  <div className="flex flex-col justify-center items-center p-6 bg-panel-2/50 rounded-xl border border-line/50">
                    <div className="relative">
                      <svg className="w-32 h-32 transform -rotate-90">
                        <circle cx="64" cy="64" r="60" className="stroke-line" strokeWidth="8" fill="none" />
                        <circle 
                          cx="64" cy="64" r="60" 
                          strokeWidth="8" fill="none"
                          strokeLinecap="round"
                          className={cn(
                            "transition-all duration-1000 ease-out",
                            result.condition.overall_score >= 70 ? "stroke-good" : 
                            result.condition.overall_score >= 45 ? "stroke-warn" : "stroke-bad"
                          )}
                          strokeDasharray={2 * Math.PI * 60}
                          strokeDashoffset={2 * Math.PI * 60 * (1 - result.condition.overall_score / 100)}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl font-bold font-mono tracking-tighter">
                          {result.condition.overall_score}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm font-medium text-muted mt-4 uppercase tracking-wider">Condition Score</div>
                    <div className="text-xs text-muted mt-1 font-mono">
                      Conf: {Math.round(result.condition.confidence * 100)}%
                    </div>
                  </div>

                  <div className="flex flex-col justify-center">
                    <div className="text-sm font-medium text-muted uppercase tracking-wider mb-2">Expected Rehab</div>
                    <div className="text-5xl font-bold font-mono tracking-tight mb-6 text-text">
                      {usd(est.expected)}
                    </div>
                    
                    <div className="space-y-2">
                      <div className="h-2.5 rounded-full bg-panel-2 relative overflow-hidden flex">
                        <div className="absolute left-0 top-0 bottom-0 bg-line w-full" />
                        <div 
                          className="absolute top-0 bottom-0 bg-gradient-to-r from-accent/80 to-accent rounded-full"
                          style={{ 
                            left: `${((est.low - (est.low * 0.9)) / ((est.high * 1.1) - (est.low * 0.9))) * 100}%`,
                            width: `${((est.high - est.low) / ((est.high * 1.1) - (est.low * 0.9))) * 100}%` 
                          }}
                        />
                        <div 
                          className="absolute top-0 bottom-0 w-1 bg-text rounded-full shadow-[0_0_8px_rgba(255,255,255,0.5)] z-10"
                          style={{ left: `${((est.expected - (est.low * 0.9)) / ((est.high * 1.1) - (est.low * 0.9))) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs font-mono text-muted">
                        <span>{usd(est.low)}</span>
                        <span>{usd(est.high)}</span>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-line/50 grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted mb-1">Market Multiplier</div>
                        <div className="text-sm font-mono">{result.estimate.region_code} × {result.estimate.region_multiplier}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted mb-1">Contingency</div>
                        <div className="text-sm font-mono">+{Math.round(result.estimate.contingency_pct * 100)}%</div>
                      </div>
                    </div>
                  </div>
                </div>

                {result.warnings?.length > 0 && (
                  <div className="mt-8 bg-warn/10 border border-warn/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-warn font-medium mb-3">
                      <AlertTriangle className="size-4.5" />
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
              </section>

              {/* Component Breakdowns */}
              <section className="bg-panel rounded-2xl border border-line p-6 shadow-sm flex flex-col">
                <h2 className="text-base font-semibold mb-1">Components</h2>
                <p className="text-xs text-muted mb-6">Condition scale: 0 (replace) to 5 (new)</p>
                
                <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                  {result.condition.components.map((c: any) => (
                    <div key={c.component}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="capitalize">{c.component.replace("_", " ")}</span>
                        <span className="font-mono text-muted">
                          <span className={cn(
                            "font-medium",
                            c.score >= 3.5 ? "text-good" : c.score >= 2 ? "text-warn" : "text-bad"
                          )}>{c.score.toFixed(1)}</span>
                          <span className="opacity-50">/5</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-panel-2 overflow-hidden border border-line/30">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all duration-1000",
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
              <section className="bg-panel rounded-2xl border border-line p-6 shadow-sm">
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
                    <div className="p-4 rounded-xl bg-panel-2 border border-line" key={i}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={cn(
                          "px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded font-medium",
                          g.severity === 'critical' ? "bg-bad/20 text-bad border border-bad/20" : "bg-warn/20 text-warn border border-warn/20"
                        )}>
                          {g.severity}
                        </span>
                        <strong className="capitalize text-sm">{g.component.replace("_", " ")}</strong>
                      </div>
                      <p className="text-sm text-muted">{g.impact}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Line Items */}
            <section className="bg-panel rounded-2xl border border-line p-0 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-line bg-panel">
                <h2 className="text-base font-semibold">Repair Line Items</h2>
                <p className="text-sm text-muted mt-1">Transparent pricing tied directly to cost book items and measured quantities.</p>
              </div>
              
              <div className="overflow-x-auto bg-panel-2/30">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase tracking-wider text-muted bg-panel-2/50 border-b border-line">
                    <tr>
                      <th className="px-6 py-4 font-medium">Item & Basis</th>
                      <th className="px-6 py-4 font-medium text-right">Quantity</th>
                      <th className="px-6 py-4 font-medium text-right">Unit Cost</th>
                      <th className="px-6 py-4 font-medium text-right hidden sm:table-cell">Low</th>
                      <th className="px-6 py-4 font-medium text-right">Expected</th>
                      <th className="px-6 py-4 font-medium text-right hidden md:table-cell">High</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/50 bg-panel/50">
                    {result.repairs.map((r: any) => (
                      <tr key={r.cost_item_id} className="hover:bg-panel-2/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-text">{r.label}</div>
                          <div className="text-xs font-mono text-muted mt-1 opacity-70">
                            {r.cost_item_id} · {r.driving_defects.join(", ")}
                          </div>
                          <div className="text-xs text-muted mt-2 border-l-2 border-accent/30 pl-2">
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
                        <td className="px-6 py-4 text-right font-mono font-medium whitespace-nowrap">
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
                      <td className="px-6 py-4">Subtotal (National Base)</td>
                      <td className="px-6 py-4"></td>
                      <td className="px-6 py-4"></td>
                      <td className="px-6 py-4 text-right font-mono text-muted hidden sm:table-cell">{usd(est.subtotal_low)}</td>
                      <td className="px-6 py-4 text-right font-mono text-lg">{usd(est.subtotal_expected)}</td>
                      <td className="px-6 py-4 text-right font-mono text-muted hidden md:table-cell">{usd(est.subtotal_high)}</td>
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
