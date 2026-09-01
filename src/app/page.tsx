"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Health {
  vision_provider: string;
  vision_live: boolean;
  queue: string;
  storage: string;
  costbook: { version: string; items: number };
}

interface Photo {
  id: string;
  data: string; // data URI, already downscaled
  preview: string;
}

const REGIONS = [
  "US-NATIONAL", "OH-AKRON", "OH-CLEVELAND", "TX-DALLAS", "TX-HOUSTON", "FL-TAMPA",
  "FL-MIAMI", "GA-ATLANTA", "IL-CHICAGO", "AZ-PHOENIX", "NC-CHARLOTTE", "PA-PHILADELPHIA",
  "NY-NYC", "CA-LA", "CA-SF", "WA-SEATTLE", "CO-DENVER", "MI-DETROIT", "MO-STLOUIS",
  "IN-INDIANAPOLIS", "TN-MEMPHIS", "AL-BIRMINGHAM",
];

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

/**
 * Downscale in the browser before upload. 50 phone photos at 4MB each is a
 * 200MB request body; at 1280px/JPEG-0.82 the same set is ~8MB and the vision
 * model sees no less detail than it can use.
 */
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
        // Async path — poll until the queue finishes the job.
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
  const span = est ? Math.max(1, est.high - est.low) : 1;

  return (
    <div className="wrap">
      <header className="hero">
        <h1>Photo Condition &amp; Rehab Estimator</h1>
        <p>
          A vision model reads the photos and reports observations from a closed vocabulary.
          A deterministic pricing engine reads a versioned cost book and produces the dollars.
          The model never emits a price.
        </p>
        <div className="badges">
          <span className={`badge ${health?.vision_live ? "on" : "off"}`}>
            vision: {health?.vision_provider ?? "…"}
          </span>
          <span className="badge">queue: {health?.queue ?? "…"}</span>
          <span className="badge">store: {health?.storage ?? "…"}</span>
          <span className="badge">
            cost book v{health?.costbook.version ?? "…"} · {health?.costbook.items ?? "…"} items
          </span>
          <a className="badge" href="/api/costbook?include=mapping" target="_blank" rel="noreferrer">
            view pricing source →
          </a>
        </div>
      </header>

      <section className="panel">
        <h2>Property record</h2>
        <p className="sub">Drives every quantity takeoff. No dimensions are inferred from photos.</p>

        <div className="grid f5">
          <div>
            <label>Address</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label>Square feet</label>
            <input type="number" value={form.square_feet}
              onChange={(e) => setForm({ ...form, square_feet: +e.target.value })} />
          </div>
          <div>
            <label>Beds</label>
            <input type="number" value={form.beds} onChange={(e) => setForm({ ...form, beds: +e.target.value })} />
          </div>
          <div>
            <label>Baths</label>
            <input type="number" step="0.5" value={form.baths}
              onChange={(e) => setForm({ ...form, baths: +e.target.value })} />
          </div>
          <div>
            <label>Market</label>
            <select value={form.region_code} onChange={(e) => setForm({ ...form, region_code: e.target.value })}>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        <div
          className={`drop ${over ? "over" : ""}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}
        >
          <strong>Drop 5–50 property photos</strong> or click to browse
          <div style={{ fontSize: 12.5, marginTop: 6 }}>
            {photos.length} selected · resized to 1280px in-browser before upload
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden
          onChange={(e) => e.target.files && addFiles(e.target.files)} />

        {photos.length > 0 && (
          <div className="thumbs">
            {photos.map((p) => (
              <div className="thumb" key={p.id}>
                <img src={p.preview} alt="" />
                <button onClick={() => setPhotos((x) => x.filter((y) => y.id !== p.id))}>×</button>
              </div>
            ))}
          </div>
        )}

        <div className="actions">
          <button className="primary" onClick={submit} disabled={busy || photos.length < 5}>
            {busy ? "Evaluating…" : `Evaluate ${photos.length || ""} photos`}
          </button>
          {photos.length > 0 && (
            <button className="ghost" onClick={() => { setPhotos([]); setResult(null); }}>Clear</button>
          )}
          {status && <span className="status">{status}</span>}
        </div>
        {error && <div className="err">{error}</div>}
      </section>

      {result && (
        <>
          <section className="panel">
            <h2>Result</h2>
            <p className="sub">
              Cost book v{result.costbook_version} · observations by {result.model?.provider}/{result.model?.model}
            </p>
            <div className="headline">
              <div className="gauge">
                <div className="num" style={{
                  color: result.condition.overall_score >= 70 ? "var(--good)"
                    : result.condition.overall_score >= 45 ? "var(--warn)" : "var(--bad)",
                }}>
                  {result.condition.overall_score}
                </div>
                <div className="cap">condition / 100</div>
                <div className="cap" style={{ marginTop: 10 }}>
                  confidence {Math.round(result.condition.confidence * 100)}%
                </div>
              </div>

              <div className="band">
                <div className="row">
                  <span className="lab">Expected rehab</span>
                  <span className="lab">
                    {result.estimate.region_code} × {result.estimate.region_multiplier} ·
                    {" "}+{Math.round(result.estimate.contingency_pct * 100)}% contingency
                  </span>
                </div>
                <div className="exp">{usd(est.expected)}</div>
                <div className="bar">
                  <i style={{ left: 0, right: 0 }} />
                  <b style={{ left: `${((est.expected - est.low) / span) * 100}%` }} />
                </div>
                <div className="ends">
                  <span>low {usd(est.low)}</span>
                  <span>estimate confidence {Math.round(est.confidence * 100)}%</span>
                  <span>high {usd(est.high)}</span>
                </div>
              </div>
            </div>

            {result.warnings?.length > 0 && (
              <ul className="warn-list" style={{ marginTop: 18 }}>
                {result.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
              </ul>
            )}
          </section>

          <section className="panel">
            <h2>Component scores</h2>
            <p className="sub">0 = failed / replace · 5 = as-new. Worst first.</p>
            {result.condition.components.map((c: any) => (
              <div className="comp" key={c.component}>
                <span className="name">{c.component.replace("_", " ")}</span>
                <span className="track">
                  <i style={{
                    width: `${(c.score / 5) * 100}%`,
                    background: c.score >= 3.5 ? "var(--good)" : c.score >= 2 ? "var(--warn)" : "var(--bad)",
                  }} />
                </span>
                <span className="val">
                  {c.score.toFixed(1)}/5 · {Math.round(c.confidence * 100)}%
                </span>
              </div>
            ))}
          </section>

          {result.coverage.missing.length > 0 && (
            <section className="panel">
              <h2>Coverage gaps</h2>
              <p className="sub">
                {result.coverage.photos_analyzed} photos analyzed
                {result.coverage.photos_rejected > 0 && `, ${result.coverage.photos_rejected} rejected`}
                {" "}· coverage {Math.round(result.coverage.score * 100)}%
              </p>
              {result.coverage.missing.map((g: any, i: number) => (
                <div className={`gap ${g.severity}`} key={i}>
                  <span className="tag">{g.severity}</span>
                  <strong style={{ textTransform: "capitalize" }}>{g.component.replace("_", " ")}</strong>
                  <div className="why">{g.impact}</div>
                </div>
              ))}
            </section>
          )}

          <section className="panel">
            <h2>Repair line items</h2>
            <p className="sub">
              Every row resolves to a cost-book id. Quantity basis is shown so the arithmetic can be checked by hand.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="num">Qty</th>
                  <th className="num">Unit cost</th>
                  <th className="num">Low</th>
                  <th className="num">Expected</th>
                  <th className="num">High</th>
                  <th className="num">Conf.</th>
                </tr>
              </thead>
              <tbody>
                {result.repairs.map((r: any) => (
                  <tr key={r.cost_item_id}>
                    <td>
                      {r.label}
                      <div className="code">{r.cost_item_id} · {r.driving_defects.join(", ")}</div>
                      <div className="basis">{r.basis}</div>
                    </td>
                    <td className="num">{r.quantity} {r.unit}</td>
                    <td className="num">{usd(r.unit_cost_expected)}</td>
                    <td className="num">{usd(r.low)}</td>
                    <td className="num"><strong>{usd(r.expected)}</strong></td>
                    <td className="num">{usd(r.high)}</td>
                    <td className="num">{Math.round(r.confidence * 100)}%</td>
                  </tr>
                ))}
                <tr>
                  <td><strong>Subtotal (national book, before market &amp; contingency)</strong></td>
                  <td className="num" />
                  <td className="num" />
                  <td className="num">{usd(est.subtotal_low)}</td>
                  <td className="num"><strong>{usd(est.subtotal_expected)}</strong></td>
                  <td className="num">{usd(est.subtotal_high)}</td>
                  <td className="num" />
                </tr>
              </tbody>
            </table>
          </section>

          <section className="panel">
            <h2>Raw API response</h2>
            <p className="sub">This is exactly what <code>GET /api/jobs/{result.job_id}</code> returns.</p>
            <details className="raw">
              <summary>Expand JSON</summary>
              <pre className="json">{JSON.stringify(result, null, 2)}</pre>
            </details>
          </section>
        </>
      )}
    </div>
  );
}
