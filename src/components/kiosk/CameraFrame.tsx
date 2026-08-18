import type { ReactNode, RefObject } from "react";
import { CameraOff, RotateCcw, ShieldAlert } from "lucide-react";
import type { CameraState } from "@/hooks/useCamera";

export function CameraFrame({
  videoRef,
  state,
  errorMessage,
  onRetry,
  overlay,
  mirrored = false,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  state: CameraState;
  errorMessage?: string | null;
  onRetry: () => void;
  overlay?: ReactNode;
  mirrored?: boolean;
}) {
  return (
    <div className="camera-container relative aspect-4/3 w-full max-h-[220px] sm:max-h-[380px] overflow-hidden rounded-3xl border border-border bg-secondary shadow-[var(--shadow-kiosk)]">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`size-full object-cover ${mirrored ? "-scale-x-100" : ""}`}
      />
      {overlay}
      {state === "insecure_context" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/95 p-6 text-center text-white">
          <ShieldAlert className="size-10 text-amber-400" aria-hidden />
          <p className="text-lg font-bold text-amber-300">Camera Blocked on Network IP</p>
          <p className="text-xs text-slate-300 max-w-sm leading-relaxed">
            Browsers block camera access over unencrypted HTTP network IP links (e.g. <code>http://192.168.x.x</code>).
          </p>
          <div className="mt-1 rounded-xl border border-white/10 bg-white/5 p-3 text-[11px] text-slate-300 text-left w-full max-w-sm">
            <p className="font-semibold text-amber-400 mb-1">To enable camera on friend&apos;s device:</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Open <code>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code> in Chrome</li>
              <li>Add your laptop IP (e.g. <code>http://192.168.x.x:5173</code>) and select &quot;Enabled&quot;</li>
              <li>Relaunch browser on friend&apos;s device</li>
            </ol>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 active:scale-95 transition-transform"
          >
            <RotateCcw className="size-4" /> Try Camera Again
          </button>
        </div>
      )}
      {state === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card px-6 text-center">
          <CameraOff className="size-10 text-destructive" aria-hidden />
          <p className="text-xl font-bold text-destructive">Camera not detected on this device</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            {errorMessage || "Please grant camera permission in your browser or reconnect camera."}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground active:scale-[0.98]"
          >
            <RotateCcw className="size-4" aria-hidden /> Retry Camera
          </button>
        </div>
      )}
      {state === "starting" && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/80 text-sm font-medium text-muted-foreground">
          Requesting device camera…
        </div>
      )}
    </div>
  );
}
