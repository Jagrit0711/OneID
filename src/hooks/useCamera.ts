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

      if (videoRef.current) {
        videoRef.current.crossOrigin = "anonymous";
        videoRef.current.src = url;
        videoRef.current.play().catch(() => undefined);
      }

      setState("ready");
      return () => {
        cancelled = true;
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
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
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
