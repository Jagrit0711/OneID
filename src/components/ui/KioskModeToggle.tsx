import { useEffect, useState } from "react";
import { Maximize, Minimize, Monitor } from "lucide-react";

export function KioskModeToggle({ className = "" }: { className?: string }) {
  const [isKiosk, setIsKiosk] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    // Check local storage or URL query param ?kiosk=true
    const params = new URLSearchParams(window.location.search);
    const savedKiosk = localStorage.getItem("oneid_kiosk_mode") === "true" || params.get("kiosk") === "true";
    setIsKiosk(savedKiosk);

    if (savedKiosk) {
      document.documentElement.classList.add("kiosk-mode-active");
    }

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleKioskMode = async () => {
    const nextState = !isKiosk;
    setIsKiosk(nextState);
    localStorage.setItem("oneid_kiosk_mode", String(nextState));

    if (nextState) {
      document.documentElement.classList.add("kiosk-mode-active");
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // Fullscreen API may be blocked by browser policy until user gesture
      }
    } else {
      document.documentElement.classList.remove("kiosk-mode-active");
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
      } catch {
        // Ignore exit fullscreen errors
      }
    }
  };

  return (
    <button
      type="button"
      onClick={toggleKioskMode}
      title="Toggle 3.5-inch Raspberry Pi Kiosk Touch Mode"
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all active:scale-95 select-none ${
        isKiosk
          ? "border-amber-500/50 bg-amber-500/15 text-amber-300 shadow-lg shadow-amber-500/10"
          : "border-border/80 bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
      } ${className}`}
    >
      <Monitor className="size-3.5 text-amber-400" />
      <span>{isKiosk ? "3.5\" Pi Kiosk ON" : "Pi Kiosk Mode"}</span>
      {isFullscreen ? (
        <Minimize className="size-3 opacity-70" />
      ) : (
        <Maximize className="size-3 opacity-70" />
      )}
    </button>
  );
}
