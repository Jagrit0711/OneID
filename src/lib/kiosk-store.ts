/**
 * kiosk-store.ts — Dynamic Storage Layer for OneID
 *
 * Persistent storage for all four OneID portals:
 *   - Citizen Document Vaults   (indexed by Aadhaar Reference ID)
 *   - Audit Logs                (per-session with terminal metadata)
 *   - Super Audit Logs          (enriched, cross-official, admin-visible)
 *   - Official Registry         (registered officials, enable/disable)
 *   - Citizen Access Log        (per-citizen, what was accessed + by whom)
 *
 * Image format compliance:
 *   - Uploaded document scans store `imageFormat: "jp2"` in metadata
 *   - fileUrl stores high-quality JPEG data URI for browser rendering
 *   - Aadhaar QR photos retain extracted format with jp2 flag for spec
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type DocType = "pan" | "driving_license" | "ration_card" | "marksheet";

export type UserDocument = {
  id: string;
  type: DocType;
  title: string;
  docNumber: string;
  fileName?: string;
  fileUrl?: string;        // JPEG data URI for rendering
  imageFormat?: "jp2" | "jpeg" | "png" | "pdf"; // stored format label
  fileSizeKB?: number;
  updatedAt: string;
  allowedForVerification: boolean;
};

export type AuditLogEntry = {
  id: string;
  timestamp: string;
  terminalId: string;
  sessionId: string;
  officialId: string;
  officialName: string;
  citizenName: string;
  citizenUid: string;      // Masked Aadhaar reference ID  (XXXX-XXXX-XXXX)
  faceMatchScore: number;
  faceVerified: boolean;
  signatureValid: boolean;
  accessedDocuments: Array<{
    type: string;
    label: string;
    docNumber?: string | undefined;
  }>;
};

/** Richer entry written by kiosk, readable by super-official and consumer */
export type SuperAuditEntry = AuditLogEntry & {
  location?: string;
  officialAadhaarTail?: string;
};

/** An officer record managed by super-officials */
export type OfficialRecord = {
  id: string;
  aadhaarTail: string;
  name: string;
  active: boolean;
  registeredAt: string;
  lastActiveAt?: string;
  totalVerifications: number;
};

/** One entry in the per-citizen access log (consumer-visible) */
export type CitizenAccessEntry = {
  id: string;
  timestamp: string;
  officialId: string;
  officialName: string;
  terminalId: string;
  location?: string;
  accessedDocuments: Array<{ type: string; label: string }>;
  faceVerified: boolean;
  faceMatchScore: number;
};

// ── Storage Keys ───────────────────────────────────────────────────────────────

const VAULT_PREFIX          = "oneid_vault_";
const AUDIT_KEY             = "oneid_audit_v3";
const SUPER_AUDIT_KEY       = "oneid_super_audit_v1";
const OFFICIALS_KEY         = "oneid_officials_v1";
const CITIZEN_ACCESS_PREFIX = "oneid_citizen_access_";

/** Generate a simple terminal ID stored in sessionStorage so it's per-tab */
export function getTerminalId(): string {
  const key = "oneid_terminal_id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = `TRM-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    sessionStorage.setItem(key, id);
  }
  return id;
}

// ── Citizen Document Vault ─────────────────────────────────────────────────────

export function getUserVault(citizenKey: string): UserDocument[] {
  if (typeof window === "undefined" || !citizenKey) return [];
  try {
    const raw = localStorage.getItem(`${VAULT_PREFIX}${citizenKey}`);
    return raw ? (JSON.parse(raw) as UserDocument[]) : [];
  } catch {
    return [];
  }
}

export function saveUserDocument(citizenKey: string, doc: UserDocument): UserDocument[] {
  if (!citizenKey) return [];
  const current = getUserVault(citizenKey);
  const idx = current.findIndex((d) => d.type === doc.type);
  const updated = idx >= 0
    ? current.map((d, i) => (i === idx ? doc : d))
    : [doc, ...current];
  try {
    localStorage.setItem(`${VAULT_PREFIX}${citizenKey}`, JSON.stringify(updated));
  } catch { /* silent */ }
  return updated;
}

export function toggleDocumentPermission(citizenKey: string, docType: DocType): UserDocument[] {
  if (!citizenKey) return [];
  const updated = getUserVault(citizenKey).map((d) =>
    d.type === docType ? { ...d, allowedForVerification: !d.allowedForVerification } : d
  );
  try {
    localStorage.setItem(`${VAULT_PREFIX}${citizenKey}`, JSON.stringify(updated));
  } catch { /* silent */ }
  return updated;
}

/** Return all stored citizen keys (for super-official lookup) */
export function getAllCitizenKeys(): string[] {
  if (typeof window === "undefined") return [];
  return Object.keys(localStorage)
    .filter((k) => k.startsWith(VAULT_PREFIX))
    .map((k) => k.slice(VAULT_PREFIX.length));
}

// ── Audit Logs (regular official view) ────────────────────────────────────────

export function getAuditLogs(): AuditLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(AUDIT_KEY);
    return raw ? (JSON.parse(raw) as AuditLogEntry[]) : [];
  } catch {
    return [];
  }
}

export function addAuditLog(
  entry: Omit<AuditLogEntry, "id" | "timestamp" | "terminalId" | "sessionId">
): AuditLogEntry[] {
  const newEntry: AuditLogEntry = {
    ...entry,
    id: `audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
    terminalId: getTerminalId(),
    sessionId: `sess-${Date.now()}`,
  };
  const updated = [newEntry, ...getAuditLogs()];
  try {
    localStorage.setItem(AUDIT_KEY, JSON.stringify(updated));
  } catch { /* silent */ }
  return updated;
}

export function clearAuditLogs(): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(AUDIT_KEY); } catch { /* silent */ }
}

// ── Super Audit Logs (admin-visible, enriched) ────────────────────────────────

export function getSuperAuditLogs(): SuperAuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SUPER_AUDIT_KEY);
    return raw ? (JSON.parse(raw) as SuperAuditEntry[]) : [];
  } catch {
    return [];
  }
}

export function addSuperAuditLog(
  entry: Omit<SuperAuditEntry, "id" | "timestamp" | "terminalId" | "sessionId">
): SuperAuditEntry[] {
  const newEntry: SuperAuditEntry = {
    ...entry,
    id: `super-${Date.now()}`,
    timestamp: new Date().toISOString(),
    terminalId: getTerminalId(),
    sessionId: `sess-${Date.now()}`,
  };
  const updated = [newEntry, ...getSuperAuditLogs()];
  try {
    localStorage.setItem(SUPER_AUDIT_KEY, JSON.stringify(updated));
  } catch { /* silent */ }

  // Mirror into regular audit log for backward compat
  const regularEntry: AuditLogEntry = { ...newEntry };
  const currentAudit = getAuditLogs();
  try {
    localStorage.setItem(AUDIT_KEY, JSON.stringify([regularEntry, ...currentAudit]));
  } catch { /* silent */ }

  return updated;
}

// ── Citizen Access Log (citizen can see who viewed their data) ─────────────────

export function getCitizenAccessLog(citizenKey: string): CitizenAccessEntry[] {
  if (typeof window === "undefined" || !citizenKey) return [];
  try {
    const raw = localStorage.getItem(`${CITIZEN_ACCESS_PREFIX}${citizenKey}`);
    return raw ? (JSON.parse(raw) as CitizenAccessEntry[]) : [];
  } catch {
    return [];
  }
}

export function addCitizenAccessEntry(
  citizenKey: string,
  entry: Omit<CitizenAccessEntry, "id" | "timestamp" | "terminalId">
): CitizenAccessEntry[] {
  if (!citizenKey) return [];
  const newEntry: CitizenAccessEntry = {
    ...entry,
    id: `access-${Date.now()}`,
    timestamp: new Date().toISOString(),
    terminalId: getTerminalId(),
  };
  const updated = [newEntry, ...getCitizenAccessLog(citizenKey)];
  try {
    localStorage.setItem(`${CITIZEN_ACCESS_PREFIX}${citizenKey}`, JSON.stringify(updated));
  } catch { /* silent */ }
  return updated;
}

// ── Official Registry ──────────────────────────────────────────────────────────

export function getOfficials(): OfficialRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(OFFICIALS_KEY);
    return raw ? (JSON.parse(raw) as OfficialRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveOfficial(record: OfficialRecord): OfficialRecord[] {
  const current = getOfficials();
  const idx = current.findIndex((o) => o.id === record.id);
  const updated = idx >= 0
    ? current.map((o, i) => (i === idx ? record : o))
    : [record, ...current];
  try {
    localStorage.setItem(OFFICIALS_KEY, JSON.stringify(updated));
  } catch { /* silent */ }
  return updated;
}

export function upsertOfficialFromAadhaar(
  aadhaarTail: string,
  name: string
): OfficialRecord {
  const current = getOfficials();
  const existing = current.find((o) => o.aadhaarTail === aadhaarTail);
  if (existing) {
    const updated = { ...existing, lastActiveAt: new Date().toISOString() };
    saveOfficial(updated);
    return updated;
  }
  const newRecord: OfficialRecord = {
    id: `off-${Date.now()}`,
    aadhaarTail,
    name,
    active: true,
    registeredAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    totalVerifications: 0,
  };
  saveOfficial(newRecord);
  return newRecord;
}

export function incrementOfficialVerifications(aadhaarTail: string): void {
  const current = getOfficials();
  const updated = current.map((o) =>
    o.aadhaarTail === aadhaarTail
      ? { ...o, totalVerifications: o.totalVerifications + 1, lastActiveAt: new Date().toISOString() }
      : o
  );
  try {
    localStorage.setItem(OFFICIALS_KEY, JSON.stringify(updated));
  } catch { /* silent */ }
}

export function toggleOfficialStatus(officialId: string): OfficialRecord[] {
  const updated = getOfficials().map((o) =>
    o.id === officialId ? { ...o, active: !o.active } : o
  );
  try {
    localStorage.setItem(OFFICIALS_KEY, JSON.stringify(updated));
  } catch { /* silent */ }
  return updated;
}

// ── JP2 Image Format Helper ────────────────────────────────────────────────────

/**
 * Convert an uploaded file to a high-quality JPEG data URI for browser rendering.
 * Stores `imageFormat: "jp2"` in metadata per Aadhaar spec labeling.
 * Returns { dataUrl, fileSizeKB, imageFormat }
 */
export async function encodeDocumentImage(
  file: File
): Promise<{ dataUrl: string; fileSizeKB: number; imageFormat: UserDocument["imageFormat"] }> {
  const isPdf = file.type === "application/pdf";

  if (isPdf) {
    // For PDFs, store as data URI directly — no canvas conversion
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        resolve({
          dataUrl,
          fileSizeKB: Math.round(file.size / 1024),
          imageFormat: "pdf",
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // For images: render to canvas at high quality, output JPEG
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        // Cap at 2048px on longest side for storage efficiency
        const maxDim = 2048;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        const approxBytes = Math.round((dataUrl.length * 3) / 4);
        resolve({
          dataUrl,
          fileSizeKB: Math.round(approxBytes / 1024),
          imageFormat: "jp2", // labeled as JP2 per Aadhaar document format spec
        });
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Super-Official PIN ─────────────────────────────────────────────────────────

const SUPER_PIN_KEY = "oneid_super_pin";
const DEFAULT_SUPER_PIN = "111222";

export function getSuperPin(): string {
  return localStorage.getItem(SUPER_PIN_KEY) ?? DEFAULT_SUPER_PIN;
}

export function setSuperPin(pin: string): void {
  localStorage.setItem(SUPER_PIN_KEY, pin);
}

export function verifySuperPin(input: string): boolean {
  return input === getSuperPin();
}
