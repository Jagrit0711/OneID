import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState, type ChangeEvent } from "react";
import type { AadhaarData } from "aadhaar-react-scanner";
import {
  ShieldCheck,
  Upload,
  User,
  LogOut,
  CreditCard,
  Car,
  Home,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  Server,
  ArrowLeft,
  ScanLine,
  Lock,
} from "lucide-react";
import { ScanScreen } from "@/components/kiosk/ScanScreen";
import { IdentityScreen, buildAddress } from "@/components/kiosk/IdentityScreen";
import { FaceScreen, type FaceOutcome } from "@/components/kiosk/FaceScreen";
import { OneIdLogo } from "@/components/brand/OneIdLogo";
import { DocPreviewer } from "@/components/ui/DocPreviewer";
import { KioskModeToggle } from "@/components/ui/KioskModeToggle";
import {
  getUserVault,
  saveUserDocument,
  toggleDocumentPermission,
  type DocType,
  type UserDocument,
} from "@/lib/kiosk-store";

export const Route = createFileRoute("/user")({
  head: () => ({
    meta: [
      { title: "Citizen Document Vault — OneID" },
      { name: "description", content: "Aadhaar-authenticated document vault for PAN, Driving License, Ration Card, and Marksheets." },
    ],
  }),
  component: CitizenPortal,
});

const DOC_CONFIGS: Record<
  DocType,
  { title: string; icon: typeof CreditCard; placeholder: string; category: string }
> = {
  pan: {
    title: "PAN Card",
    icon: CreditCard,
    placeholder: "e.g. ABCDE1234F",
    category: "Financial Identity",
  },
  driving_license: {
    title: "Driving License",
    icon: Car,
    placeholder: "e.g. DL-1420110098765",
    category: "Transport & Photo ID",
  },
  ration_card: {
    title: "Ration Card",
    icon: Home,
    placeholder: "e.g. RC-9876543210",
    category: "Household & Family",
  },
  marksheet: {
    title: "Board Marksheet (10th/12th)",
    icon: GraduationCap,
    placeholder: "e.g. CBSE-2022-7654321",
    category: "Educational Qualification",
  },
};

type AuthStage = "scan" | "identity" | "face" | "authenticated";

function CitizenPortal() {
  const [authStage, setAuthStage] = useState<AuthStage>("scan");
  const [data, setData] = useState<AadhaarData | null>(null);
  const [faceOutcome, setFaceOutcome] = useState<FaceOutcome | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // User Vault State
  const [vault, setVault] = useState<UserDocument[]>([]);
  const [editingDoc, setEditingDoc] = useState<DocType | null>(null);
  const [inputNumber, setInputNumber] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const citizenKey = useMemo(() => {
    if (!data) return "";
    return data.reference_id || data.name || "citizen";
  }, [data]);

  const photo = useMemo(() => {
    if (!data?.photo_base64) return null;
    return `data:${data.photo_mime || "image/jpeg"};base64,${data.photo_base64}`;
  }, [data]);

  const handleDecoded = useCallback((decoded: AadhaarData) => {
    setData(decoded);
    setAuthError(null);
    setAuthStage("identity");
  }, []);

  const handleFaceDone = useCallback((outcome: FaceOutcome) => {
    setFaceOutcome(outcome);
    if (outcome.verified) {
      setAuthStage("authenticated");
      setAuthError(null);
      if (data) {
        const key = data.reference_id || data.name || "citizen";
        setVault(getUserVault(key));
      }
    } else {
      setAuthError(
        outcome.reason ||
          `InsightFace ArcFace Biometric Verification Failed (${outcome.match}% Match). Face did not match the scanned Aadhaar QR photograph.`
      );
      setAuthStage("scan");
    }
  }, [data]);

  const navigate = useNavigate();

  const resetAuth = useCallback(() => {
    setData(null);
    setFaceOutcome(null);
    setAuthError(null);
    if (authStage === "scan") {
      navigate({ to: "/" });
    } else {
      setAuthStage("scan");
    }
  }, [authStage, navigate]);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>, type: DocType) => {
    const file = e.target.files?.[0];
    if (!file || !citizenKey) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const fileUrl = event.target?.result as string;
      const existing = vault.find((d) => d.type === type);

      const newDoc: UserDocument = {
        id: existing?.id || `doc-${type}-${Date.now()}`,
        type,
        title: DOC_CONFIGS[type].title,
        docNumber: inputNumber || existing?.docNumber || "",
        fileName: file.name,
        fileUrl,
        updatedAt: new Date().toISOString(),
        allowedForVerification: existing ? existing.allowedForVerification : true,
      };

      const updated = saveUserDocument(citizenKey, newDoc);
      setVault(updated);
      setEditingDoc(null);
      setInputNumber("");
      setUploadSuccess(`Saved copy of ${DOC_CONFIGS[type].title}!`);
      setTimeout(() => setUploadSuccess(null), 4000);
    };
    reader.readAsDataURL(file);
  };

  const handlePermissionToggle = (type: DocType) => {
    if (!citizenKey) return;
    const updated = toggleDocumentPermission(citizenKey, type);
    setVault(updated);
  };

  // ── Authentication Stages ──

  if (authStage === "scan") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/60 px-6 py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <Link to="/" className="flex items-center">
              <OneIdLogo size="sm" />
            </Link>
            <span className="text-xs text-muted-foreground">Step 1: Scan Aadhaar Card to Login</span>
          </div>
        </header>
        <div className="py-6">
          {authError && (
            <div className="mx-auto max-w-md rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-center text-sm font-semibold text-red-400 mb-4">
              {authError}
            </div>
          )}
          <ScanScreen onDecoded={handleDecoded} onCancel={resetAuth} />
        </div>
      </div>
    );
  }

  if (authStage === "identity" && data) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/60 px-6 py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <span className="text-lg font-bold text-foreground">OneID Citizen Vault</span>
            <span className="text-xs text-muted-foreground">Step 2: Confirm Aadhaar Card</span>
          </div>
        </header>
        <div className="py-6">
          <IdentityScreen
            data={data}
            photo={photo}
            onContinue={() => setAuthStage("face")}
            onCancel={resetAuth}
          />
        </div>
      </div>
    );
  }

  if (authStage === "face") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/60 px-6 py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <span className="text-lg font-bold text-foreground">OneID Citizen Vault</span>
            <span className="text-xs text-muted-foreground">Step 3: Biometric Face Verification</span>
          </div>
        </header>
        <div className="py-6">
          <FaceScreen photo={photo} onDone={handleFaceDone} onCancel={resetAuth} />
        </div>
      </div>
    );
  }

  // ── Authenticated Citizen Vault View ──

  return (
    <div className="min-h-screen bg-background text-foreground select-none">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center">
              <OneIdLogo size="sm" />
            </Link>
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
              Verified Citizen Vault
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5 text-sm font-medium">
              <div className="size-9 overflow-hidden rounded-full border border-emerald-500/40 bg-slate-800 shadow-inner">
                {photo ? (
                  <img src={photo} alt={data?.name} className="size-full object-cover" />
                ) : (
                  <User className="size-full p-1.5 text-slate-400" />
                )}
              </div>
              <div>
                <p className="font-bold leading-none text-foreground">{data?.name || "Citizen"}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Aadhaar Authenticated ✓</p>
              </div>
            </div>
            <KioskModeToggle />
            <button
              type="button"
              onClick={resetAuth}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors"
            >
              <LogOut className="size-3.5" /> Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-6 py-10">
        {/* Citizen Banner */}
        <div className="flex flex-col justify-between gap-6 rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-card to-card p-8 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <Sparkles className="size-4" /> Authenticated Citizen Vault
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{data?.name || "Citizen"}'s Locker</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Aadhaar: <span className="font-mono text-foreground font-semibold">{data?.reference_id ? `XXXX-XXXX-${data.reference_id.slice(-4)}` : "Verified"}</span> · DOB: {data?.dob || "N/A"} · Address: {data ? buildAddress(data) : "Decoded from Card"}
            </p>
          </div>

          <Link
            to="/official"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-secondary px-5 py-3 text-sm font-semibold text-secondary-foreground hover:bg-secondary/80"
          >
            Switch to Official Kiosk
          </Link>
        </div>

        {/* Upload Success Alert */}
        {uploadSuccess && (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-4 text-emerald-300">
            <CheckCircle2 className="size-5 shrink-0" />
            <span className="text-sm font-semibold">{uploadSuccess}</span>
          </div>
        )}

        {/* Future Server Sync Notice */}
        <div className="mt-8 flex items-center justify-between rounded-2xl border border-border bg-card px-6 py-4">
          <div className="flex items-center gap-3">
            <Server className="size-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-semibold">Government API &amp; DigiLocker Integration Hook</p>
              <p className="text-xs text-muted-foreground">
                Documents uploaded below are saved under your unique Aadhaar key ({citizenKey}). DigiLocker auto-fetch ready.
              </p>
            </div>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">
            Dynamic Storage
          </span>
        </div>

        {/* Document Cards Grid */}
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {(["pan", "driving_license", "ration_card", "marksheet"] as DocType[]).map((type) => {
            const config = DOC_CONFIGS[type];
            const Icon = config.icon;
            const doc = vault.find((d) => d.type === type);
            const isUploaded = !!doc;

            return (
              <div
                key={type}
                className={`relative flex flex-col justify-between rounded-3xl border p-6 transition-all duration-300 ${
                  isUploaded ? "border-emerald-500/40 bg-card shadow-sm" : "border-border bg-card/60"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex size-12 items-center justify-center rounded-2xl ${
                        isUploaded ? "bg-emerald-500/15 text-emerald-400" : "bg-secondary text-muted-foreground"
                      }`}>
                        <Icon className="size-6" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {config.category}
                        </p>
                        <h3 className="text-lg font-bold text-foreground">{config.title}</h3>
                      </div>
                    </div>

                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      isUploaded ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
                    }`}>
                      {isUploaded ? "Saved" : "Not Uploaded"}
                    </span>
                  </div>

                  {isUploaded && editingDoc !== type ? (
                    <div className="mt-4">
                      <DocPreviewer
                        title={config.title}
                        docNumber={doc.docNumber}
                        fileName={doc.fileName}
                        fileUrl={doc.fileUrl}
                        allowed={doc.allowedForVerification}
                      />
                    </div>
                  ) : (
                    <div className="mt-6 space-y-4 rounded-2xl border border-border bg-muted/20 p-4">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground">Document Number</label>
                        <input
                          type="text"
                          defaultValue={doc?.docNumber || ""}
                          onChange={(e) => setInputNumber(e.target.value)}
                          placeholder={config.placeholder}
                          className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-muted-foreground">Upload File (PNG, JPG, PDF)</label>
                        <label className="mt-1.5 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-xs font-semibold text-primary hover:bg-primary/10">
                          <Upload className="size-4" /> Choose File to Store
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={(e) => handleFileUpload(e, type)}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                  <button
                    type="button"
                    onClick={() => handlePermissionToggle(type)}
                    className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <div className={`size-4 rounded-full border transition-colors ${
                      doc?.allowedForVerification ? "border-emerald-500 bg-emerald-500" : "border-slate-600 bg-transparent"
                    }`} />
                    <span>Allow Verifier Inspection</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingDoc(editingDoc === type ? null : type)}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    {editingDoc === type ? "Cancel" : isUploaded ? "Update File" : "Upload Copy"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
