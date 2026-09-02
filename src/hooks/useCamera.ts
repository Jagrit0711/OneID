import { useCallback, useEffect, useRef, useState } from "react";

export type CameraState = "idle" | "starting" | "ready" | "error" | "insecure_context" | "ip_cam";

export function useCamera(active: boolean, customStreamUrl?: string | null) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.removeAttribute("src");
    }
  }, []);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  useEffect(() => {
    let cancelled = false;
    if (!active) {
      stop();
      setState("idle");
      setErrorMessage(null);
      return;
    }

    setState("starting");
    setErrorMessage(null);

    // ── Mode A: Custom IP Camera / HTTP Video Stream URL ──
    if (customStreamUrl && customStreamUrl.trim() !== "") {
      const url = customStreamUrl.trim();
      stop();

      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;

      let animationFrameId: number = 0;

      const drawLoop = () => {
        if (cancelled) return;
        if (ctx && img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }
        animationFrameId = requestAnimationFrame(drawLoop);
      };

      try {
        const stream = canvas.captureStream ? canvas.captureStream(25) : null;
        if (stream && videoRef.current) {
          streamRef.current = stream;
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        } else if (videoRef.current) {
          videoRef.current.src = url;
          videoRef.current.play().catch(() => undefined);
        }
      } catch (err) {
        console.warn("Could not capture stream from canvas, fallback to direct src:", err);
        if (videoRef.current) {
          videoRef.current.src = url;
          videoRef.current.play().catch(() => undefined);
        }
      }

      drawLoop();
      setState("ready");

      return () => {
        cancelled = true;
        cancelAnimationFrame(animationFrameId);
        stop();
      };
    }

    // ── Mode B: Hardware WebCam / Mobile Camera via getUserMedia ──
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (!cancelled) {
        setState("insecure_context");
        setErrorMessage(
          "Camera disabled by browser on HTTP Network IP address. Use IP Cam URL or enable chrome://flags."
        );
      }
      return;
    }

    const getMediaStream = async () => {
      // For document/QR scanning on a desktop webcam (e.g. Logitech Brio 100):
      //  - No facingMode (front/back only makes sense on mobile; breaks desktop cam selection)
      //  - 1080p for dense Aadhaar Secure QR modules
      //  - environment facing is skipped intentionally for USB webcams
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch {
        return await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
    };

    /** After acquiring the stream, push continuous autofocus + close focus distance
     *  to help webcams like the Logitech Brio 100 lock onto a held-up card. */
    const applyFocusTweaks = (stream: MediaStream) => {
      const track = stream.getVideoTracks()[0];
      if (!track) return;

      const capabilities = track.getCapabilities?.() as Record<string, unknown> | undefined;
      if (!capabilities) return;

      const constraints: Record<string, unknown> = {};

      // Request continuous autofocus if the camera exposes the focusMode capability
      if (capabilities.focusMode) {
        const modes = capabilities.focusMode as string[];
        if (modes.includes("continuous")) {
          constraints.focusMode = "continuous";
        }
      }

      // Pull focus closer (0.0 = infinity, higher = closer); Brio 100 typical range ~0–1
      if (capabilities.focusDistance) {
        const range = capabilities.focusDistance as { min: number; max: number };
        // Target ~30 cm document distance — use 40% of the focusDistance range
        const closeDistance = range.min + (range.max - range.min) * 0.4;
        constraints.focusDistance = closeDistance;
      }

      if (Object.keys(constraints).length > 0) {
        track.applyConstraints({ advanced: [constraints as MediaTrackConstraintSet] }).catch(() => {
          // Not all browsers/drivers support advanced focus constraints — silently ignore
        });
      }
    };

    getMediaStream()
      .then(async (stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        // Apply focus tweaks after play so the track is fully active
        applyFocusTweaks(stream);
        setState("ready");
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Local device camera acquisition error:", err);
          setState("error");
          setErrorMessage(
            err instanceof Error ? err.message : "Could not access camera on this device."
          );
        }
      });

    return () => {
      cancelled = true;
      stop();
    };
  }, [active, attempt, customStreamUrl, stop]);

  return { videoRef, state, errorMessage, retry, stop };
}
