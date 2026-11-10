import {
  getCurrentEmployee,
  getDatabase,
  toAuthError,
} from "../auth/_lib/employee-auth";

type JobsitePayload = {
  address?: string;
  clientName?: string;
  name?: string;
  status?: string;
};

export async function GET(request: Request) {
  try {
    const employee = await getCurrentEmployee(request);
    if (!employee) {
      return Response.json({ error: "Employee sign-in required." }, { status: 401 });
    }

    await ensureJobsiteTable();
    const rows = await (await getDatabase())
      .prepare(
        `
          SELECT jobsites.id, jobsites.name, jobsites.address, jobsites.client_name,
                 jobsites.status, jobsites.created_at,
                 (
                   SELECT COUNT(*)
                   FROM estimates
                   WHERE estimates.jobsite_id = jobsites.id
                 ) AS estimate_count,
                 (
                   SELECT COALESCE(SUM(estimates.total_cents), 0)
                   FROM estimates
                   WHERE estimates.jobsite_id = jobsites.id
                 ) AS estimate_total_cents
          FROM jobsites
          WHERE jobsites.employee_id = ?
          ORDER BY jobsites.status ASC, jobsites.name ASC
        `,
      )
      .bind(employee.id)
      .all();

    return Response.json({
      jobsites: rows.results.map((jobsite) => ({
        address: jobsite.address,
        clientName: jobsite.client_name,
        createdAt: jobsite.created_at,
        estimateCount: jobsite.estimate_count ?? 0,
        estimateTotal: Number(jobsite.estimate_total_cents ?? 0) / 100,
        id: jobsite.id,
        name: jobsite.name,
        status: jobsite.status,
      })),
    });
  } catch (error) {
    const authError = toAuthError(error);
    return Response.json({ error: authError.message }, { status: authError.status });
  }
}

export async function POST(request: Request) {
  try {
    const employee = await getCurrentEmployee(request);
    if (!employee) {
      return Response.json({ error: "Employee sign-in required." }, { status: 401 });
    }

    const payload = (await request.json()) as JobsitePayload;
    const name = payload.name?.trim() ?? "";
    if (!name) {
      return Response.json({ error: "Jobsite name is required." }, { status: 400 });
    }

    await ensureJobsiteTable();
    const jobsite = await (await getDatabase())
      .prepare(
        `
          INSERT INTO jobsites (employee_id, name, address, client_name, status)
          VALUES (?, ?, ?, ?, ?)
          RETURNING id, name, address, client_name, status, created_at
        `,
      )
      .bind(
        employee.id,
        name,
        payload.address?.trim() ?? "",
        payload.clientName?.trim() ?? "",
        payload.status?.trim() || "Active",
      )
      .first();

    if (!jobsite) {
      return Response.json({ error: "Unable to create jobsite." }, { status: 500 });
    }

    return Response.json(
      {
        jobsite: {
          address: jobsite.address,
          clientName: jobsite.client_name,
          createdAt: jobsite.created_at,
          id: jobsite.id,
          name: jobsite.name,
          status: jobsite.status,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const authError = toAuthError(error);
    return Response.json({ error: authError.message }, { status: authError.status });
  }
}

export async function ensureJobsiteTable() {
  const db = await getDatabase();
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS jobsites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        address TEXT NOT NULL DEFAULT '',
        client_name TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'Active',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      )
    `),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS jobsites_employee_id_idx ON jobsites (employee_id)",
    ),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS estimates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        jobsite_id INTEGER,
        estimate_number TEXT NOT NULL,
        client_name TEXT NOT NULL DEFAULT '',
        project_address TEXT NOT NULL DEFAULT '',
        project_type TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'Draft',
        total_cents INTEGER NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        FOREIGN KEY (jobsite_id) REFERENCES jobsites(id) ON DELETE SET NULL
      )
    `),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS estimates_employee_id_idx ON estimates (employee_id)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS estimates_jobsite_id_idx ON estimates (jobsite_id)",
    ),
  ]);
}
