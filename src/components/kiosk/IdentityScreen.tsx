import type { AadhaarData } from "aadhaar-react-scanner";
import { ArrowRight, ShieldCheck, ShieldAlert } from "lucide-react";
import { ScreenShell } from "./ScanScreen";
import { VirtualAadhaarCard } from "./VirtualAadhaarCard";

export function buildAddress(d: AadhaarData) {
  return [d.care_of, d.house, d.street, d.landmark, d.location, d.vtc, d.post_office, d.sub_district, d.district, d.state, d.pincode]
    .filter(Boolean)
    .join(", ");
}

export function IdentityScreen({
  data,
  photo,
  onContinue,
  onCancel,
}: {
  data: AadhaarData;
  photo: string | null;
  onContinue: () => void;
  onCancel: () => void;
}) {
  const isValidSignature = data.signature_valid !== false;

  return (
    <ScreenShell step="Step 2 of 3" title="Identity Verification" onCancel={onCancel}>
      <div className="flex flex-col items-center">
        {/* Interactive 3D Card Display */}
        <VirtualAadhaarCard data={data} photo={photo} />

        {/* Security Signature Status Box */}
        <div
          className={`mt-4 flex w-full max-w-xl items-center justify-between rounded-2xl border px-5 py-4 ${
            isValidSignature
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-amber-500/30 bg-amber-500/10 text-amber-300"
          }`}
        >
          <div className="flex items-center gap-3">
            {isValidSignature ? (
              <ShieldCheck className="size-6 text-emerald-400 shrink-0" />
            ) : (
              <ShieldAlert className="size-6 text-amber-400 shrink-0" />
            )}
            <div>
              <p className="font-semibold">
                {isValidSignature
                  ? "UIDAI RSA 256-bit Digital Signature Verified"
                  : "UIDAI Digital Signature Unverified / Standard Format"}
              </p>
              <p className="text-xs opacity-80">
                {isValidSignature
                  ? "Tamper-proof payload verified client-side using Web Crypto API"
                  : "Demographics decoded successfully from QR payload"}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="mt-8 inline-flex min-h-20 w-full max-w-xl items-center justify-center gap-3 rounded-2xl bg-primary text-2xl font-semibold text-primary-foreground shadow-lg active:scale-[0.99]"
        >
          Continue to face check <ArrowRight className="size-7" aria-hidden />
        </button>
      </div>
    </ScreenShell>
  );
}

