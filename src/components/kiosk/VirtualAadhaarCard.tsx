import { useRef, useState, type MouseEvent } from "react";
import type { AadhaarData } from "aadhaar-react-scanner";
import { ShieldCheck, ShieldAlert, CheckCircle2, User, Sparkles } from "lucide-react";
import { buildAddress } from "./IdentityScreen";

export function VirtualAadhaarCard({
  data,
  photo,
}: {
  data: AadhaarData;
  photo: string | null;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotX, setRotX] = useState(0);
  const [rotY, setRotY] = useState(0);
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -12;
    const rotateY = ((x - centerX) / centerX) * 12;

    setRotX(rotateX);
    setRotY(rotateY);
    setGlarePos({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 0.35,
    });
  };

  const handleMouseLeave = () => {
    setRotX(0);
    setRotY(0);
    setGlarePos((prev) => ({ ...prev, opacity: 0 }));
  };

  const isValidSignature = data.signature_valid !== false;

  return (
    <div className="perspective-1000 my-6 w-full max-w-xl">
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
          transition: rotX === 0 ? "transform 0.5s ease-out" : "none",
        }}
        className="relative overflow-hidden rounded-3xl border border-slate-700/60 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-6 text-slate-100 shadow-2xl transition-shadow duration-300 hover:shadow-cyan-500/10"
      >
        {/* Dynamic Holographic Glare Overlay */}
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 65%)`,
            opacity: glarePos.opacity,
          }}
        />

        {/* Tricolor India Accent Header */}
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-amber-500 via-white to-emerald-500" />

        {/* Card Header / Branding */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-red-600 font-bold text-white shadow-md">
              <Sparkles className="size-6" />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wider text-amber-400 uppercase">
                Government of India
              </p>
              <h2 className="text-lg font-bold tracking-tight text-white">Unique Identification Authority</h2>
            </div>
          </div>

          {/* Cryptographic Signature Badge */}
          <div
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${
              isValidSignature
                ? "border border-emerald-500/40 bg-emerald-950/60 text-emerald-300"
                : "border border-amber-500/40 bg-amber-950/60 text-amber-300"
            }`}
          >
            {isValidSignature ? (
              <>
                <ShieldCheck className="size-4 text-emerald-400" />
                <span>UIDAI RSA Verified</span>
              </>
            ) : (
              <>
                <ShieldAlert className="size-4 text-amber-400" />
                <span>Unverified Sig</span>
              </>
            )}
          </div>
        </div>

        {/* Card Content Body */}
        <div className="mt-5 flex flex-col gap-5 sm:flex-row">
          {/* Photo Frame */}
          <div className="relative flex size-36 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-amber-500/40 bg-slate-800 shadow-inner">
            {photo ? (
              <img
                src={photo}
                alt={`Aadhaar photograph of ${data.name || "holder"}`}
                className="size-full object-cover"
              />
            ) : (
              <User className="size-16 text-slate-400" />
            )}
            {isValidSignature && (
              <div className="absolute right-1 bottom-1 rounded-full bg-emerald-500 p-1 text-slate-950 shadow-md">
                <CheckCircle2 className="size-4 stroke-[3]" />
              </div>
            )}
          </div>

          {/* Holder Metadata */}
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                Name / Resident
              </p>
              <p className="text-xl font-bold tracking-wide text-white">{data.name || "Not Available"}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  DOB / Year
                </p>
                <p className="font-semibold text-slate-200">{data.dob || "N/A"}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  Gender
                </p>
                <p className="font-semibold text-slate-200">{data.gender || "N/A"}</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                Aadhaar Number
              </p>
              <p className="font-mono text-lg font-bold tracking-widest text-amber-300">
                {data.aadhaar_last4 ? `XXXX XXXX ${data.aadhaar_last4}` : "XXXX XXXX XXXX"}
              </p>
            </div>
          </div>
        </div>

        {/* Address Footer Section */}
        <div className="mt-4 rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 text-xs leading-relaxed text-slate-300">
          <span className="font-semibold text-slate-400">Address: </span>
          {buildAddress(data) || "Address encrypted / extracted from secure QR"}
        </div>

        {/* Card Interactive Footer Hint */}
        <div className="mt-3 flex items-center justify-between text-[11px] font-medium text-slate-400">
          <span>Mera Aadhaar, Meri Pehchan</span>
          <span className="flex items-center gap-1 text-slate-400">
            <Sparkles className="size-3 text-amber-400" /> Interactive 3D Card
          </span>
        </div>
      </div>
    </div>
  );
}
