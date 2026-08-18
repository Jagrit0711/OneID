import { useState, type ReactNode, type RefObject } from "react";
import { CameraOff, RotateCcw, ShieldAlert, Wifi, Check, X } from "lucide-react";
import type { CameraState } from "@/hooks/useCamera";

export function CameraFrame({
  videoRef,
  state,
  errorMessage,
  onRetry,
  onSetIpCamUrl,
  ipCamUrl,
  overlay,
  mirrored = false,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  state: CameraState;
  errorMessage?: string | null;
  onRetry: () => void;
  onSetIpCamUrl?: (url: string | null) => void;
  ipCamUrl?: string | null;
  overlay?: ReactNode;
  mirrored?: boolean;
}) {
  const [showIpModal, setShowIpModal] = useState(false);
  const [inputUrl, setInputUrl] = useState(ipCamUrl || "");

  const handleSaveIpCam = () => {
    if (onSetIpCamUrl) {
      onSetIpCamUrl(inputUrl.trim() ? inputUrl.trim() : null);
    }
    setShowIpModal(false);
  };

  const handleClearIpCam = () => {
    setInputUrl("");
    if (onSetIpCamUrl) {
      onSetIpCamUrl(null);
    }
    setShowIpModal(false);
  };

  return (
    <div className="camera-container relative aspect-4/3 w-full max-h-[220px] sm:max-h-[380px] overflow-hidden rounded-3xl border border-border bg-secondary shadow-[var(--shadow-kiosk)]">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`size-full object-cover ${mirrored && !ipCamUrl ? "-scale-x-100" : ""}`}
      />
      {overlay}

      {/* IP Cam Quick Action Badge */}
      {onSetIpCamUrl && (
        <button
          type="button"
          onClick={() => setShowIpModal(true)}
          className={`absolute top-3 right-3 z-20 inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all shadow-md active:scale-95 ${
            ipCamUrl
              ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
              : "border-white/20 bg-slate-900/80 text-white/90 hover:bg-slate-900"
          }`}
        >
          <Wifi className="size-3.5 text-amber-400" />
          <span>{ipCamUrl ? "IP Cam Connected" : "Use IP Cam"}</span>
        </button>
      )}

      {/* Modal: IP Camera Stream URL Input */}
      {showIpModal && (
        <div className="absolute inset-0 z-30 flex flex-col justify-between bg-slate-950/95 p-5 text-white animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Wifi className="size-4 text-amber-400" />
              <h3 className="text-sm font-bold text-amber-300">Connect IP Camera Stream</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowIpModal(false)}
              className="rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="my-auto space-y-3">
            <p className="text-xs text-slate-300 leading-relaxed">
              Enter your phone or IP camera HTTP video stream URL (e.g. Android IP Webcam, DroidCam, or RTSP/HTTP stream):
            </p>
            <input
              type="url"
              placeholder="http://192.168.1.5:8080/video"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs text-white placeholder:text-white/40 focus:border-amber-400 focus:outline-none"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[10px] text-white/50">Presets:</span>
              <button
                type="button"
                onClick={() => setInputUrl("http://192.168.1.5:8080/video")}
                className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] text-amber-300 hover:bg-white/20"
              >
                IP Webcam (:8080/video)
              </button>
              <button
                type="button"
                onClick={() => setInputUrl("http://192.168.1.5:4747/video")}
                className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] text-amber-300 hover:bg-white/20"
              >
                DroidCam (:4747/video)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={handleSaveIpCam}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 active:scale-95"
            >
              <Check className="size-3.5" /> Start IP Stream
            </button>
            {ipCamUrl && (
              <button
                type="button"
                onClick={handleClearIpCam}
                className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/20"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* State A: HTTP Network IP Insecure Context Notice */}
      {state === "insecure_context" && !ipCamUrl && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-slate-950/95 p-5 text-center text-white z-10">
          <ShieldAlert className="size-9 text-amber-400" aria-hidden />
          <p className="text-sm font-bold text-amber-300">Camera Blocked on Network IP</p>
          <p className="text-[11px] text-slate-300 max-w-sm leading-snug">
            Browsers block local webcams over unencrypted HTTP network IP links (e.g. <code>http://192.168.x.x</code>).
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {onSetIpCamUrl && (
              <button
                type="button"
                onClick={() => setShowIpModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 active:scale-95"
              >
                <Wifi className="size-3.5" /> Connect IP Cam
              </button>
            )}
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white/90 hover:bg-white/20"
            >
              <RotateCcw className="size-3.5" /> Retry
            </button>
          </div>
        </div>
      )}

      {/* State B: Error */}
      {state === "error" && !ipCamUrl && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-card px-6 text-center z-10">
          <CameraOff className="size-9 text-destructive" aria-hidden />
          <p className="text-lg font-bold text-destructive">Camera not detected</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            {errorMessage || "Please grant camera permission or use an IP Camera stream."}
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {onSetIpCamUrl && (
              <button
                type="button"
                onClick={() => setShowIpModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 active:scale-95"
              >
                <Wifi className="size-3.5" /> Connect IP Cam
              </button>
            )}
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary px-4 py-2 text-xs font-semibold text-foreground active:scale-95"
            >
              <RotateCcw className="size-3.5" /> Retry
            </button>
          </div>
        </div>
      )}

      {state === "starting" && !ipCamUrl && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/80 text-xs font-medium text-muted-foreground">
          Requesting camera…
        </div>
      )}
    </div>
  );
}
