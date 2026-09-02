import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AadhaarData } from "aadhaar-react-scanner";
import {
  ShieldCheck,
  ScanLine,
  UserCheck,
  CheckCircle2,
  XCircle,
  FileText,
  CreditCard,
  Car,
  Home,
  GraduationCap,
  LogOut,
  User,
  Lock,
  ArrowRight,
  Eye,
  Clock,
  Fingerprint,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { ScanScreen } from "@/components/kiosk/ScanScreen";
import { IdentityScreen } from "@/components/kiosk/IdentityScreen";
import { FaceScreen, type FaceOutcome } from "@/components/kiosk/FaceScreen";
import { ResultScreen } from "@/components/kiosk/ResultScreen";
import { OneIdLogo } from "@/components/brand/OneIdLogo";
import { DocPreviewer } from "@/components/ui/DocPreviewer";
import {
  addSuperAuditLog,
  addCitizenAccessEntry,
  getUserVault,
  upsertOfficialFromAadhaar,
  incrementOfficialVerifications,
  getTerminalId,
  type DocType,
  type UserDocument,
} from "@/lib/kiosk-store";

export const Route = createFileRoute("/kiosk")({
  head: () => ({
    meta: [
      { title: "OneID Kiosk Terminal — Official Verification" },
      {
        name: "description",
        content:
          "Secure official verification kiosk terminal with Aadhaar QR scan, biometric face match, and document unlock.",
      },
    ],
  }),
  component: KioskTerminal,
});

// ── Types ──────────────────────────────────────────────────────────────────────

type OfficialAuthStage =
  | "scan"
  | "identity"
  | "face"
  | "success_banner"
  | "authenticated";
type KioskStage =
  | "idle"
  | "scan"
  | "identity"
  | "doc_selection"
  | "citizen_face"
  | "result";

const ALL_DOC_TYPES: Array<{
  type: DocType;
  label: string;
  icon: typeof CreditCard;
}> = [
  { type: "pan", label: "PAN Card", icon: CreditCard },
  { type: "driving_license", label: "Driving License", icon: Car },
  { type: "ration_card", label: "Ration Card", icon: Home },
  { type: "marksheet", label: "Board Marksheet", icon: GraduationCap },
];

// ── Idle Clock Component ───────────────────────────────────────────────────────

function IdleClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="tabular-nums font-mono text-white/40 text-sm">
      {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      &nbsp;·&nbsp;
      {now.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
    </div>
  );
}

// ── Auto-reset countdown ───────────────────────────────────────────────────────

function AutoResetBanner({ onReset }: { onReset: () => void }) {
  const [countdown, setCountdown] = useState(30);
  useEffect(() => {
    if (countdown <= 0) { onReset(); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, onReset]);
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border border-white/20 bg-slate-900/90 px-5 py-3 text-sm font-semibold text-white/80 backdrop-blur-md shadow-2xl">
      <RotateCcw className="size-4 text-amber-400 animate-spin" style={{ animationDuration: "2s" }} />
      Terminal resets in <span className="text-amber-400 font-bold">{countdown}s</span>
      <button
        type="button"
        onClick={onReset}
        className="ml-2 rounded-xl bg-amber-500/20 px-3 py-1 text-amber-300 hover:bg-amber-500/30 transition-colors"
      >
        Reset Now
      </button>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

function KioskTerminal() {
  const navigate = useNavigate();

  // Official auth
  const [authStage, setAuthStage] = useState<OfficialAuthStage>("scan");
  const [officialData, setOfficialData] = useState<AadhaarData | null>(null);
  const [officialAuthError, setOfficialAuthError] = useState<string | null>(null);

  // Citizen kiosk flow
  const [kioskStage, setKioskStage] = useState<KioskStage>("idle");
  const [citizenData, setCitizenData] = useState<AadhaarData | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<Record<DocType, boolean>>({
    pan: true,
    driving_license: true,
    ration_card: false,
    marksheet: false,
  });
  const [citizenFaceOutcome, setCitizenFaceOutcome] = useState<FaceOutcome | null>(null);
  const [showAutoReset, setShowAutoReset] = useState(false);

  // Photos
  const officialPhoto = useMemo(
    () =>
      officialData?.photo_base64
        ? `data:${officialData.photo_mime || "image/jpeg"};base64,${officialData.photo_base64}`
        : null,
    [officialData]
  );
  const citizenPhoto = useMemo(
    () =>
      citizenData?.photo_base64
        ? `data:${citizenData.photo_mime || "image/jpeg"};base64,${citizenData.photo_base64}`
        : null,
    [citizenData]
  );

  // Citizen vault for doc status
  const citizenVault = useMemo<UserDocument[]>(() => {
    if (!citizenData) return [];
    return getUserVault(citizenData.reference_id || citizenData.name || "citizen");
  }, [citizenData]);

  // ── Official Login ──

  const handleOfficialDecoded = useCallback((decoded: AadhaarData) => {
    setOfficialData(decoded);
    setOfficialAuthError(null);
    setAuthStage("identity");
  }, []);

  const handleOfficialFaceDone = useCallback(
    (outcome: FaceOutcome) => {
      if (outcome.verified) {
        setOfficialAuthError(null);
        setAuthStage("success_banner");
        // Register official in registry
        const tail = officialData?.reference_id?.slice(-4) || "0000";
        upsertOfficialFromAadhaar(tail, officialData?.name || "Official");
      } else {
        setOfficialAuthError(
          outcome.reason ||
            `Biometric Check Failed (${outcome.match}% Match). Access Denied.`
        );
        setAuthStage("scan");
      }
    },
    [officialData]
  );

  const resetOfficialAuth = useCallback(() => {
    setOfficialData(null);
    setOfficialAuthError(null);
    if (authStage === "scan") navigate({ to: "/" });
    else setAuthStage("scan");
  }, [authStage, navigate]);

  // ── Citizen Kiosk ──

  const resetCitizenKiosk = useCallback(() => {
    setCitizenData(null);
    setCitizenFaceOutcome(null);
    setShowAutoReset(false);
    setSelectedDocs({ pan: true, driving_license: true, ration_card: false, marksheet: false });
    setKioskStage("idle");
  }, []);

  const handleCitizenDecoded = useCallback((decoded: AadhaarData) => {
    setCitizenData(decoded);
    setKioskStage("identity");
  }, []);

  const toggleDocSelection = (type: DocType) =>
    setSelectedDocs((p) => ({ ...p, [type]: !p[type] }));

  const handleCitizenFaceDone = useCallback(
    (result: FaceOutcome) => {
      setCitizenFaceOutcome(result);
      setKioskStage("result");
      setShowAutoReset(true);

      if (citizenData && officialData) {
        const citizenKey = citizenData.reference_id || citizenData.name || "citizen";
        const accessedDocs = [
          { type: "aadhaar", label: "Aadhaar Demographics & Photo" },
          ...ALL_DOC_TYPES.filter(({ type }) => selectedDocs[type]).map(({ type, label }) => ({
            type,
            label,
            docNumber: citizenVault.find((d) => d.type === type && d.allowedForVerification)?.docNumber,
          })),
        ];
        const maskedUid = citizenData.reference_id
          ? `XXXX-XXXX-${citizenData.reference_id.slice(-4)}`
          : "XXXX-XXXX-XXXX";
        const officialAadhaarTail = officialData.reference_id?.slice(-4) || "0000";
        const officialId = `OFF-${officialAadhaarTail}`;

        // Write super audit log
        addSuperAuditLog({
          officialId,
          officialName: `Officer ${officialData.name || "Official"}`,
          officialAadhaarTail,
          citizenName: citizenData.name || "Citizen",
          citizenUid: maskedUid,
          faceMatchScore: result.match,
          faceVerified: result.verified,
          signatureValid: citizenData.signature_valid !== false,
          accessedDocuments: accessedDocs,
          location: `Terminal ${getTerminalId()}`,
        });

        // Write citizen access log
        addCitizenAccessEntry(citizenKey, {
          officialId,
          officialName: `Officer ${officialData.name || "Official"}`,
          location: `Terminal ${getTerminalId()}`,
          accessedDocuments: accessedDocs,
          faceVerified: result.verified,
          faceMatchScore: result.match,
        });

        // Increment official stats
        incrementOfficialVerifications(officialAadhaarTail);
      }
    },
    [citizenData, officialData, selectedDocs, citizenVault]
  );

  // ── Render: Official Auth Screens ──────────────────────────────────────────

  if (authStage === "scan") {
    return (
      <div className="min-h-screen bg-background select-none">
        <header className="border-b border-border bg-card/60 px-6 py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <OneIdLogo size="sm" />
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Kiosk Terminal
              </span>
            </Link>
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400">
                Step 1 of 3 · Official Authentication
              </span>
            </div>
          </div>
        </header>
        <div className="py-6">
          {officialAuthError && (
            <div className="mx-auto mb-4 max-w-md rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-center text-sm font-semibold text-red-400">
              <AlertTriangle className="mx-auto mb-2 size-5" />
              {officialAuthError}
            </div>
          )}
          <ScanScreen onDecoded={handleOfficialDecoded} onCancel={resetOfficialAuth} />
        </div>
      </div>
    );
  }

  if (authStage === "identity" && officialData) {
    return (
      <div className="min-h-screen bg-background select-none">
        <header className="border-b border-border bg-card/60 px-6 py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <span className="text-lg font-bold text-foreground">OneID Kiosk Terminal</span>
            <span className="text-xs text-muted-foreground">Step 2 of 3 · Confirm Officer Identity</span>
          </div>
        </header>
        <div className="py-6">
          <IdentityScreen
            data={officialData}
            photo={officialPhoto}
            onContinue={() => setAuthStage("face")}
            onCancel={resetOfficialAuth}
          />
        </div>
      </div>
    );
  }

  if (authStage === "face") {
    return (
      <div className="min-h-screen bg-background select-none">
        <header className="border-b border-border bg-card/60 px-6 py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <span className="text-lg font-bold text-foreground">OneID Kiosk Terminal</span>
            <span className="text-xs text-muted-foreground">Step 3 of 3 · Biometric Officer Verification</span>
          </div>
        </header>
        <div className="py-6">
          <FaceScreen photo={officialPhoto} onDone={handleOfficialFaceDone} onCancel={resetOfficialAuth} />
        </div>
      </div>
    );
  }

  if (authStage === "success_banner" && officialData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12 select-none text-center">
        <div className="w-full max-w-lg rounded-3xl border border-emerald-500/40 bg-card p-8 shadow-2xl">
          <div className="flex justify-center">
            <div className="flex size-20 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-4 ring-emerald-500/30">
              <CheckCircle2 className="size-12" />
            </div>
          </div>
          <h1 className="mt-6 text-3xl font-bold text-emerald-400">Authentication Successful!</h1>
          <p className="mt-2 text-lg font-semibold text-foreground">
            Welcome, Officer {officialData.name}
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            Terminal: {getTerminalId()} · OFF-
            {officialData.reference_id?.slice(-4) ?? "0000"}
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-300">
            <ShieldCheck className="size-5 shrink-0" />
            <span>Identity confirmed via InsightFace ArcFace 512-dim neural match.</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setAuthStage("authenticated");
              setKioskStage("idle");
            }}
            className="mt-8 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-lg font-bold text-slate-950 shadow-lg hover:bg-emerald-400 transition-transform active:scale-[0.98]"
          >
            Enter Kiosk Terminal <ArrowRight className="size-5" />
          </button>
        </div>
      </div>
    );
  }

  // ── Authenticated Kiosk Dashboard ──────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-foreground select-none">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center">
              <OneIdLogo size="sm" />
            </Link>
            <div className="h-5 w-px bg-border" />
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              Kiosk Terminal · {getTerminalId()}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <IdleClock />
            <div className="flex items-center gap-2.5 text-sm font-medium">
              <div className="size-8 overflow-hidden rounded-full border border-emerald-500/40 bg-slate-800">
                {officialPhoto ? (
                  <img src={officialPhoto} alt={officialData?.name} className="size-full object-cover" />
                ) : (
                  <User className="size-full p-1.5 text-slate-400" />
                )}
              </div>
              <div>
                <p className="font-bold leading-none text-foreground text-sm">
                  Officer {officialData?.name || "Official"}
                </p>
                <p className="text-[10px] text-emerald-400 font-semibold">
                  OFF-{officialData?.reference_id?.slice(-4) ?? "0000"} · Active ✓
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={resetOfficialAuth}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors"
            >
              <LogOut className="size-3.5" /> End Session
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {/* ── Idle Screen ── */}
        {kioskStage === "idle" && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="relative mb-8">
              <div className="flex size-32 items-center justify-center rounded-full bg-gradient-to-br from-saffron/20 to-celadon/20 ring-4 ring-saffron/20 shadow-2xl">
                <Fingerprint className="size-16 text-saffron animate-pulse" />
              </div>
              <div className="absolute -inset-4 rounded-full border border-saffron/10 animate-ping" style={{ animationDuration: "2.5s" }} />
            </div>
            <h1 className="font-display text-4xl font-bold tracking-tight text-ivory">
              Kiosk Ready
            </h1>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground leading-relaxed">
              Scan a citizen's Aadhaar QR code to begin identity verification. All sessions are biometrically logged.
            </p>
            <button
              type="button"
              onClick={() => setKioskStage("scan")}
              className="mt-10 inline-flex min-h-16 w-64 items-center justify-center gap-3 rounded-3xl bg-saffron text-lg font-bold text-ink shadow-xl hover:bg-amber-400 transition-all active:scale-[0.97]"
            >
              <ScanLine className="size-6" /> Scan Citizen QR
            </button>
            <div className="mt-6 text-xs text-white/30">
              Authenticated as: Officer {officialData?.name || "Official"} · Terminal {getTerminalId()}
            </div>
          </div>
        )}

        {/* ── Citizen Scan ── */}
        {kioskStage === "scan" && (
          <ScanScreen onDecoded={handleCitizenDecoded} onCancel={resetCitizenKiosk} />
        )}

        {/* ── Citizen Identity Review ── */}
        {kioskStage === "identity" && citizenData && (
          <div className="space-y-6">
            <IdentityScreen
              data={citizenData}
              photo={citizenPhoto}
              onContinue={() => setKioskStage("doc_selection")}
              onCancel={resetCitizenKiosk}
            />
          </div>
        )}

        {/* ── Document Selection ── */}
        {kioskStage === "doc_selection" && citizenData && (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="w-full max-w-2xl rounded-3xl border border-border bg-card p-8 shadow-xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary">
                <Eye className="size-4" /> Document Inspection Selection
              </div>

              <h2 className="mt-4 text-2xl font-bold">Select Documents to Inspect</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose which citizen documents you need. Only selected &amp; permitted docs unlock after face verification.
              </p>

              <div className="mt-6 space-y-3 text-left">
                {/* Always-included Aadhaar */}
                <div className="flex items-center justify-between rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
                  <div className="flex items-center gap-3">
                    <FileText className="size-5 text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-foreground">Aadhaar Demographics &amp; Photo</p>
                      <p className="text-xs text-muted-foreground">Decoded directly from Aadhaar Secure QR</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300">
                    Always Included ✓
                  </span>
                </div>

                {ALL_DOC_TYPES.map(({ type, label, icon: Icon }) => {
                  const isSelected = selectedDocs[type];
                  const vaultDoc = citizenVault.find((d) => d.type === type);
                  const isUploaded = !!vaultDoc;
                  const isPermitted = vaultDoc?.allowedForVerification;

                  return (
                    <div
                      key={type}
                      onClick={() => toggleDocSelection(type)}
                      className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition-all ${
                        isSelected ? "border-primary bg-primary/5" : "border-border bg-muted/20 opacity-70"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleDocSelection(type)}
                          className="size-4 rounded border-input accent-primary"
                        />
                        <Icon className="size-5 text-primary shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-foreground">{label}</p>
                          <p className="text-xs text-muted-foreground">
                            {isUploaded
                              ? isPermitted
                                ? `Uploaded — ${vaultDoc.docNumber || "Copy attached"}`
                                : "Uploaded but Restricted by Citizen 🔒"
                              : "Not uploaded in Citizen Vault"}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          isUploaded
                            ? isPermitted
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-amber-500/15 text-amber-400"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {isUploaded ? (isPermitted ? "Permitted ✓" : "Restricted 🔒") : "Not Uploaded"}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={resetCitizenKiosk}
                  className="min-h-14 flex-1 rounded-2xl border border-border font-semibold text-muted-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setKioskStage("citizen_face")}
                  className="min-h-14 flex-[2] inline-flex items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-bold text-primary-foreground shadow-lg hover:bg-primary/90 transition-transform active:scale-[0.98]"
                >
                  Proceed to Face Verification <ArrowRight className="size-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Citizen Face Verification ── */}
        {kioskStage === "citizen_face" && (
          <FaceScreen photo={citizenPhoto} onDone={handleCitizenFaceDone} onCancel={resetCitizenKiosk} />
        )}

        {/* ── Result + Document Unlock ── */}
        {kioskStage === "result" && citizenFaceOutcome && (
          <div className="space-y-6">
            <ResultScreen
              outcome={citizenFaceOutcome}
              name={citizenData?.name}
              signatureValid={citizenData?.signature_valid}
              onRetry={() => {
                setCitizenFaceOutcome(null);
                setKioskStage("citizen_face");
                setShowAutoReset(false);
              }}
              onContinue={resetCitizenKiosk}
            />

            {citizenFaceOutcome.verified && (
              <div className="mx-auto max-w-3xl rounded-3xl border border-emerald-500/40 bg-card p-6 shadow-xl text-left">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                  <Lock className="size-4" /> Biometrically Unlocked Inspection Viewer
                </div>
                <h3 className="mt-1 text-xl font-bold">Selected Documents</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Only requested documents permitted by {citizenData?.name || "Citizen"} are shown.
                </p>

                <div className="mt-6 space-y-4">
                  {/* Always show Aadhaar data */}
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">
                      <FileText className="size-4" /> Aadhaar Demographics
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-xs text-muted-foreground">Name</span><p className="font-bold">{citizenData?.name}</p></div>
                      <div><span className="text-xs text-muted-foreground">DOB</span><p className="font-bold">{citizenData?.dob}</p></div>
                      <div><span className="text-xs text-muted-foreground">Gender</span><p className="font-bold">{citizenData?.gender}</p></div>
                      <div><span className="text-xs text-muted-foreground">Aadhaar</span><p className="font-mono font-bold">XXXX-XXXX-{citizenData?.aadhaar_last4 || citizenData?.reference_id?.slice(-4)}</p></div>
                    </div>
                    {citizenPhoto && (
                      <div className="mt-3 flex items-center gap-3">
                        <img src={citizenPhoto} alt="Citizen" className="size-16 rounded-xl object-cover border border-border" />
                        <span className="text-xs text-muted-foreground">Aadhaar QR Photo · JP2 Format</span>
                      </div>
                    )}
                  </div>

                  {ALL_DOC_TYPES.filter(({ type }) => selectedDocs[type]).map(({ type, label }) => {
                    const vaultDoc = citizenVault.find((d) => d.type === type);
                    const isAvailable = !!(vaultDoc && vaultDoc.allowedForVerification);
                    return (
                      <DocPreviewer
                        key={type}
                        title={label}
                        docNumber={vaultDoc?.docNumber}
                        fileName={vaultDoc?.fileName}
                        fileUrl={isAvailable ? vaultDoc?.fileUrl : undefined}
                        allowed={isAvailable}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {!citizenFaceOutcome.verified && (
              <div className="mx-auto max-w-2xl rounded-3xl border border-red-500/30 bg-red-500/5 p-6 text-center">
                <XCircle className="mx-auto size-12 text-red-400 mb-3" />
                <h3 className="text-lg font-bold text-red-400">Document Access Denied</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Face verification failed. No citizen documents can be displayed.
                </p>
              </div>
            )}

            {showAutoReset && <AutoResetBanner onReset={resetCitizenKiosk} />}
          </div>
        )}
      </main>
    </div>
  );
}
