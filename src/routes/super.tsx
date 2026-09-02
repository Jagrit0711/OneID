import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ShieldCheck,
  History,
  Users,
  Search,
  Download,
  Trash2,
  CheckCircle2,
  XCircle,
  BarChart3,
  FileCheck,
  CreditCard,
  Car,
  Home,
  GraduationCap,
  FileText,
  Eye,
  EyeOff,
  UserX,
  UserCheck,
  RefreshCw,
  Lock,
  KeyRound,
  Activity,
  ArrowUpRight,
  AlertTriangle,
  TrendingUp,
  Clock,
} from "lucide-react";
import { OneIdLogo } from "@/components/brand/OneIdLogo";
import {
  getSuperAuditLogs,
  getOfficials,
  toggleOfficialStatus,
  getUserVault,
  getAllCitizenKeys,
  verifySuperPin,
  setSuperPin,
  getSuperPin,
  type SuperAuditEntry,
  type OfficialRecord,
} from "@/lib/kiosk-store";

export const Route = createFileRoute("/super")({
  head: () => ({
    meta: [
      { title: "OneID Super-Official Dashboard — Admin Panel" },
      {
        name: "description",
        content:
          "Super-official admin dashboard with global audit logs, citizen lookup, official management, and record updates.",
      },
    ],
  }),
  component: SuperDashboard,
});

// ── Types ──────────────────────────────────────────────────────────────────────

type TabId = "overview" | "audit" | "citizens" | "officials";

// ── Doc icon helper ────────────────────────────────────────────────────────────

function DocIcon({ type }: { type: string }) {
  if (type === "pan") return <CreditCard className="size-3" />;
  if (type === "driving_license") return <Car className="size-3" />;
  if (type === "ration_card") return <Home className="size-3" />;
  if (type === "marksheet") return <GraduationCap className="size-3" />;
  return <FileText className="size-3" />;
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string | number;
  sub?: string;
  accent?: "emerald" | "amber" | "blue" | "red";
}) {
  const color = {
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    blue: "text-blue-400",
    red: "text-red-400",
  }[accent ?? "emerald"];

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Icon className={`size-4 ${color}`} /> {label}
      </div>
      <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── PIN Lock Screen ────────────────────────────────────────────────────────────

function PinLockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifySuperPin(pin)) {
      onUnlock();
    } else {
      setError("Incorrect PIN. Default is 111222.");
      setPin("");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 ring-4 ring-violet-500/20 mb-4">
            <Lock className="size-10 text-violet-400" />
          </div>
          <Link to="/" className="inline-flex justify-center mb-4">
            <OneIdLogo size="md" />
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Super-Official Access</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your admin PIN to access the command center.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Admin PIN
            </label>
            <div className="relative mt-1">
              <KeyRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type={showPin ? "text" : "password"}
                value={pin}
                onChange={(e) => { setPin(e.target.value); setError(null); }}
                placeholder="Enter PIN"
                className="w-full rounded-2xl border border-input bg-card pl-10 pr-10 py-3 text-center font-mono text-lg tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-violet-500"
                maxLength={16}
                autoFocus
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPin((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPin ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400">
              <AlertTriangle className="size-4 shrink-0" /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={pin.length < 4}
            className="w-full min-h-12 rounded-2xl bg-violet-600 text-base font-bold text-white hover:bg-violet-500 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            Unlock Dashboard
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Default PIN: <span className="font-mono text-foreground">111222</span>
        </p>
        <div className="mt-4 flex justify-center">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Citizen Lookup Panel ───────────────────────────────────────────────────────

function CitizenLookup() {
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const allKeys = useMemo(() => getAllCitizenKeys(), []);
  const filtered = useMemo(
    () =>
      query.length < 2
        ? allKeys.slice(0, 20)
        : allKeys.filter((k) => k.toLowerCase().includes(query.toLowerCase())),
    [allKeys, query]
  );

  const selectedVault = useMemo(
    () => (selectedKey ? getUserVault(selectedKey) : []),
    [selectedKey]
  );

  const superLogs = useMemo(() => getSuperAuditLogs(), []);
  const citizenLogs = useMemo(
    () =>
      selectedKey
        ? superLogs.filter(
            (l) =>
              l.citizenName.toLowerCase().includes(selectedKey.toLowerCase()) ||
              l.citizenUid.includes(selectedKey.slice(-4))
          )
        : [],
    [selectedKey, superLogs]
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* Left: search list */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search citizen by name / Aadhaar ID…"
            className="w-full rounded-2xl border border-input bg-card pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-8">
              No citizens found. Citizens appear here after their vault is created.
            </p>
          ) : (
            filtered.map((key) => {
              const vault = getUserVault(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                  className={`w-full rounded-2xl border p-3 text-left transition-all ${
                    selectedKey === key
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:bg-accent"
                  }`}
                >
                  <p className="font-mono text-xs font-bold text-foreground truncate">{key}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {vault.length} document{vault.length !== 1 ? "s" : ""} stored
                  </p>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right: citizen detail */}
      {selectedKey ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-base font-bold">{selectedKey}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground font-mono">
              Citizen Vault · {selectedVault.length} document{selectedVault.length !== 1 ? "s" : ""}
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {selectedVault.map((doc) => (
                <div key={doc.id} className="rounded-xl border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold">{doc.title}</p>
                    <span
                      className={`rounded text-[10px] font-semibold px-1.5 py-0.5 ${
                        doc.allowedForVerification
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-amber-500/15 text-amber-400"
                      }`}
                    >
                      {doc.allowedForVerification ? "Permitted" : "Restricted"}
                    </span>
                  </div>
                  {doc.docNumber && (
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">{doc.docNumber}</p>
                  )}
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Format: {doc.imageFormat?.toUpperCase() || "JPEG"} · Updated: {new Date(doc.updatedAt).toLocaleDateString("en-IN")}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Access history for this citizen */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <h4 className="text-sm font-bold mb-3">Access History ({citizenLogs.length} sessions)</h4>
            {citizenLogs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No sessions found for this citizen.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {citizenLogs.map((log) => (
                  <div key={log.id} className="flex items-start justify-between rounded-xl border border-border bg-muted/20 p-3 text-xs">
                    <div>
                      <p className="font-bold text-foreground">{log.officialName}</p>
                      <p className="text-muted-foreground">{log.officialId} · {log.location || log.terminalId}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {log.accessedDocuments.slice(0, 3).map((d, i) => (
                          <span key={i} className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary font-semibold">{d.label}</span>
                        ))}
                        {log.accessedDocuments.length > 3 && (
                          <span className="text-muted-foreground text-[10px]">+{log.accessedDocuments.length - 3} more</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="font-mono text-muted-foreground">
                        {new Date(log.timestamp).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      </p>
                      <p className="font-mono text-muted-foreground">
                        {new Date(log.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <span className={`font-semibold ${log.faceVerified ? "text-emerald-400" : "text-red-400"}`}>
                        {log.faceMatchScore}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 text-muted-foreground text-sm py-20">
          Select a citizen to view their vault &amp; access history
        </div>
      )}
    </div>
  );
}

// ── Officials Panel ────────────────────────────────────────────────────────────

function OfficialsPanel({ onRefresh }: { onRefresh: () => void }) {
  const [officials, setOfficials] = useState<OfficialRecord[]>(getOfficials());
  const [changingPin, setChangingPin] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [pinSuccess, setPinSuccess] = useState(false);

  const handleToggle = (id: string) => {
    const updated = toggleOfficialStatus(id);
    setOfficials(updated);
    onRefresh();
  };

  const handlePinChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length >= 4) {
      setSuperPin(newPin);
      setNewPin("");
      setChangingPin(false);
      setPinSuccess(true);
      setTimeout(() => setPinSuccess(false), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* PIN management */}
      <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-violet-400">Admin PIN Management</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Current PIN: {getSuperPin().replace(/./g, "•")}</p>
          </div>
          <button
            type="button"
            onClick={() => setChangingPin((c) => !c)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-300 hover:bg-violet-500/20"
          >
            <KeyRound className="size-3.5" /> Change PIN
          </button>
        </div>
        {pinSuccess && (
          <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
            <CheckCircle2 className="size-4" /> PIN updated successfully.
          </div>
        )}
        {changingPin && (
          <form onSubmit={handlePinChange} className="mt-3 flex gap-2">
            <input
              type="text"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="New PIN (min 4 chars)"
              className="flex-1 rounded-xl border border-input bg-card px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              maxLength={12}
              autoFocus
            />
            <button
              type="submit"
              disabled={newPin.length < 4}
              className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50"
            >
              Save
            </button>
          </form>
        )}
      </div>

      {/* Officials list */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-foreground">Registered Officials ({officials.length})</h3>
          <button
            type="button"
            onClick={() => { setOfficials(getOfficials()); onRefresh(); }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent"
          >
            <RefreshCw className="size-3" /> Refresh
          </button>
        </div>
        {officials.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            No officials registered yet. Officials appear here after they log in to the Kiosk Terminal.
          </p>
        ) : (
          <div className="space-y-2">
            {officials.map((off) => (
              <div
                key={off.id}
                className={`flex items-center justify-between rounded-2xl border p-4 ${
                  off.active ? "border-border bg-card" : "border-border bg-muted/30 opacity-60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex size-9 items-center justify-center rounded-full ${off.active ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-700 text-slate-400"}`}>
                    <UserCheck className="size-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-foreground">{off.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      Aadhaar ••••-{off.aadhaarTail} · {off.totalVerifications} verifications
                    </p>
                    {off.lastActiveAt && (
                      <p className="text-[10px] text-muted-foreground">
                        Last active: {new Date(off.lastActiveAt).toLocaleDateString("en-IN")}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle(off.id)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    off.active
                      ? "border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                      : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                  }`}
                >
                  {off.active ? (
                    <><UserX className="size-3.5" /> Disable</>
                  ) : (
                    <><UserCheck className="size-3.5" /> Enable</>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Super Dashboard ───────────────────────────────────────────────────────

function SuperDashboard() {
  const [unlocked, setUnlocked] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [auditLogs, setAuditLogs] = useState<SuperAuditEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "verified" | "failed">("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week">("all");

  const refresh = () => {
    setAuditLogs(getSuperAuditLogs());
  };

  const handleUnlock = () => {
    setUnlocked(true);
    refresh();
  };

  const today = new Date().toDateString();

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const matchSearch =
        log.citizenName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.citizenUid.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.officialName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.terminalId || "").toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus =
        statusFilter === "all" ? true : statusFilter === "verified" ? log.faceVerified : !log.faceVerified;

      const matchDate =
        dateFilter === "all"
          ? true
          : dateFilter === "today"
          ? new Date(log.timestamp).toDateString() === today
          : Date.now() - new Date(log.timestamp).getTime() < 7 * 24 * 60 * 60 * 1000;

      return matchSearch && matchStatus && matchDate;
    });
  }, [auditLogs, searchQuery, statusFilter, dateFilter, today]);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(auditLogs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `oneid_super_audit_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs: Array<{ id: TabId; label: string; icon: typeof BarChart3 }> = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "audit", label: `Audit Log (${auditLogs.length})`, icon: History },
    { id: "citizens", label: "Citizen Lookup", icon: Search },
    { id: "officials", label: "Officials", icon: Users },
  ];

  // Early return — safely AFTER all hooks (useMemo above)
  if (!unlocked) return <PinLockScreen onUnlock={handleUnlock} />;

  // ── Derived stats (plain calculations, not hooks) ──────────────────────────
  const todayLogs = auditLogs.filter((l) => new Date(l.timestamp).toDateString() === today);
  const verifiedToday = todayLogs.filter((l) => l.faceVerified).length;
  const totalScans = auditLogs.length;
  const verifiedTotal = auditLogs.filter((l) => l.faceVerified).length;
  const successRate = totalScans > 0 ? Math.round((verifiedTotal / totalScans) * 100) : 100;

  const docFreq: Record<string, number> = {};
  auditLogs.forEach((l) =>
    l.accessedDocuments.forEach((d) => {
      docFreq[d.type] = (docFreq[d.type] || 0) + 1;
    })
  );
  const topDoc = Object.entries(docFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  return (
    <div className="min-h-screen bg-background text-foreground select-none">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center">
              <OneIdLogo size="sm" />
            </Link>
            <div className="h-5 w-px bg-border" />
            <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1 text-xs font-bold text-violet-400">
              Super-Official Admin
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent"
            >
              <RefreshCw className="size-3.5" /> Refresh
            </button>
            <button
              type="button"
              onClick={() => setUnlocked(false)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors"
            >
              <Lock className="size-3.5" /> Lock
            </button>
          </div>
        </div>
      </header>

      {/* Tab nav */}
      <div className="border-b border-border bg-card/40">
        <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-6 py-2">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => { setActiveTab(id); if (id === "audit" || id === "overview") refresh(); }}
              className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === id
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <Icon className="size-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* ── Tab: Overview ── */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-bold text-foreground">System Overview</h2>
              <p className="text-xs text-muted-foreground">Real-time stats across all kiosk terminals and officials.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={BarChart3} label="Total Verifications" value={totalScans} sub="All time" accent="blue" />
              <StatCard icon={CheckCircle2} label="Success Rate" value={`${successRate}%`} sub={`${verifiedTotal} verified`} accent="emerald" />
              <StatCard icon={Clock} label="Scans Today" value={todayLogs.length} sub={`${verifiedToday} verified`} accent="amber" />
              <StatCard icon={FileCheck} label="Most Accessed Doc" value={topDoc === "pan" ? "PAN Card" : topDoc === "driving_license" ? "Driving License" : topDoc === "ration_card" ? "Ration Card" : topDoc === "marksheet" ? "Marksheet" : "Aadhaar"} sub="Most requested" accent="emerald" />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard icon={Users} label="Registered Officials" value={getOfficials().length} sub={`${getOfficials().filter((o) => o.active).length} active`} accent="blue" />
              <StatCard icon={Search} label="Citizens in System" value={getAllCitizenKeys().length} sub="With document vaults" accent="amber" />
              <StatCard icon={TrendingUp} label="Documents Accessed" value={auditLogs.reduce((a, l) => a + l.accessedDocuments.length, 0)} sub="Across all sessions" accent="emerald" />
            </div>

            {/* Quick links */}
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { tab: "audit" as TabId, label: "View Full Audit Log", icon: History, color: "border-amber-500/40 bg-amber-500/5 text-amber-400 hover:bg-amber-500/10" },
                { tab: "citizens" as TabId, label: "Citizen Lookup", icon: Search, color: "border-emerald-500/40 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10" },
                { tab: "officials" as TabId, label: "Manage Officials", icon: Users, color: "border-violet-500/40 bg-violet-500/5 text-violet-400 hover:bg-violet-500/10" },
              ].map(({ tab, label, icon: Icon, color }) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => { setActiveTab(tab); if (tab === "audit") refresh(); }}
                  className={`flex items-center justify-between rounded-2xl border p-5 text-left transition-all ${color}`}
                >
                  <div>
                    <Icon className="size-5 mb-1" />
                    <p className="font-bold text-sm">{label}</p>
                  </div>
                  <ArrowUpRight className="size-4 opacity-60" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab: Audit Log ── */}
        {activeTab === "audit" && (
          <div className="space-y-6">
            <div className="flex flex-col justify-between gap-4 rounded-3xl border border-border bg-card p-6 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                  <History className="size-4" /> Global Biometric Audit Log
                </div>
                <h2 className="mt-1 text-2xl font-bold tracking-tight">All Verification Sessions</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Every citizen verification across all officials and terminals.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={auditLogs.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-50"
                >
                  <Download className="size-3.5" /> Export JSON
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-lg">
                <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by citizen, official, or terminal…"
                  className="w-full rounded-2xl border border-input bg-card pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1 rounded-xl bg-secondary/80 p-1">
                  {(["all", "verified", "failed"] as const).map((f) => (
                    <button key={f} type="button" onClick={() => setStatusFilter(f)}
                      className={`rounded-lg px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-all ${statusFilter === f ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                      {f}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1 rounded-xl bg-secondary/80 p-1">
                  {(["all", "today", "week"] as const).map((f) => (
                    <button key={f} type="button" onClick={() => setDateFilter(f)}
                      className={`rounded-lg px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-all ${dateFilter === f ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Log entries */}
            <div className="space-y-3">
              {filteredLogs.length === 0 ? (
                <div className="rounded-3xl border border-border bg-card p-12 text-center text-muted-foreground text-sm">
                  {auditLogs.length === 0
                    ? "No verifications logged yet. Use the Kiosk Terminal to verify citizens."
                    : "No records match your filters."}
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-col justify-between gap-4 rounded-3xl border border-border bg-card p-5 shadow-sm hover:border-primary/30 transition-all sm:flex-row sm:items-center"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-3">
                        <span className={`flex size-8 items-center justify-center rounded-full ${log.faceVerified ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                          {log.faceVerified ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-foreground">{log.citizenName}</h3>
                          <p className="font-mono text-xs text-muted-foreground">{log.citizenUid}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span><strong className="text-foreground">{log.officialName}</strong></span>
                        <span>·</span>
                        <span className="font-mono">{log.terminalId || log.location}</span>
                        <span>·</span>
                        <span>{new Date(log.timestamp).toLocaleString("en-IN")}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="rounded-xl border border-border bg-muted/30 px-4 py-2 text-center">
                        <p className="text-[10px] uppercase text-muted-foreground font-semibold">Face Match</p>
                        <p className={`text-lg font-black ${log.faceVerified ? "text-emerald-400" : "text-red-400"}`}>{log.faceMatchScore}%</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Docs ({log.accessedDocuments.length})</p>
                        <div className="flex flex-wrap gap-1">
                          {log.accessedDocuments.map((d, i) => (
                            <span key={i} className="inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                              <DocIcon type={d.type} /> {d.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Citizens ── */}
        {activeTab === "citizens" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold">Citizen Lookup</h2>
              <p className="text-xs text-muted-foreground">Search and inspect citizen vaults and their full access history.</p>
            </div>
            <CitizenLookup />
          </div>
        )}

        {/* ── Tab: Officials ── */}
        {activeTab === "officials" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold">Official Management</h2>
              <p className="text-xs text-muted-foreground">Manage registered officials, enable/disable access, and update the admin PIN.</p>
            </div>
            <OfficialsPanel onRefresh={refresh} />
          </div>
        )}
      </main>
    </div>
  );
}
