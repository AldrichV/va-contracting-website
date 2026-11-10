import { getDatabase } from "../auth/_lib/employee-auth";

export const QUOTE_STATUSES = ["new", "contacted", "quoted", "won", "closed"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export async function ensureContactTable() {
  const db = await getDatabase();
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS contact_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        project_type TEXT NOT NULL DEFAULT '',
        location TEXT NOT NULL DEFAULT '',
        details TEXT NOT NULL,
        photo_keys TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'new',
        notes TEXT NOT NULL DEFAULT '',
        email_status TEXT NOT NULL DEFAULT '',
        ip_hash TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare("CREATE INDEX IF NOT EXISTS contact_requests_status_idx ON contact_requests (status)"),
    db.prepare("CREATE INDEX IF NOT EXISTS contact_requests_created_idx ON contact_requests (created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS contact_requests_ip_idx ON contact_requests (ip_hash, created_at)"),
  ]);
}

export function toQuoteRequest(row: Record<string, unknown>) {
  let photoKeys: string[] = [];
  try {
    photoKeys = JSON.parse(String(row.photo_keys ?? "[]"));
  } catch {
    photoKeys = [];
  }
  return {
    createdAt: String(row.created_at ?? ""),
    details: String(row.details ?? ""),
    email: String(row.email ?? ""),
    emailStatus: String(row.email_status ?? ""),
    id: Number(row.id),
    location: String(row.location ?? ""),
    name: String(row.name ?? ""),
    notes: String(row.notes ?? ""),
    phone: String(row.phone ?? ""),
    photoUrls: photoKeys.map((key) => `/api/contact-files/${encodeURIComponent(key)}`),
    projectType: String(row.project_type ?? ""),
    status: String(row.status ?? "new"),
    updatedAt: String(row.updated_at ?? ""),
  };
}
