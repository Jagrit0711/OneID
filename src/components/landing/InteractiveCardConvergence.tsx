import { useEffect, useRef, useState } from "react";
import { Sparkles, ShieldCheck, CheckCircle2, Sliders } from "lucide-react";

export function InteractiveCardConvergence() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0); // 0 = Floating scattered, 1 = Merged into Aadhaar
  const [autoPlay, setAutoPlay] = useState(false);

  // Scroll listener to update convergence progress smoothly
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current || autoPlay) return;
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      // Calculate how far through the section the user has scrolled
      const totalScrollable = rect.height - windowHeight / 2;
      const currentScroll = windowHeight - rect.top;
      const calculated = Math.min(Math.max(currentScroll / totalScrollable, 0), 1);
      
      setProgress(calculated);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [autoPlay]);

  // Auto-play / toggle merge state
  const toggleMerge = () => {
    setAutoPlay(true);
    setProgress((prev) => (prev > 0.5 ? 0 : 1));
  };

  return (
    <div
      ref={containerRef}
      className="relative min-h-[90vh] w-full overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-b from-slate-950 via-slate-900 to-background p-6 py-16 text-center select-none"
    >
      {/* Background Ambient Glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent opacity-80" />

      {/* Header */}
      <div className="relative z-20 mx-auto max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-bold text-emerald-400">
          <Sparkles className="size-3.5 animate-spin-slow" /> Interactive Credential Convergence
        </div>

        <h2 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl leading-tight">
          All your identity credentials. <br />
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            Unified into OneID.
          </span>
        </h2>

        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          Scroll down or click the toggle below to watch your PAN, Driving License, Voter ID, Ration Card, and ABHA cards converge seamlessly into your primary Aadhaar identity.
        </p>

        {/* Interactive Merge Control Button */}
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={toggleMerge}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-6 py-2.5 text-xs font-bold text-emerald-300 shadow-lg shadow-emerald-500/10 hover:bg-emerald-500/25 active:scale-95 transition-all"
          >
            <Sliders className="size-4" />
            {progress > 0.5 ? "Scatter Cards Back" : "Merge All Cards into OneID"}
          </button>
        </div>
      </div>

      {/* ── 3D Convergence Arena ── */}
      <div className="relative mx-auto mt-12 flex h-[500px] max-w-5xl items-center justify-center perspective-1000">
        
        {/* 1. CENTRAL HERO: Aadhaar OneID Card */}
        <div
          className={`relative z-20 w-80 sm:w-96 rounded-3xl border-2 p-5 shadow-2xl transition-all duration-700 ease-out ${
            progress > 0.7
              ? "border-emerald-400 bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-900 shadow-emerald-500/30 scale-105"
              : "border-emerald-500/60 bg-slate-900/90 shadow-slate-950/80"
          }`}
          style={{
            transform: `scale(${1 + progress * 0.08}) rotateX(${progress * 5}deg)`,
          }}
        >
          {/* Card Header Bar */}
          <div className="flex items-center justify-between border-b border-emerald-500/30 pb-3">
            <div className="flex items-center gap-2">
              <div className="size-6 rounded-md bg-emerald-500 p-1 text-slate-950">
                <ShieldCheck className="size-full" />
              </div>
              <span className="text-xs font-black tracking-widest text-emerald-400 uppercase">
                UNIQUE IDENTIFICATION
              </span>
            </div>
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
              GOVT OF INDIA
            </span>
          </div>

          {/* Card Body */}
          <div className="mt-4 flex gap-4 text-left">
            <div className="size-20 shrink-0 overflow-hidden rounded-xl border border-emerald-500/40 bg-slate-800 p-0.5">
              <div className="size-full bg-gradient-to-tr from-teal-600 to-emerald-400 rounded-lg flex items-center justify-center font-bold text-slate-950 text-xl">
                🇮🇳
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Holder Name</p>
              <p className="text-base font-extrabold text-foreground leading-none">Aarav Sharma</p>
              <p className="text-[10px] text-muted-foreground mt-1">DOB: 15/08/1994 · Male</p>
              <p className="font-mono text-xs font-bold text-emerald-400 mt-1">XXXX-XXXX-4921</p>
            </div>
          </div>

          {/* Unified Badge on Completion */}
          <div
            className={`mt-4 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-2 text-xs font-bold text-emerald-300 transition-opacity duration-500 ${
              progress > 0.7 ? "opacity-100" : "opacity-40"
            }`}
          >
            <CheckCircle2 className="size-4 text-emerald-400" />
            <span>
              {progress > 0.7 ? "All 5 Credentials Unified under OneID ✓" : "Primary Aadhaar Identity"}
            </span>
          </div>
        </div>

        {/* ── SURROUND FLOATING IDENTITY CARDS ── */}

        {/* 2. PAN Card (Top-Left) */}
        <div
          className="absolute z-10 w-64 rounded-2xl border border-cyan-500/40 bg-gradient-to-tr from-cyan-950/90 via-slate-900 to-slate-900 p-4 shadow-xl text-left transition-all duration-700 ease-out"
          style={{
            left: `${10 + progress * 25}%`,
            top: `${10 + progress * 25}%`,
            opacity: Math.max(1 - progress * 0.9, 0.1),
            transform: `scale(${1 - progress * 0.5}) rotate(${-12 + progress * 12}deg)`,
          }}
        >
          <div className="flex items-center justify-between text-[10px] font-bold text-cyan-300">
            <span>INCOME TAX DEPT</span>
            <span>PAN CARD</span>
          </div>
          <p className="mt-3 text-xs font-bold text-foreground">AARAV SHARMA</p>
          <p className="font-mono text-[11px] font-bold text-cyan-400 mt-1">ABCDE1234F</p>
        </div>

        {/* 3. Driving License (Top-Right) */}
        <div
          className="absolute z-10 w-64 rounded-2xl border border-amber-500/40 bg-gradient-to-tr from-slate-900 via-slate-900 to-amber-950/90 p-4 shadow-xl text-left transition-all duration-700 ease-out"
          style={{
            right: `${10 + progress * 25}%`,
            top: `${10 + progress * 25}%`,
            opacity: Math.max(1 - progress * 0.9, 0.1),
            transform: `scale(${1 - progress * 0.5}) rotate(${14 - progress * 14}deg)`,
          }}
        >
          <div className="flex items-center justify-between text-[10px] font-bold text-amber-300">
            <span>UNION OF INDIA</span>
            <span>DRIVING LICENSE</span>
          </div>
          <p className="mt-3 text-xs font-bold text-foreground">AARAV SHARMA</p>
          <p className="font-mono text-[11px] font-bold text-amber-400 mt-1">DL-1420110098765</p>
        </div>

        {/* 4. Voter ID (Bottom-Left) */}
        <div
          className="absolute z-10 w-64 rounded-2xl border border-indigo-500/40 bg-gradient-to-tr from-indigo-950/90 via-slate-900 to-slate-900 p-4 shadow-xl text-left transition-all duration-700 ease-out"
          style={{
            left: `${8 + progress * 27}%`,
            bottom: `${10 + progress * 25}%`,
            opacity: Math.max(1 - progress * 0.9, 0.1),
            transform: `scale(${1 - progress * 0.5}) rotate(${-8 + progress * 8}deg)`,
          }}
        >
          <div className="flex items-center justify-between text-[10px] font-bold text-indigo-300">
            <span>ELECTION COMMISSION</span>
            <span>VOTER ID</span>
          </div>
          <p className="mt-3 text-xs font-bold text-foreground">AARAV SHARMA</p>
          <p className="font-mono text-[11px] font-bold text-indigo-400 mt-1">KKD1933993</p>
        </div>

        {/* 5. Ration / Family Card (Bottom-Right) */}
        <div
          className="absolute z-10 w-64 rounded-2xl border border-emerald-500/40 bg-gradient-to-tr from-slate-900 via-slate-900 to-emerald-950/90 p-4 shadow-xl text-left transition-all duration-700 ease-out"
          style={{
            right: `${8 + progress * 27}%`,
            bottom: `${10 + progress * 25}%`,
            opacity: Math.max(1 - progress * 0.9, 0.1),
            transform: `scale(${1 - progress * 0.5}) rotate(${10 - progress * 10}deg)`,
          }}
        >
          <div className="flex items-center justify-between text-[10px] font-bold text-emerald-300">
            <span>CIVIL SUPPLIES</span>
            <span>RATION CARD</span>
          </div>
          <p className="mt-3 text-xs font-bold text-foreground">AARAV SHARMA</p>
          <p className="font-mono text-[11px] font-bold text-emerald-400 mt-1">RC-9876543210</p>
        </div>

        {/* 6. ABHA Health Card (Bottom-Center) */}
        <div
          className="absolute z-10 w-64 rounded-2xl border border-blue-500/40 bg-gradient-to-tr from-blue-950/90 via-slate-900 to-slate-900 p-4 shadow-xl text-left transition-all duration-700 ease-out"
          style={{
            bottom: `${2 + progress * 32}%`,
            opacity: Math.max(1 - progress * 0.9, 0.1),
            transform: `scale(${1 - progress * 0.5}) rotate(${0}deg)`,
          }}
        >
          <div className="flex items-center justify-between text-[10px] font-bold text-blue-300">
            <span>HEALTH AUTHORITY</span>
            <span>ABHA CARD</span>
          </div>
          <p className="mt-3 text-xs font-bold text-foreground">AARAV SHARMA</p>
          <p className="font-mono text-[11px] font-bold text-blue-400 mt-1">ABHA-91-8765-4321</p>
        </div>
      </div>
    </div>
  );
}
