import { useEffect } from "react";
import { ShieldCheck, WifiOff, ScanLine, Lock } from "lucide-react";
import { preloadFaceEngine } from "@/lib/face-engine";

export function HomeScreen({ onStart }: { onStart: () => void }) {
  // Pre-warm MediaPipe models in the background while user is on the home screen
  // so they're fully loaded by the time the face verification step is reached
  useEffect(() => {
    void preloadFaceEngine().catch(() => {/* silent — will retry on FaceScreen */});
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-10">
      <div className="flex w-full max-w-3xl flex-col items-center text-center">
        <div className="flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground">
          <WifiOff className="size-4" aria-hidden />
          Offline mode — no internet required
        </div>

        <div className="mt-10 flex size-24 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-[var(--shadow-kiosk)]">
          <ShieldCheck className="size-12" aria-hidden />
        </div>

        <h1 className="mt-8 text-5xl font-semibold tracking-tight sm:text-6xl">OneID</h1>
        <p className="mt-4 max-w-xl text-xl text-muted-foreground">
          Offline Aadhaar identity verification kiosk. Scan the Aadhaar Secure QR code and verify
          in seconds — everything stays on this device.
        </p>

        <button
          type="button"
          onClick={onStart}
          className="mt-12 inline-flex min-h-20 w-full max-w-md items-center justify-center gap-3 rounded-2xl bg-primary px-10 text-2xl font-semibold text-primary-foreground shadow-[var(--shadow-kiosk)] transition-transform active:scale-[0.98]"
        >
          <ScanLine className="size-8" aria-hidden />
          Start Verification
        </button>

        <div className="mt-12 grid w-full gap-4 sm:grid-cols-3">
          {[
            { icon: Lock, title: "Private by design", body: "No uploads, no cloud, no accounts." },
            { icon: WifiOff, title: "Works offline", body: "Zero network calls during verification." },
            { icon: ShieldCheck, title: "Session only", body: "Data is cleared after every person." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-5 text-left">
              <Icon className="size-6 text-primary" aria-hidden />
              <p className="mt-3 text-base font-semibold">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 max-w-2xl text-sm text-muted-foreground">
          Privacy notice: Aadhaar details are decoded locally in this device's memory and erased as
          soon as the session ends. Face comparison is an assistive check, not conclusive proof of
          identity.
        </p>
      </div>
    </div>
  );
}

