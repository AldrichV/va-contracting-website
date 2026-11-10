export type Employee = {
  email: string;
  id: number;
  name: string;
};

type EmployeeRow = Employee & {
  password_hash: string;
  password_salt: string;
};

const SESSION_COOKIE = "va_employee_session";
const SESSION_DAYS = 14;
const HASH_ITERATIONS = 100_000;

export async function ensureAuthTables() {
  const db = await getDatabase();
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS employee_sessions (
        id TEXT PRIMARY KEY,
        employee_id INTEGER NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      )
    `),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS employee_sessions_employee_id_idx ON employee_sessions (employee_id)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS employee_sessions_expires_at_idx ON employee_sessions (expires_at)",
    ),
  ]);
}

export async function createEmployeeSession(employeeId: number) {
  const sessionId = randomToken();
  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const db = await getDatabase();
  await db
    .prepare(
      "INSERT INTO employee_sessions (id, employee_id, expires_at) VALUES (?, ?, ?)",
    )
    .bind(sessionId, employeeId, expiresAt)
    .run();

  return { expiresAt, sessionId };
}

export async function createPasswordHash(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await hashPassword(password, salt);
  return {
    hash: toBase64(hash),
    salt: toBase64(salt),
  };
}

export async function findEmployeeByEmail(email: string) {
  const db = await getDatabase();
  return db
    .prepare<EmployeeRow>(
      "SELECT id, name, email, password_hash, password_salt FROM employees WHERE email = ?",
    )
    .bind(normalizeEmail(email))
    .first();
}

export async function getCurrentEmployee(request: Request) {
  const sessionId = readCookie(request, SESSION_COOKIE);
  if (!sessionId) return null;

  await ensureAuthTables();
  const db = await getDatabase();
  const row = await db
    .prepare<Employee & { expires_at: string }>(
      `
        SELECT employees.id, employees.name, employees.email, employee_sessions.expires_at
        FROM employee_sessions
        JOIN employees ON employees.id = employee_sessions.employee_id
        WHERE employee_sessions.id = ?
      `,
    )
    .bind(sessionId)
    .first();

  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await deleteSession(sessionId);
    return null;
  }

  return { email: row.email, id: row.id, name: row.name };
}

export async function insertEmployee(input: {
  email: string;
  name: string;
  passwordHash: string;
  passwordSalt: string;
}) {
  const db = await getDatabase();
  const result = await db
    .prepare(
      "INSERT INTO employees (name, email, password_hash, password_salt) VALUES (?, ?, ?, ?) RETURNING id, name, email",
    )
    .bind(
      input.name.trim(),
      normalizeEmail(input.email),
      input.passwordHash,
      input.passwordSalt,
    )
    .first<Employee>();

  if (!result) throw new Error("Unable to create employee account.");
  return result;
}

export async function deleteSession(sessionId: string) {
  const db = await getDatabase();
  await db
    .prepare("DELETE FROM employee_sessions WHERE id = ?")
    .bind(sessionId)
    .run();
}

export async function deleteCurrentSession(request: Request) {
  const sessionId = readCookie(request, SESSION_COOKIE);
  if (sessionId) await deleteSession(sessionId);
}

export async function verifyPassword(password: string, salt: string, hash: string) {
  const candidate = await hashPassword(password, fromBase64(salt));
  return constantTimeEqual(toBase64(candidate), hash);
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function employeeResponse(employee: Employee, status = 200) {
  return Response.json({ employee }, { status });
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function sessionCookie(sessionId: string, expiresAt: string) {
  const maxAge = Math.max(
    0,
    Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
  );
  return `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export function toAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (
    message.includes("D1 binding") ||
    message.includes("R2 binding") ||
    message.includes("no such table") ||
    message.includes("database")
  ) {
    return {
      message:
        "Employee tools need the hosted database and file storage configured. Check the Cloudflare bindings, then try again.",
      status: 503,
    };
  }

  return { message, status: 500 };
}

export async function getDatabase() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) {
    throw new Error("D1 binding `DB` is unavailable.");
  }
  return env.DB;
}

export async function getMediaBucket() {
  const { env } = await import("cloudflare:workers");
  if (!env.RECEIPTS) {
    throw new Error("Media storage binding `RECEIPTS` is unavailable.");
  }
  return env.RECEIPTS;
}

export async function getEstimateEmailConfig() {
  const { env } = await import("cloudflare:workers");
  const gmailClientId = cleanRuntimeValue(env.GMAIL_CLIENT_ID);
  const gmailClientSecret = cleanRuntimeValue(env.GMAIL_CLIENT_SECRET);
  const gmailRefreshToken = cleanRuntimeValue(env.GMAIL_REFRESH_TOKEN);
  const resendApiKey = cleanApiKey(env.RESEND_API_KEY);
  const fromEmail = cleanRuntimeValue(env.ESTIMATE_FROM_EMAIL);
  const bccEmail = cleanRuntimeValue(env.ESTIMATE_BCC_EMAIL);

  if (!fromEmail) {
    throw new Error("Estimate email sending is not configured.");
  }

  if (gmailClientId && gmailClientSecret && gmailRefreshToken) {
    return {
      bccEmail,
      fromEmail,
      gmail: {
        clientId: gmailClientId,
        clientSecret: gmailClientSecret,
        refreshToken: gmailRefreshToken,
      },
      provider: "gmail" as const,
      resend: resendApiKey ? { apiKey: resendApiKey } : null,
    };
  }

  if (resendApiKey) {
    return {
      bccEmail,
      fromEmail,
      gmail: null,
      provider: "resend" as const,
      resend: { apiKey: resendApiKey },
    };
  }

  throw new Error("Estimate email sending is not configured.");
}

export function describeRuntimeSecret(value: string) {
  return {
    hasEllipsis: value.includes("..."),
    length: value.length,
    prefix: value.slice(0, 3),
    startsWithResendPrefix: value.startsWith("re_"),
  };
}

function cleanApiKey(value: unknown) {
  return cleanRuntimeValue(value)
    .replace(/^authorization:\s*/i, "")
    .replace(/^bearer\s+/i, "")
    .replace(/[\s\u200B-\u200D\uFEFF]/g, "");
}

function cleanRuntimeValue(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .trim();
}

async function hashPassword(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      hash: "SHA-256",
      iterations: HASH_ITERATIONS,
      name: "PBKDF2",
      salt,
    },
    key,
    256,
  );

  return new Uint8Array(bits);
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

function randomToken() {
  return toBase64(crypto.getRandomValues(new Uint8Array(32)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function readCookie(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  const pairs = cookie.split(";").map((part) => part.trim());
  const match = pairs.find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
