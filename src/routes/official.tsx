import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import type { AadhaarData } from "aadhaar-react-scanner";
import {
  ShieldCheck,
  ScanLine,
  UserCheck,
  History,
  CheckCircle2,
  XCircle,
  FileText,
  CreditCard,
  Car,
  Home,
  GraduationCap,
  LogOut,
  User,
  Trash2,
  Search,
  Download,
  Lock,
  ArrowRight,
  Eye,
  Sparkles,
  BarChart3,
  FileCheck,
} from "lucide-react";
import { ScanScreen } from "@/components/kiosk/ScanScreen";
import { IdentityScreen } from "@/components/kiosk/IdentityScreen";
import { FaceScreen, type FaceOutcome } from "@/components/kiosk/FaceScreen";
import { ResultScreen } from "@/components/kiosk/ResultScreen";
import { OneIdLogo } from "@/components/brand/OneIdLogo";
import { DocPreviewer } from "@/components/ui/DocPreviewer";
import {
  getAuditLogs,
  addAuditLog,
  clearAuditLogs,
  getUserVault,
  type AuditLogEntry,
  type DocType,
  type UserDocument,
} from "@/lib/kiosk-store";

export const Route = createFileRoute("/official")({
  head: () => ({
    meta: [
      { title: "Official Verification Kiosk & Audit Portal — OneID" },
      { name: "description", content: "Aadhaar-authenticated official portal with document selection, face verification, and audit logging." },
    ],
  }),
  component: OfficialPortal,
});

type Tab = "kiosk" | "audit";
type OfficialAuthStage = "scan" | "identity" | "face" | "success_banner" | "authenticated";
type KioskStage = "scan" | "identity" | "doc_selection" | "face" | "result";

const ALL_DOC_TYPES: Array<{ type: DocType; label: string; icon: typeof CreditCard }> = [
  { type: "pan", label: "PAN Card", icon: CreditCard },
  { type: "driving_license", label: "Driving License", icon: Car },
  { type: "ration_card", label: "Ration Card", icon: Home },
  { type: "marksheet", label: "Board Marksheet", icon: GraduationCap },
];

function OfficialPortal() {
  // Official Authentication State
  const [authStage, setAuthStage] = useState<OfficialAuthStage>("scan");
  const [officialData, setOfficialData] = useState<AadhaarData | null>(null);
  const [officialAuthError, setOfficialAuthError] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<Tab>("kiosk");

  // Kiosk Flow State (for citizen scans)
  const [kioskStage, setKioskStage] = useState<KioskStage>("scan");
  const [citizenData, setCitizenData] = useState<AadhaarData | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<Record<DocType, boolean>>({
    pan: true,
    driving_license: true,
    ration_card: false,
    marksheet: false,
  });
  const [citizenFaceOutcome, setCitizenFaceOutcome] = useState<FaceOutcome | null>(null);

  // Audit Logs & Search State
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(getAuditLogs());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "verified" | "failed">("all");

  // Photos
  const officialPhoto = useMemo(() => {
    if (!officialData?.photo_base64) return null;
    return `data:${officialData.photo_mime || "image/jpeg"};base64,${officialData.photo_base64}`;
  }, [officialData]);

  const citizenPhoto = useMemo(() => {
    if (!citizenData?.photo_base64) return null;
    return `data:${citizenData.photo_mime || "image/jpeg"};base64,${citizenData.photo_base64}`;
  }, [citizenData]);

  // Citizen Vault for document availability check
  const citizenVault = useMemo<UserDocument[]>(() => {
    if (!citizenData) return [];
    const citizenKey = citizenData.reference_id || citizenData.name || "citizen";
    return getUserVault(citizenKey);
  }, [citizenData]);

  // ── Official Login Callbacks ──

  const handleOfficialDecoded = useCallback((decoded: AadhaarData) => {
    setOfficialData(decoded);
    setOfficialAuthError(null);
    setAuthStage("identity");
  }, []);

  const handleOfficialFaceDone = useCallback((outcome: FaceOutcome) => {
    if (outcome.verified) {
      setOfficialAuthError(null);
      setAuthStage("success_banner");
    } else {
      setOfficialAuthError(
        outcome.reason ||
          `Official Biometric Check Failed (${outcome.match}% Match). Access Denied.`
      );
      setAuthStage("scan");
    }
  }, []);

  const navigate = useNavigate();

  const resetOfficialAuth = useCallback(() => {
    setOfficialData(null);
    setOfficialAuthError(null);
    if (authStage === "scan") {
      navigate({ to: "/" });
    } else {
      setAuthStage("scan");
    }
  }, [authStage, navigate]);

  // ── Citizen Kiosk Callbacks ──

  const resetCitizenKiosk = useCallback(() => {
    setCitizenData(null);
    setCitizenFaceOutcome(null);
    setKioskStage("scan");
  }, []);

  const handleCitizenDecoded = useCallback((decoded: AadhaarData) => {
    setCitizenData(decoded);
    setKioskStage("identity");
  }, []);

  const toggleDocSelection = (type: DocType) => {
    setSelectedDocs((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const handleCitizenFaceDone = useCallback((result: FaceOutcome) => {
    setCitizenFaceOutcome(result);
    setKioskStage("result");

    // Dynamically record real Audit Log Entry on verification
    if (citizenData && officialData) {
      const accessedDocs = [
        { type: "aadhaar", label: "Aadhaar Demographics & Photo" },
        ...ALL_DOC_TYPES
          .filter(({ type }) => selectedDocs[type])
          .map(({ type, label }) => {
            const vaultDoc = citizenVault.find((d) => d.type === type);
            return {
              type,
              label,
              docNumber: vaultDoc?.allowedForVerification ? vaultDoc.docNumber : undefined,
            };
          }),
      ];

      const maskedUid = citizenData.reference_id
        ? `XXXX-XXXX-${citizenData.reference_id.slice(-4)}`
        : "XXXX-XXXX-8901";

      const officialId = officialData.reference_id
        ? `OFF-${officialData.reference_id.slice(-4)}`
        : "OFF-8042";

      const updated = addAuditLog({
        officialId,
        officialName: `Officer ${officialData.name || "Official"}`,
        citizenName: citizenData.name || "Citizen",
        citizenUid: maskedUid,
        faceMatchScore: result.match,
        faceVerified: result.verified,
        signatureValid: citizenData.signature_valid !== false,
        accessedDocuments: accessedDocs,
      });

      setAuditLogs(updated);
    }
  }, [citizenData, officialData, selectedDocs, citizenVault]);

  const handleClearAudit = () => {
    clearAuditLogs();
    setAuditLogs([]);
  };

  const handleExportJSON = () => {
    const jsonStr = JSON.stringify(auditLogs, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `oneid_audit_report_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered Audit Logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const matchesSearch =
        log.citizenName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.citizenUid.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.officialName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "verified"
          ? log.faceVerified
          : !log.faceVerified;

      return matchesSearch && matchesStatus;
    });
  }, [auditLogs, searchQuery, statusFilter]);

  // Officer Stats
  const totalScans = auditLogs.length;
  const verifiedScans = auditLogs.filter((l) => l.faceVerified).length;
  const successRate = totalScans > 0 ? Math.round((verifiedScans / totalScans) * 100) : 100;

  // ── Official Authentication Screens ──

  if (authStage === "scan") {
    return (
      <div className="min-h-screen bg-background select-none">
        <header className="border-b border-border bg-card/60 px-6 py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-lg font-bold text-foreground">
              <ShieldCheck className="size-6 text-emerald-400" /> OneID Official Portal
            </Link>
            <span className="text-xs text-muted-foreground">Officer Authentication Step 1: Scan Official Aadhaar Card</span>
          </div>
        </header>
        <div className="py-6">
          {officialAuthError && (
            <div className="mx-auto max-w-md rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-center text-sm font-semibold text-red-400 mb-4">
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
            <span className="text-lg font-bold text-foreground">OneID Official Portal</span>
            <span className="text-xs text-muted-foreground">Officer Authentication Step 2: Confirm Officer Profile</span>
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
            <span className="text-lg font-bold text-foreground">OneID Official Portal</span>
            <span className="text-xs text-muted-foreground">Officer Authentication Step 3: Biometric Officer Verification</span>
          </div>
        </header>
        <div className="py-6">
          <FaceScreen photo={officialPhoto} onDone={handleOfficialFaceDone} onCancel={resetOfficialAuth} />
        </div>
      </div>
    );
  }

  // Explicit Authentication Success Banner
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
          <p className="mt-2 text-lg text-foreground font-semibold">
            Welcome, Officer {officialData.name}
          </p>
          <p className="mt-1 text-xs font-mono text-muted-foreground">
            Official ID: OFF-{officialData.reference_id ? officialData.reference_id.slice(-4) : "8042"} · Terminal 1 Active
          </p>

          <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-300">
            <ShieldCheck className="size-5 shrink-0" />
            <span>Identity confirmed via InsightFace ArcFace 512-dim neural match against official Aadhaar record.</span>
          </div>

          <button
            type="button"
            onClick={() => setAuthStage("authenticated")}
            className="mt-8 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-lg font-bold text-slate-950 shadow-lg hover:bg-emerald-400 transition-transform active:scale-[0.98]"
          >
            Enter Official Kiosk Dashboard <ArrowRight className="size-5" />
          </button>
        </div>
      </div>
    );
  }

  // ── Authenticated Official Kiosk Dashboard ──

  return (
    <div className="min-h-screen bg-background text-foreground select-none">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center">
              <OneIdLogo size="sm" />
            </Link>
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
              Authenticated Official
            </span>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center rounded-xl bg-secondary/80 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("kiosk")}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "kiosk"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ScanLine className="size-4" /> Live Verification Kiosk
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("audit")}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "audit"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <History className="size-4" /> Audit Logs ({auditLogs.length})
            </button>
          </div>

          {/* Officer Profile Badge */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 text-sm font-medium">
              <div className="size-9 overflow-hidden rounded-full border border-emerald-500/40 bg-slate-800 shadow-inner">
                {officialPhoto ? (
                  <img src={officialPhoto} alt={officialData?.name} className="size-full object-cover" />
                ) : (
                  <User className="size-full p-1.5 text-slate-400" />
                )}
              </div>
              <div>
                <p className="font-bold leading-none text-foreground">Officer {officialData?.name || "Official"}</p>
                <p className="text-[10px] text-emerald-400 mt-0.5 font-semibold">Active Verifier ✓</p>
              </div>
            </div>

            <button
              type="button"
              onClick={resetOfficialAuth}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <LogOut className="size-3.5" /> Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Officer Stats Bar */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <BarChart3 className="size-4 text-primary" /> Total Scans
            </div>
            <p className="mt-2 text-2xl font-bold">{totalScans}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <CheckCircle2 className="size-4 text-emerald-400" /> Verified Rate
            </div>
            <p className="mt-2 text-2xl font-bold text-emerald-400">{successRate}%</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <FileCheck className="size-4 text-amber-400" /> Documents Logged
            </div>
            <p className="mt-2 text-2xl font-bold">
              {auditLogs.reduce((acc, l) => acc + l.accessedDocuments.length, 0)}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <ShieldCheck className="size-4 text-emerald-400" /> Engine Status
            </div>
            <p className="mt-2 text-xs font-bold text-emerald-400">InsightFace ArcFace 512-dim</p>
          </div>
        </div>

        {/* ── Tab 1: Live Verification Kiosk Flow ── */}
        {activeTab === "kiosk" && (
          <div>
            {kioskStage === "scan" && <ScanScreen onDecoded={handleCitizenDecoded} onCancel={resetCitizenKiosk} />}

            {kioskStage === "identity" && citizenData && (
              <IdentityScreen
                data={citizenData}
                photo={citizenPhoto}
                onContinue={() => setKioskStage("doc_selection")}
                onCancel={resetCitizenKiosk}
              />
            )}

            {/* NEW Step 2.5: Document Selection for Inspection */}
            {kioskStage === "doc_selection" && citizenData && (
              <div className="flex flex-col items-center py-6 text-center">
                <div className="w-full max-w-2xl rounded-3xl border border-border bg-card p-8 shadow-xl">
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary">
                    <Eye className="size-4" /> Step 2 of 3 — Select Documents to Inspect
                  </div>

                  <h2 className="mt-4 text-2xl font-bold">Document Inspection Selection</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Select which citizen documents you need to inspect. Only permitted &amp; selected documents will unlock after successful face verification.
                  </p>

                  <div className="mt-6 space-y-3 text-left">
                    {/* Always included Aadhaar */}
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

                    {/* Selectable Additional Vault Documents */}
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
                              className="size-4 rounded border-input text-primary focus:ring-primary"
                            />
                            <Icon className="size-5 text-primary shrink-0" />
                            <div>
                              <p className="text-sm font-bold text-foreground">{label}</p>
                              <p className="text-xs text-muted-foreground">
                                {isUploaded
                                  ? isPermitted
                                    ? `Uploaded (${vaultDoc.docNumber || "Copy attached"})`
                                    : "Uploaded but Restricted by Citizen 🔒"
                                  : "Not uploaded in Citizen Vault"}
                              </p>
                            </div>
                          </div>

                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            isUploaded
                              ? isPermitted
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-amber-500/15 text-amber-400"
                              : "bg-secondary text-muted-foreground"
                          }`}>
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
                      onClick={() => setKioskStage("face")}
                      className="min-h-14 flex-[2] inline-flex items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-bold text-primary-foreground shadow-lg hover:bg-primary/90 transition-transform active:scale-[0.98]"
                    >
                      Proceed to Face Verification <ArrowRight className="size-5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {kioskStage === "face" && (
              <FaceScreen photo={citizenPhoto} onDone={handleCitizenFaceDone} onCancel={resetCitizenKiosk} />
            )}

            {/* Step 4: Verification Result & Document Unlocking */}
            {kioskStage === "result" && citizenFaceOutcome && (
              <div className="space-y-6">
                <ResultScreen
                  outcome={citizenFaceOutcome}
                  name={citizenData?.name}
                  signatureValid={citizenData?.signature_valid}
                  onRetry={() => {
                    setCitizenFaceOutcome(null);
                    setKioskStage("face");
                  }}
                  onContinue={resetCitizenKiosk}
                />

                {/* IF VERIFIED: Display Unlocked Selected Documents */}
                {citizenFaceOutcome.verified && (
                  <div className="mx-auto max-w-3xl rounded-3xl border border-emerald-500/40 bg-card p-6 shadow-xl text-left">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                      <Lock className="size-4" /> Biometrically Unlocked Inspection Viewer
                    </div>
                    <h3 className="mt-1 text-xl font-bold">Selected Documents Unlocked for Inspection</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Only requested documents permitted by {citizenData?.name || "Citizen"} are displayed below.
                    </p>

                    <div className="mt-6 space-y-4">
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
              </div>
            )}
          </div>
        )}

        {/* ── Tab 2: Filterable & Searchable Audit Log ── */}
        {activeTab === "audit" && (
          <div className="space-y-6">
            <div className="flex flex-col justify-between gap-4 rounded-3xl border border-border bg-card p-6 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                  <History className="size-4" /> Live Biometric Audit Log
                </div>
                <h1 className="mt-1 text-2xl font-bold tracking-tight">Citizen Verification &amp; Document History</h1>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Real-time log of identity checks performed by Officer {officialData?.name || "Official"}.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleExportJSON}
                  disabled={auditLogs.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-50"
                >
                  <Download className="size-3.5" /> Export Audit Report (JSON)
                </button>
                {auditLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAudit}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-3.5 py-2 text-xs font-medium text-muted-foreground hover:bg-accent"
                  >
                    <Trash2 className="size-3.5" /> Clear Audit Logs
                  </button>
                )}
              </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Citizen Name, Aadhaar UID, or Officer..."
                  className="w-full rounded-2xl border border-input bg-card pl-10 pr-4 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex items-center gap-1.5 rounded-xl bg-secondary/80 p-1">
                {(["all", "verified", "failed"] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setStatusFilter(filter)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all ${
                      statusFilter === filter
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Audit Log List */}
            <div className="space-y-4">
              {filteredAuditLogs.length === 0 ? (
                <div className="rounded-3xl border border-border bg-card p-12 text-center text-muted-foreground">
                  {auditLogs.length === 0
                    ? "No verification audit records generated yet. Launch a new scan on a citizen to record a live audit log."
                    : "No audit logs match your search filter."}
                </div>
              ) : (
                filteredAuditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-col justify-between gap-6 rounded-3xl border border-border bg-card p-6 shadow-sm transition-all hover:border-emerald-500/40 sm:flex-row sm:items-center"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className={`flex size-8 items-center justify-center rounded-full ${
                          log.faceVerified ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                        }`}>
                          {log.faceVerified ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}
                        </span>
                        <div>
                          <h3 className="text-base font-bold text-foreground">{log.citizenName}</h3>
                          <p className="font-mono text-xs text-muted-foreground">{log.citizenUid}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>Verified by: <strong className="text-foreground">{log.officialName}</strong></span>
                        <span>•</span>
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex gap-4 border-y border-border py-3 sm:border-y-0 sm:py-0">
                      <div className="rounded-xl border border-border bg-muted/30 px-4 py-2 text-center">
                        <p className="text-[10px] uppercase text-muted-foreground font-semibold">Face Match</p>
                        <p className={`text-lg font-black ${log.faceVerified ? "text-emerald-400" : "text-red-400"}`}>
                          {log.faceMatchScore}%
                        </p>
                      </div>
                      <div className="rounded-xl border border-border bg-muted/30 px-4 py-2 text-center">
                        <p className="text-[10px] uppercase text-muted-foreground font-semibold">QR RSA Signature</p>
                        <p className="text-xs font-bold text-emerald-400 mt-1">
                          {log.signatureValid ? "Valid ✓" : "Standard"}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Accessed Documents ({log.accessedDocuments.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {log.accessedDocuments.map((doc, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"
                          >
                            {doc.type === "pan" && <CreditCard className="size-3" />}
                            {doc.type === "driving_license" && <Car className="size-3" />}
                            {doc.type === "ration_card" && <Home className="size-3" />}
                            {doc.type === "marksheet" && <GraduationCap className="size-3" />}
                            {doc.type === "aadhaar" && <FileText className="size-3" />}
                            <span>{doc.label}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
