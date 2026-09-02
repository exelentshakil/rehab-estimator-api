"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Shield, Zap, Code2, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function Footer() {
  const [showProposal, setShowProposal] = useState(false);

  return (
    <footer className="border-t border-line bg-panel-2 mt-24">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 gap-12 lg:gap-24">
          
          {/* Left Column: PRD & Value Prop */}
          <div className="space-y-8">
            <div>
              <h3 className="text-xl font-semibold mb-3">Enterprise-Grade Rehab Estimator</h3>
              <p className="text-muted leading-relaxed">
                This isn't a wrapper around ChatGPT predicting random prices. This is a deterministic pricing engine paired with a constrained vision model, built exactly to the specifications of the Upwork brief.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex gap-3">
                <div className="mt-1 size-5 rounded bg-accent/10 flex items-center justify-center shrink-0">
                  <Shield className="size-3 text-accent" />
                </div>
                <div>
                  <div className="font-medium text-sm">Deterministic Pricing</div>
                  <div className="text-xs text-muted mt-1">Same property + same database = exact same $ value every time.</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="mt-1 size-5 rounded bg-accent/10 flex items-center justify-center shrink-0">
                  <Cpu className="size-3 text-accent" />
                </div>
                <div>
                  <div className="font-medium text-sm">Closed Vocabulary</div>
                  <div className="text-xs text-muted mt-1">Model outputs specific defect codes, not hallucinations.</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="mt-1 size-5 rounded bg-accent/10 flex items-center justify-center shrink-0">
                  <Zap className="size-3 text-accent" />
                </div>
                <div>
                  <div className="font-medium text-sm">Next.js + Supabase</div>
                  <div className="text-xs text-muted mt-1">Highly scalable Edge architecture deployed on Vercel.</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="mt-1 size-5 rounded bg-accent/10 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="size-3 text-accent" />
                </div>
                <div>
                  <div className="font-medium text-sm">API Ready</div>
                  <div className="text-xs text-muted mt-1">Headless architecture ready to integrate anywhere.</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Proposal & Pricing */}
          <div className="bg-panel border border-line rounded-2xl p-8 shadow-sm">
            <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Code2 className="size-5 text-accent" />
              Project Proposal & Timeline
            </h3>

            <div className="space-y-6">
              <div className="flex justify-between items-end border-b border-line pb-4">
                <div>
                  <div className="text-sm font-medium text-muted uppercase tracking-wider mb-1">Total Build Time</div>
                  <div className="text-2xl font-bold font-mono">74 Hours</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-muted uppercase tracking-wider mb-1">Total Investment</div>
                  <div className="text-2xl font-bold font-mono text-accent">$11,100</div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted flex items-center gap-2"><CheckCircle2 className="size-4 text-good"/> Architecture & DB Design</span>
                  <span className="font-mono">12h</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted flex items-center gap-2"><CheckCircle2 className="size-4 text-good"/> Vision Model Integration</span>
                  <span className="font-mono">18h</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted flex items-center gap-2"><CheckCircle2 className="size-4 text-good"/> Deterministic Pricing Engine</span>
                  <span className="font-mono">24h</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted flex items-center gap-2"><CheckCircle2 className="size-4 text-good"/> API Endpoints & Auth</span>
                  <span className="font-mono">12h</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted flex items-center gap-2"><CheckCircle2 className="size-4 text-good"/> QA & Costbook Calibration</span>
                  <span className="font-mono">8h</span>
                </div>
              </div>

              <button 
                onClick={() => setShowProposal(!showProposal)}
                className="w-full mt-4 py-3 bg-panel-2 hover:bg-line border border-line rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                Read Full Cover Letter
                <ArrowRight className={cn("size-4 transition-transform", showProposal && "rotate-90")} />
              </button>

              {showProposal && (
                <div className="pt-4 text-sm text-muted leading-relaxed space-y-4 animate-in fade-in slide-in-from-top-2">
                  <p>Your hardest line is the one most bids will skip: the pricing database controls the dollar, not the AI.</p>
                  <p>The model gets a JSON schema with no cost field. It picks only from a closed vocabulary, 14 components and 44 defect codes, severity 0-4, extent 0-1. It has nowhere to put a price. A deterministic engine does the quantity takeoff from your property record and prices against a versioned cost book. Same observations in, identical dollars out.</p>
                  <p>4 years leading engineering at Legiit, AI dashboards on a 2M+ user platform.</p>
                  <p>Swapping in your cost database is one adapter file. Send your schema or a CSV of items and unit costs and I will run it on your data.</p>
                  <p className="font-medium text-text mt-4 pt-4 border-t border-line">Ready to start today.</p>
                </div>
              )}
            </div>
          </div>

        </div>

        <div className="mt-16 pt-8 border-t border-line flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted">
          <div>Built specifically for the Upwork Photo Condition & Rehab Estimator API job.</div>
          <div className="flex items-center gap-6">
            <a href="https://github.com/exelentshakil/rehab-estimator-api" target="_blank" rel="noreferrer" className="hover:text-text transition-colors">View Source on GitHub</a>
            <a href="https://shakilhq.com" target="_blank" rel="noreferrer" className="hover:text-text transition-colors">shakilhq.com Portfolio</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
