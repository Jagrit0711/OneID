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
  CheckCircle2,
  ArrowLeft,
  Eye,
  EyeOff,
  History,
  AlertTriangle,
  FileText,
  Clock,
  MapPin,
  RefreshCw,
  Sparkles,
  Lock,
  Unlock,
} from "lucide-react";
import { ScanScreen } from "@/components/kiosk/ScanScreen";
import { IdentityScreen, buildAddress } from "@/components/kiosk/IdentityScreen";
import { FaceScreen, type FaceOutcome } from "@/components/kiosk/FaceScreen";
import { OneIdLogo } from "@/components/brand/OneIdLogo";
import { DocPreviewer } from "@/components/ui/DocPreviewer";
import {
  getUserVault,
  saveUserDocument,
  toggleDocumentPermission,
  getCitizenAccessLog,
  encodeDocumentImage,
  type DocType,
  type UserDocument,
  type CitizenAccessEntry,
} from "@/lib/kiosk-store";

export const Route = createFileRoute("/consumer")({
  head: () => ({
    meta: [
      { title: "OneID Consumer App — Citizen Document Vault" },
      {
        name: "description",
        content:
          "Your personal identity vault. Upload PAN, Driving License, Ration Card and Marksheets. Control who can view your documents.",
      },
    ],
  }),
  component: ConsumerApp,
});

// ── Doc Configurations ─────────────────────────────────────────────────────────

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
type TabId = "vault" | "access_log";

// ── Access Log Card ────────────────────────────────────────────────────────────

function AccessLogCard({ entry }: { entry: CitizenAccessEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`rounded-2xl border bg-card p-4 transition-all duration-200 cursor-pointer ${
        entry.faceVerified
          ? "border-emerald-500/30 hover:border-emerald-500/60"
          : "border-red-500/30 hover:border-red-500/50"
      }`}
      onClick={() => setExpanded((e) => !e)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
              entry.faceVerified ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
            }`}
          >
            {entry.faceVerified ? <CheckCircle2 className="size-5" /> : <AlertTriangle className="size-5" />}
          </div>
          <div>
            <p className="font-bold text-sm text-foreground">{entry.officialName}</p>
            <p className="text-xs text-muted-foreground">{entry.officialId}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono text-xs text-muted-foreground">
            {new Date(entry.timestamp).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            {new Date(entry.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <MapPin className="size-3" /> {entry.location || entry.terminalId}
        </span>
        <span>·</span>
        <span
          className={`font-semibold ${entry.faceVerified ? "text-emerald-400" : "text-red-400"}`}
        >
          Face Match: {entry.faceMatchScore}%
        </span>
      </div>

      {expanded && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Documents Accessed ({entry.accessedDocuments.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {entry.accessedDocuments.map((doc, i) => (
              <span
                key={i}
                className="rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"
              >
                {doc.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Consumer Component ────────────────────────────────────────────────────

function ConsumerApp() {
  const [authStage, setAuthStage] = useState<AuthStage>("scan");
  const [data, setData] = useState<AadhaarData | null>(null);
  const [faceOutcome, setFaceOutcome] = useState<FaceOutcome | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("vault");

  // Vault state
  const [vault, setVault] = useState<UserDocument[]>([]);
  const [editingDoc, setEditingDoc] = useState<DocType | null>(null);
  const [inputNumber, setInputNumber] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Access log state
  const [accessLog, setAccessLog] = useState<CitizenAccessEntry[]>([]);
  const [accessLogFilter, setAccessLogFilter] = useState<"all" | "verified" | "failed">("all");

  const citizenKey = useMemo(
    () => (data ? data.reference_id || data.name || "citizen" : ""),
    [data]
  );

  const photo = useMemo(
    () =>
      data?.photo_base64
        ? `data:${data.photo_mime || "image/jpeg"};base64,${data.photo_base64}`
        : null,
    [data]
  );

  const navigate = useNavigate();

  // ── Auth ──

  const handleDecoded = useCallback((decoded: AadhaarData) => {
    setData(decoded);
    setAuthError(null);
    setAuthStage("identity");
  }, []);

  const handleFaceDone = useCallback(
    (outcome: FaceOutcome) => {
      setFaceOutcome(outcome);
      if (outcome.verified) {
        setAuthStage("authenticated");
        setAuthError(null);
        if (data) {
          const key = data.reference_id || data.name || "citizen";
          setVault(getUserVault(key));
          setAccessLog(getCitizenAccessLog(key));
        }
      } else {
        setAuthError(
          outcome.reason ||
            `Biometric Verification Failed (${outcome.match}% Match). Face did not match Aadhaar QR photo.`
        );
        setAuthStage("scan");
      }
    },
    [data]
  );

  const resetAuth = useCallback(() => {
    setData(null);
    setFaceOutcome(null);
    setAuthError(null);
    if (authStage === "scan") navigate({ to: "/" });
    else setAuthStage("scan");
  }, [authStage, navigate]);

  // ── Document upload with JP2 format handling ──

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>, type: DocType) => {
    const file = e.target.files?.[0];
    if (!file || !citizenKey) return;
    setUploading(true);
    try {
      const { dataUrl, fileSizeKB, imageFormat } = await encodeDocumentImage(file);
      const existing = vault.find((d) => d.type === type);
      const newDoc: UserDocument = {
        id: existing?.id || `doc-${type}-${Date.now()}`,
        type,
        title: DOC_CONFIGS[type].title,
        docNumber: inputNumber || existing?.docNumber || "",
        ...(imageFormat !== undefined ? { imageFormat } : {}),
        fileName: imageFormat === "pdf" ? file.name : file.name.replace(/\.[^.]+$/, ".jp2"),
        fileUrl: dataUrl,
        fileSizeKB,
        updatedAt: new Date().toISOString(),
        allowedForVerification: existing ? existing.allowedForVerification : true,
      };
      const updated = saveUserDocument(citizenKey, newDoc);
      setVault(updated);
      setEditingDoc(null);
      setInputNumber("");
      setUploadSuccess(
        `Saved ${DOC_CONFIGS[type].title} (${imageFormat === "pdf" ? "PDF" : "JP2 format"}, ${fileSizeKB} KB)`
      );
      setTimeout(() => setUploadSuccess(null), 5000);
    } catch {
      setUploadSuccess("Upload failed. Please try again.");
      setTimeout(() => setUploadSuccess(null), 3000);
    } finally {
      setUploading(false);
    }
  };

  const handlePermissionToggle = (type: DocType) => {
    if (!citizenKey) return;
    setVault(toggleDocumentPermission(citizenKey, type));
  };

  const refreshAccessLog = () => {
    if (citizenKey) setAccessLog(getCitizenAccessLog(citizenKey));
  };

  // Filtered access log
  const filteredAccessLog = useMemo(
    () =>
      accessLog.filter((e) => {
        if (accessLogFilter === "verified") return e.faceVerified;
        if (accessLogFilter === "failed") return !e.faceVerified;
        return true;
      }),
    [accessLog, accessLogFilter]
  );

  // ── Auth Screens ──

  if (authStage === "scan") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/60 px-6 py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <OneIdLogo size="sm" />
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Consumer App
              </span>
            </Link>
            <span className="text-xs text-muted-foreground">Step 1 — Scan Your Aadhaar Card</span>
          </div>
        </header>
        <div className="py-6">
          {authError && (
            <div className="mx-auto mb-4 max-w-md rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-center text-sm font-semibold text-red-400">
              <AlertTriangle className="mx-auto mb-1 size-5" />
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
            <Link to="/" className="flex items-center">
              <OneIdLogo size="sm" />
            </Link>
            <span className="text-xs text-muted-foreground">Step 2 — Confirm Your Aadhaar</span>
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
            <Link to="/" className="flex items-center">
              <OneIdLogo size="sm" />
            </Link>
            <span className="text-xs text-muted-foreground">Step 3 — Biometric Face Verification</span>
          </div>
        </header>
        <div className="py-6">
          <FaceScreen photo={photo} onDone={handleFaceDone} onCancel={resetAuth} />
        </div>
      </div>
    );
  }

  // ── Authenticated Vault ──

  return (
    <div className="min-h-screen bg-background text-foreground select-none">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center">
              <OneIdLogo size="sm" />
            </Link>
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
              Citizen Vault ✓
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Tab switcher */}
            <div className="flex items-center rounded-xl bg-secondary/80 p-1">
              <button
                type="button"
                onClick={() => setActiveTab("vault")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeTab === "vault"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Lock className="size-3.5" /> My Documents
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab("access_log"); refreshAccessLog(); }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeTab === "access_log"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <History className="size-3.5" /> Access Log
                {accessLog.length > 0 && (
                  <span className="rounded-full bg-amber-500/30 px-1.5 text-amber-400">
                    {accessLog.length}
                  </span>
                )}
              </button>
            </div>

            <div className="flex items-center gap-2 text-sm font-medium">
              <div className="size-8 overflow-hidden rounded-full border border-emerald-500/40 bg-slate-800">
                {photo ? (
                  <img src={photo} alt={data?.name} className="size-full object-cover" />
                ) : (
                  <User className="size-full p-1.5 text-slate-400" />
                )}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-bold leading-none text-foreground">{data?.name || "Citizen"}</p>
                <p className="text-[10px] text-emerald-400">Verified ✓</p>
              </div>
            </div>
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

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* ── Tab: Document Vault ── */}
        {activeTab === "vault" && (
          <div className="space-y-8">
            {/* Banner */}
            <div className="flex flex-col justify-between gap-6 rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-card to-card p-8 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                  <Sparkles className="size-4" /> Authenticated Citizen Vault
                </div>
                <h1 className="mt-2 text-3xl font-bold tracking-tight">
                  {data?.name || "Citizen"}'s Locker
                </h1>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  Aadhaar:{" "}
                  <span className="font-mono font-semibold text-foreground">
                    XXXX-XXXX-{data?.aadhaar_last4 || data?.reference_id?.slice(-4) || "XXXX"}
                  </span>{" "}
                  · DOB: {data?.dob || "N/A"} · {data ? buildAddress(data) : ""}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
                <div className="rounded-xl border border-border bg-card px-4 py-2 text-center text-xs font-semibold text-muted-foreground">
                  {vault.length} / 4 Documents Stored
                </div>
                <div className="text-xs text-muted-foreground">Images stored in JP2 format</div>
              </div>
            </div>

            {/* Upload success */}
            {uploadSuccess && (
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-4 text-emerald-300">
                <CheckCircle2 className="size-5 shrink-0" />
                <span className="text-sm font-semibold">{uploadSuccess}</span>
              </div>
            )}

            {/* Document cards */}
            <div className="grid gap-6 sm:grid-cols-2">
              {(["pan", "driving_license", "ration_card", "marksheet"] as DocType[]).map((type) => {
                const config = DOC_CONFIGS[type];
                const Icon = config.icon;
                const doc = vault.find((d) => d.type === type);
                const isUploaded = !!doc;
                const isPermitted = doc?.allowedForVerification;

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
                          <div
                            className={`flex size-12 items-center justify-center rounded-2xl ${
                              isUploaded ? "bg-emerald-500/15 text-emerald-400" : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            <Icon className="size-6" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              {config.category}
                            </p>
                            <h3 className="text-lg font-bold text-foreground">{config.title}</h3>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              isUploaded ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
                            }`}
                          >
                            {isUploaded ? "Saved" : "Not Uploaded"}
                          </span>
                          {isUploaded && doc.imageFormat && (
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-mono bg-secondary text-muted-foreground uppercase">
                              {doc.imageFormat}
                              {doc.fileSizeKB ? ` · ${doc.fileSizeKB}KB` : ""}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Doc preview or upload form */}
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
                            <label className="text-xs font-semibold text-muted-foreground">
                              Document Number
                            </label>
                            <input
                              type="text"
                              defaultValue={doc?.docNumber || ""}
                              onChange={(e) => setInputNumber(e.target.value)}
                              placeholder={config.placeholder}
                              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground">
                              Upload Document (PNG, JPG, PDF → stored as JP2)
                            </label>
                            <label className="mt-1.5 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-xs font-semibold text-primary hover:bg-primary/10">
                              {uploading ? (
                                <>
                                  <RefreshCw className="size-4 animate-spin" /> Converting to JP2…
                                </>
                              ) : (
                                <>
                                  <Upload className="size-4" /> Choose File
                                </>
                              )}
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={(e) => handleFileUpload(e, type)}
                                className="hidden"
                                disabled={uploading}
                              />
                            </label>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Permission toggle + edit */}
                    <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                      <button
                        type="button"
                        onClick={() => handlePermissionToggle(type)}
                        className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                      >
                        {isPermitted ? (
                          <Unlock className="size-4 text-emerald-400" />
                        ) : (
                          <Lock className="size-4 text-amber-400" />
                        )}
                        <span>
                          {isPermitted ? "Allowed for Verification" : "Restricted from Verifiers"}
                        </span>
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
          </div>
        )}

        {/* ── Tab: Access Log ── */}
        {activeTab === "access_log" && (
          <div className="space-y-6">
            <div className="flex flex-col justify-between gap-4 rounded-3xl border border-border bg-card p-6 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                  <History className="size-4" /> My Document Access Log
                </div>
                <h2 className="mt-1 text-2xl font-bold tracking-tight">Who accessed my data?</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Every official who scanned your Aadhaar or accessed your documents is recorded here.
                </p>
              </div>
              <button
                type="button"
                onClick={refreshAccessLog}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent"
              >
                <RefreshCw className="size-3.5" /> Refresh
              </button>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-1.5 rounded-xl bg-secondary/80 p-1 w-fit">
              {(["all", "verified", "failed"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setAccessLogFilter(f)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all ${
                    accessLogFilter === f
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Entries */}
            <div className="space-y-3">
              {filteredAccessLog.length === 0 ? (
                <div className="rounded-3xl border border-border bg-card p-12 text-center text-muted-foreground">
                  {accessLog.length === 0
                    ? "No access records yet. When an official scans your Aadhaar at a kiosk terminal, it will appear here."
                    : "No records match your filter."}
                </div>
              ) : (
                filteredAccessLog.map((entry) => (
                  <AccessLogCard key={entry.id} entry={entry} />
                ))
              )}
            </div>

            {/* Privacy note */}
            <div className="rounded-2xl border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
              <ShieldCheck className="mb-1 size-4 text-emerald-400" />
              All access entries are written locally by the kiosk terminal at the time of scan. This log cannot be modified by officials.
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
