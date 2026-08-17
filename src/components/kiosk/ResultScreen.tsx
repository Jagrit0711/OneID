import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, RotateCcw, ArrowRight, ShieldCheck, ShieldAlert, Fingerprint } from "lucide-react";
import type { FaceOutcome } from "./FaceScreen";

export function ResultScreen({
  outcome,
  name,
  signatureValid,
  onRetry,
  onContinue,
}: {
  outcome: FaceOutcome;
  name?: string | undefined;
  signatureValid?: boolean | undefined;
  onRetry: () => void;
  onContinue: () => void;
}) {
  const ok      = outcome.verified;
  const isSigOk = signatureValid !== false;

  // Animate the match percentage counting up
  const [displayPct, setDisplayPct] = useState(0);
  const [revealed, setRevealed]     = useState(false);

  useEffect(() => {
    // Short delay before reveal animation
    const revealTimer = setTimeout(() => setRevealed(true), 100);
    // Count up the percentage
    let start = 0;
    const target = outcome.match;
    const step = target / 40; // ~40 ticks over ~800ms
    const ticker = setInterval(() => {
      start += step;
      if (start >= target) {
        setDisplayPct(target);
        clearInterval(ticker);
      } else {
        setDisplayPct(Math.round(start));
      }
    }, 20);
    return () => { clearTimeout(revealTimer); clearInterval(ticker); };
  }, [outcome.match]);

  const confidenceLabel =
    outcome.match >= 80 ? "High"
    : outcome.match >= 60 ? "Medium"
    : "Low";

  const confidenceColor =
    outcome.match >= 80 ? "text-emerald-400"
    : outcome.match >= 60 ? "text-amber-400"
    : "text-red-400";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-10 text-center">
      {/* ── Hero icon ── */}
      <div
        className={`relative flex size-32 items-center justify-center rounded-full transition-all duration-700 ${
          revealed ? "scale-100 opacity-100" : "scale-50 opacity-0"
        } ${
          ok
            ? "bg-emerald-500/15 ring-4 ring-emerald-500/40 shadow-[0_0_80px_rgba(52,211,153,0.3)]"
            : "bg-red-500/15 ring-4 ring-red-500/40 shadow-[0_0_80px_rgba(239,68,68,0.3)]"
        }`}
      >
        {ok ? (
          <CheckCircle2 className="size-16 text-emerald-400" />
        ) : (
          <XCircle className="size-16 text-red-400" />
        )}
        {/* Subtle pulsing ring */}
        <div
          className={`absolute inset-0 rounded-full animate-ping opacity-20 ${
            ok ? "bg-emerald-500" : "bg-red-500"
          }`}
          style={{ animationDuration: "2s" }}
        />
      </div>

      {/* ── Verdict ── */}
      <h1
        className={`mt-8 text-5xl font-bold tracking-tight transition-all duration-500 delay-200 ${
          revealed ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        } ${ok ? "text-emerald-400" : "text-red-400"}`}
      >
        {ok ? "Identity Verified" : "Verification Failed"}
      </h1>

      <p
        className={`mt-3 max-w-xl text-lg text-muted-foreground transition-all duration-500 delay-300 ${
          revealed ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        {ok
          ? `${name ? `${name} — identity` : "Identity"} confirmed against the Aadhaar Secure QR photograph.`
          : outcome.reason ?? "Face did not match the Aadhaar QR photograph. Please retry."}
      </p>

      {/* ── Metric Cards ── */}
      <div
        className={`mt-8 grid w-full max-w-lg grid-cols-3 gap-4 transition-all duration-500 delay-[400ms] ${
          revealed ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        {/* Face Match % */}
        <div
          className={`rounded-2xl border bg-card p-5 ${
            ok ? "border-emerald-500/30" : "border-red-500/30"
          }`}
        >
          <div className="flex items-center justify-center gap-1.5 text-xs tracking-widest text-muted-foreground uppercase">
            <Fingerprint className="size-3.5" />
            Face Match
          </div>
          <p
            className={`mt-2 text-4xl font-black tabular-nums ${
              ok ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {displayPct}%
          </p>
          {/* Mini bar */}
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full rounded-full transition-[width] duration-700 ${
                ok ? "bg-emerald-500" : "bg-red-500"
              }`}
              style={{ width: `${displayPct}%` }}
            />
          </div>
        </div>

        {/* Confidence */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs tracking-widest text-muted-foreground uppercase">Confidence</p>
          <p className={`mt-2 text-3xl font-black ${confidenceColor}`}>{confidenceLabel}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {outcome.match >= 80 ? "Strong match" : outcome.match >= 60 ? "Likely same person" : "No match"}
          </p>
        </div>

        {/* QR Signature */}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-5">
          <p className="text-xs tracking-widest text-muted-foreground uppercase">QR Signature</p>
          <div className="mt-2">
            {isSigOk ? (
              <div className="flex flex-col items-center gap-1">
                <ShieldCheck className="size-8 text-emerald-400" />
                <span className="text-sm font-bold text-emerald-400">Valid</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <ShieldAlert className="size-8 text-amber-400" />
                <span className="text-sm font-bold text-amber-400">Unverified</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Dual-factor summary strip ── */}
      <div
        className={`mt-5 flex w-full max-w-lg items-center justify-around rounded-2xl border px-4 py-3 text-sm transition-all duration-500 delay-500 ${
          revealed ? "opacity-100" : "opacity-0"
        } ${
          ok
            ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
            : "border-red-500/20 bg-red-500/5 text-red-300"
        }`}
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className={`size-4 ${isSigOk ? "text-emerald-400" : "text-amber-400"}`} />
          <span className="text-xs">
            <span className="font-semibold">QR:</span> {isSigOk ? "UIDAI signed" : "Decoded"}
          </span>
        </div>
        <div className="h-4 w-px bg-current opacity-20" />
        <div className="flex items-center gap-2">
          <Fingerprint className={`size-4 ${ok ? "text-emerald-400" : "text-red-400"}`} />
          <span className="text-xs">
            <span className="font-semibold">Face:</span> {ok ? "Matched" : "No match"}
          </span>
        </div>
        <div className="h-4 w-px bg-current opacity-20" />
        <div className="flex items-center gap-2">
          <CheckCircle2 className={`size-4 ${ok ? "text-emerald-400" : "text-red-400"}`} />
          <span className="text-xs">
            <span className="font-semibold">Overall:</span> {ok ? "Verified ✓" : "Failed ✗"}
          </span>
        </div>
      </div>

      {/* ── CTA Button ── */}
      <button
        type="button"
        onClick={ok ? onContinue : onRetry}
        className={`mt-8 inline-flex min-h-20 w-full max-w-md items-center justify-center gap-3 rounded-2xl text-xl font-bold shadow-lg transition-transform active:scale-[0.98] ${
          ok
            ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-emerald-500/30"
            : "bg-primary text-primary-foreground"
        }`}
      >
        {ok ? (
          <>Complete &amp; Clear Session <ArrowRight className="size-6" /></>
        ) : (
          <><RotateCcw className="size-6" /> Retry Face Check</>
        )}
      </button>

      <p className="mt-6 max-w-md text-xs text-muted-foreground">
        Privacy Guarantee: Session memory and facial embeddings are permanently erased when leaving this screen.
      </p>
    </div>
  );
}
