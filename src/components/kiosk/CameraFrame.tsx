import type { ReactNode, RefObject } from "react";
import { CameraOff, RotateCcw } from "lucide-react";
import type { CameraState } from "@/hooks/useCamera";

export function CameraFrame({
  videoRef,
  state,
  onRetry,
  overlay,
  mirrored = false,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  state: CameraState;
  onRetry: () => void;
  overlay?: ReactNode;
  mirrored?: boolean;
}) {
  return (
    <div className="relative aspect-4/3 w-full overflow-hidden rounded-3xl border border-border bg-secondary shadow-[var(--shadow-kiosk)]">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`size-full object-cover ${mirrored ? "-scale-x-100" : ""}`}
      />
      {overlay}
      {state === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-card px-8 text-center">
          <CameraOff className="size-12 text-destructive" aria-hidden />
          <p className="text-2xl font-semibold text-destructive">Camera not detected</p>
          <p className="text-lg text-muted-foreground">
            Camera not detected. Please reconnect and try again.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex min-h-16 items-center gap-2 rounded-2xl bg-primary px-8 text-xl font-semibold text-primary-foreground active:scale-[0.98]"
          >
            <RotateCcw className="size-6" aria-hidden /> Retry
          </button>
        </div>
      )}
      {state === "starting" && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/80 text-lg font-medium text-muted-foreground">
          Starting camera…
        </div>
      )}
    </div>
  );
}
