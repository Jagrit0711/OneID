/**
 * kiosk-store.ts — Dynamic Storage Layer for OneID
 *
 * 100% Dynamic data persistence for beta production:
 *   - Citizen Document Vaults indexed by Aadhaar Reference ID
 *   - Live Audit Logs generated from real official verification sessions
 *   - Zero hardcoded mock data
 */

export type DocType = "pan" | "driving_license" | "ration_card" | "marksheet";

export type UserDocument = {
  id: string;
  type: DocType;
  title: string;
  docNumber: string;
  fileName?: string;
  fileUrl?: string; // Base64 data URL preview
  updatedAt: string;
  allowedForVerification: boolean;
};

export type AuditLogEntry = {
  id: string;
  timestamp: string;
  officialId: string;
  officialName: string;
  citizenName: string;
  citizenUid: string; // Masked Aadhaar reference ID
  faceMatchScore: number;
  faceVerified: boolean;
  signatureValid: boolean;
  accessedDocuments: Array<{
    type: string;
    label: string;
    docNumber?: string | undefined;
  }>;
};

const VAULT_STORAGE_PREFIX = "oneid_vault_";
const AUDIT_STORAGE_KEY = "oneid_audit_logs_v2";

// ── Citizen Document Vault Storage ─────────────────────────────────────────────

export function getUserVault(citizenKey: string): UserDocument[] {
  if (typeof window === "undefined" || !citizenKey) return [];
  try {
    const raw = localStorage.getItem(`${VAULT_STORAGE_PREFIX}${citizenKey}`);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveUserDocument(citizenKey: string, doc: UserDocument): UserDocument[] {
  if (!citizenKey) return [];
  const current = getUserVault(citizenKey);
  const index = current.findIndex((d) => d.type === doc.type);
  let updated: UserDocument[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = doc;
  } else {
    updated = [doc, ...current];
  }
  try {
    localStorage.setItem(`${VAULT_STORAGE_PREFIX}${citizenKey}`, JSON.stringify(updated));
  } catch {
    /* silent */
  }
  return updated;
}

export function toggleDocumentPermission(citizenKey: string, docType: DocType): UserDocument[] {
  if (!citizenKey) return [];
  const current = getUserVault(citizenKey);
  const updated = current.map((d) => {
    if (d.type === docType) {
      return { ...d, allowedForVerification: !d.allowedForVerification };
    }
    return d;
  });
  try {
    localStorage.setItem(`${VAULT_STORAGE_PREFIX}${citizenKey}`, JSON.stringify(updated));
  } catch {
    /* silent */
  }
  return updated;
}

// ── Audit Log Storage ──────────────────────────────────────────────────────────

export function getAuditLogs(): AuditLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function addAuditLog(entry: Omit<AuditLogEntry, "id" | "timestamp">): AuditLogEntry[] {
  const newEntry: AuditLogEntry = {
    ...entry,
    id: `audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
  };
  const current = getAuditLogs();
  const updated = [newEntry, ...current];
  try {
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    /* silent */
  }
  return updated;
}

export function clearAuditLogs(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(AUDIT_STORAGE_KEY);
  } catch {
    /* silent */
  }
}
