import { useEffect, useRef, useState, type ChangeEvent } from "react";
import jsQR from "jsqr";
import { decodeAadhaarQR, type AadhaarData } from "aadhaar-react-scanner";
import { QrCode, X, Upload, Sparkles } from "lucide-react";
import { useCamera } from "@/hooks/useCamera";
import { CameraFrame } from "./CameraFrame";
import { KioskModeToggle } from "@/components/ui/KioskModeToggle";

const DEMO_AADHAAR_DATA: AadhaarData = {
  name: "Suresh Kumar Sharma",
  dob: "15-08-1992",
  gender: "M",
  aadhaar_last4: "4921",
  care_of: "S/O Ramesh Kumar Sharma",
  house: "Plot 42, Floor 3",
  street: "Mahatma Gandhi Road",
  landmark: "Near Metro Station",
  location: "Connaught Place",
  vtc: "New Delhi",
  sub_district: "Central Delhi",
  district: "New Delhi",
  state: "Delhi",
  pincode: "110001",
  signature_valid: true,
};

export function ScanScreen({
  onDecoded,
  onCancel,
}: {
  onDecoded: (data: AadhaarData) => void;
  onCancel: () => void;
}) {
  const { videoRef, state, errorMessage, retry } = useCamera(true);
  const [status, setStatus] = useState("Hold the Aadhaar Secure QR code inside the frame");
  const [invalid, setInvalid] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const doneRef = useRef(false);

  // Real-time camera QR scanner loop
  useEffect(() => {
    if (state !== "ready") return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    let raf = 0;

    const detectFromImage = async (canvasElement: HTMLCanvasElement) => {
      // 1. Try Native BarcodeDetector API (fast hardware scanner in Chrome/Edge)
      const AnyWindow = window as unknown as {
        BarcodeDetector?: new (o?: { formats: string[] }) => {
          detect: (s: HTMLCanvasElement | HTMLImageElement) => Promise<Array<{ rawValue: string }>>;
        };
      };

      if (AnyWindow.BarcodeDetector) {
        try {
          const detector = new AnyWindow.BarcodeDetector({ formats: ["qr_code"] });
          const barcodes = await detector.detect(canvasElement);
          if (barcodes.length > 0 && barcodes[0]?.rawValue) {
            return barcodes[0].rawValue;
          }
        } catch {
          // fall through to jsQR
        }
      }

      // 2. Fallback to jsQR over canvas image data
      const image = ctx.getImageData(0, 0, canvasElement.width, canvasElement.height);
      const code = jsQR(image.data, canvasElement.width, canvasElement.height, {
        inversionAttempts: "attemptBoth",
      });
      return code?.data || null;
    };

    const tick = async () => {
      const video = videoRef.current;
      if (!doneRef.current && video && video.videoWidth > 0 && !busyRef.current) {
        // High resolution scanning to preserve dense module details of Aadhaar Secure QR
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const qrString = await detectFromImage(canvas);
        if (qrString) {
          busyRef.current = true;
          setStatus("Decoding Aadhaar Secure QR payload…");
          try {
            const result = await decodeAadhaarQR(qrString);
            if (result.success && result.data) {
              doneRef.current = true;
              onDecoded(result.data);
              return;
            }
          } catch {
            /* retry */
          }
          setInvalid(true);
          setStatus("QR detected but invalid Aadhaar format. Keep scanning…");
          setTimeout(() => {
            busyRef.current = false;
            setInvalid(false);
          }, 1200);
        }
      }
      raf = requestAnimationFrame(() => void tick());
    };

    void tick();
    return () => cancelAnimationFrame(raf);
  }, [state, videoRef, onDecoded]);

  // Handle uploaded image file fallback (for laptops/testing without camera focus)
  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("Processing uploaded image…");
    const reader = new FileReader();
    reader.onload = async (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);

        // Try native BarcodeDetector first, then jsQR
        let qrData: string | null = null;
        const AnyWindow = window as unknown as {
          BarcodeDetector?: new (o?: { formats: string[] }) => {
            detect: (s: HTMLImageElement) => Promise<Array<{ rawValue: string }>>;
          };
        };

        if (AnyWindow.BarcodeDetector) {
          try {
            const detector = new AnyWindow.BarcodeDetector({ formats: ["qr_code"] });
            const barcodes = await detector.detect(img);
            if (barcodes.length > 0 && barcodes[0]?.rawValue) {
              qrData = barcodes[0].rawValue;
            }
          } catch {
            /* ignore */
          }
        }

        if (!qrData) {
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          const code = jsQR(imageData.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
          qrData = code?.data || null;
        }

        if (qrData) {
          setStatus("Decoding uploaded QR code…");
          const result = await decodeAadhaarQR(qrData);
          if (result.success && result.data) {
            doneRef.current = true;
            onDecoded(result.data);
            return;
          }
        }

        setInvalid(true);
        setStatus("Could not read a valid Aadhaar QR from the uploaded image.");
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleUseDemo = () => {
    doneRef.current = true;
    onDecoded(DEMO_AADHAAR_DATA);
  };

  return (
    <ScreenShell step="Step 1 of 3" title="Scan Aadhaar Secure QR" onCancel={onCancel}>
      <CameraFrame
        videoRef={videoRef}
        state={state}
        errorMessage={errorMessage}
        onRetry={retry}
        overlay={
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="size-[68%] rounded-3xl border-4 border-emerald-500/80 shadow-2xl" />
          </div>
        }
      />

      <div
        className={`mt-4 flex items-center justify-center gap-3 rounded-2xl border px-6 py-4 text-center text-lg font-medium shadow-sm ${
          invalid
            ? "border-destructive/40 bg-destructive/10 text-destructive"
            : "border-border bg-card text-muted-foreground"
        }`}
        role="status"
      >
        <QrCode className="size-6 shrink-0" aria-hidden />
        <span>{status}</span>
      </div>

      {/* Alternative Input Options (Image Upload & Demo Mode for Localhost testing) */}
      <div className="mt-6 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex min-h-14 w-full flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-6 font-semibold text-slate-200 shadow-md transition-colors hover:bg-slate-800 active:scale-95 sm:w-auto"
        >
          <Upload className="size-5 text-emerald-400" />
          Upload QR Image / PDF
        </button>

        <button
          type="button"
          onClick={handleUseDemo}
          className="inline-flex min-h-14 w-full flex-1 items-center justify-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-950/40 px-6 font-semibold text-amber-300 shadow-md transition-colors hover:bg-amber-900/60 active:scale-95 sm:w-auto"
        >
          <Sparkles className="size-5 text-amber-400" />
          Try Sample Demo Card
        </button>
      </div>
    </ScreenShell>
  );
}

export function ScreenShell({
  step,
  title,
  onCancel,
  children,
}: {
  step: string;
  title: string;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-4 sm:px-6 sm:py-8 select-none">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">{step}</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <KioskModeToggle />
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel verification"
            className="inline-flex size-10 sm:size-12 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground active:scale-95 shrink-0"
          >
            <X className="size-5 sm:size-6" aria-hidden />
          </button>
        </div>
      </div>
      <div className="mt-4 sm:mt-8 flex-1">{children}</div>
    </div>
  );
}
