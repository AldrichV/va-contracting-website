import {
  getCurrentEmployee,
  getDatabase,
  toAuthError,
} from "../auth/_lib/employee-auth";
import { ensureJobsiteTable } from "../jobsites/route";

type EstimatePayload = {
  clientName?: string;
  estimateNumber?: string;
  id?: number | string;
  jobsiteId?: number | string;
  payload?: unknown;
  projectAddress?: string;
  projectType?: string;
  status?: string;
  total?: number;
};

type DeleteEstimatePayload = {
  id?: number | string;
};

export async function GET(request: Request) {
  try {
    const employee = await getCurrentEmployee(request);
    if (!employee) {
      return Response.json({ error: "Employee sign-in required." }, { status: 401 });
    }

    await ensureEstimateTable();
    const estimates = await (await getDatabase())
      .prepare(
        `
          SELECT estimates.id, estimates.jobsite_id, jobsites.name AS jobsite_name,
                 estimates.estimate_number, estimates.client_name,
                 estimates.project_address, estimates.project_type, estimates.status,
                 estimates.total_cents, estimates.payload_json, estimates.created_at
          FROM estimates
          LEFT JOIN jobsites ON jobsites.id = estimates.jobsite_id
          WHERE estimates.employee_id = ?
          ORDER BY estimates.created_at DESC, estimates.id DESC
        `,
      )
      .bind(employee.id)
      .all();

    return Response.json({
      estimates: estimates.results.map(toEstimateResponse),
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

    const payload = (await request.json()) as EstimatePayload;
    const estimateNumber = payload.estimateNumber?.trim() ?? "";
    const total = Number(payload.total ?? 0);
    const jobsiteId = Number(payload.jobsiteId || 0);

    if (!estimateNumber || total < 0) {
      return Response.json(
        { error: "Estimate number and total are required." },
        { status: 400 },
      );
    }

    await ensureEstimateTable();
    const existingNumber = await findEstimateByNumber(employee.id, estimateNumber);
    if (existingNumber) {
      return Response.json(
        { error: `Document number ${estimateNumber} is already used.` },
        { status: 409 },
      );
    }

    if (jobsiteId > 0) {
      const ownedJobsite = await (await getDatabase())
        .prepare("SELECT id FROM jobsites WHERE id = ? AND employee_id = ?")
        .bind(jobsiteId, employee.id)
        .first();
      if (!ownedJobsite) {
        return Response.json({ error: "Invalid jobsite." }, { status: 400 });
      }
    }

    const estimate = await (await getDatabase())
      .prepare(
        `
          INSERT INTO estimates (
            employee_id, jobsite_id, estimate_number, client_name, project_address,
            project_type, status, total_cents, payload_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id, jobsite_id, estimate_number, client_name, project_address,
                    project_type, status, total_cents, payload_json, created_at
        `,
      )
      .bind(
        employee.id,
        jobsiteId > 0 ? jobsiteId : null,
        estimateNumber,
        payload.clientName?.trim() ?? "",
        payload.projectAddress?.trim() ?? "",
        payload.projectType?.trim() ?? "",
        payload.status?.trim() || "Draft",
        Math.round(total * 100),
        JSON.stringify(payload.payload ?? {}),
      )
      .first();

    if (!estimate) {
      return Response.json({ error: "Unable to save document." }, { status: 500 });
    }

    return Response.json(
      {
        estimate: toEstimateResponse({
          ...estimate,
          jobsite_name: jobsiteId > 0 ? await getJobsiteName(jobsiteId, employee.id) : "",
        }),
      },
      { status: 201 },
    );
  } catch (error) {
    const authError = toAuthError(error);
    return Response.json({ error: authError.message }, { status: authError.status });
  }
}

export async function PUT(request: Request) {
  try {
    const employee = await getCurrentEmployee(request);
    if (!employee) {
      return Response.json({ error: "Employee sign-in required." }, { status: 401 });
    }

    const payload = (await request.json()) as EstimatePayload;
    const estimateId = Number(payload.id || 0);
    const estimateNumber = payload.estimateNumber?.trim() ?? "";
    const total = Number(payload.total ?? 0);
    const jobsiteId = Number(payload.jobsiteId || 0);

    if (!estimateId || !estimateNumber || total < 0) {
      return Response.json(
        { error: "Saved document, document number, and total are required." },
        { status: 400 },
      );
    }

    await ensureEstimateTable();
    const existing = await (await getDatabase())
      .prepare("SELECT id FROM estimates WHERE id = ? AND employee_id = ?")
      .bind(estimateId, employee.id)
      .first();
    if (!existing) {
      return Response.json({ error: "Saved document not found." }, { status: 404 });
    }

    const duplicateNumber = await findEstimateByNumber(
      employee.id,
      estimateNumber,
      estimateId,
    );
    if (duplicateNumber) {
      return Response.json(
        { error: `Document number ${estimateNumber} is already used.` },
        { status: 409 },
      );
    }

    if (jobsiteId > 0) {
      const ownedJobsite = await (await getDatabase())
        .prepare("SELECT id FROM jobsites WHERE id = ? AND employee_id = ?")
        .bind(jobsiteId, employee.id)
        .first();
      if (!ownedJobsite) {
        return Response.json({ error: "Invalid jobsite." }, { status: 400 });
      }
    }

    const estimate = await (await getDatabase())
      .prepare(
        `
          UPDATE estimates
          SET jobsite_id = ?, estimate_number = ?, client_name = ?,
              project_address = ?, project_type = ?, status = ?,
              total_cents = ?, payload_json = ?
          WHERE id = ? AND employee_id = ?
          RETURNING id, jobsite_id, estimate_number, client_name, project_address,
                    project_type, status, total_cents, payload_json, created_at
        `,
      )
      .bind(
        jobsiteId > 0 ? jobsiteId : null,
        estimateNumber,
        payload.clientName?.trim() ?? "",
        payload.projectAddress?.trim() ?? "",
        payload.projectType?.trim() ?? "",
        payload.status?.trim() || "Draft",
        Math.round(total * 100),
        JSON.stringify(payload.payload ?? {}),
        estimateId,
        employee.id,
      )
      .first();

    if (!estimate) {
      return Response.json({ error: "Unable to update saved document." }, { status: 500 });
    }

    return Response.json({
      estimate: toEstimateResponse({
        ...estimate,
        jobsite_name: jobsiteId > 0 ? await getJobsiteName(jobsiteId, employee.id) : "",
      }),
    });
  } catch (error) {
    const authError = toAuthError(error);
    return Response.json({ error: authError.message }, { status: authError.status });
  }
}

export async function DELETE(request: Request) {
  try {
    const employee = await getCurrentEmployee(request);
    if (!employee) {
      return Response.json({ error: "Employee sign-in required." }, { status: 401 });
    }

    const payload = (await request.json()) as DeleteEstimatePayload;
    const estimateId = Number(payload.id || 0);
    if (!estimateId) {
      return Response.json({ error: "Saved document is required." }, { status: 400 });
    }

    await ensureEstimateTable();
    const result = await (await getDatabase())
      .prepare("DELETE FROM estimates WHERE id = ? AND employee_id = ?")
      .bind(estimateId, employee.id)
      .run();

    if (!result.meta.changes) {
      return Response.json({ error: "Saved document not found." }, { status: 404 });
    }

    return Response.json({ message: "Saved document deleted." });
  } catch (error) {
    const authError = toAuthError(error);
    return Response.json({ error: authError.message }, { status: authError.status });
  }
}

export async function ensureEstimateTable() {
  await ensureJobsiteTable();
}

async function getJobsiteName(jobsiteId: number, employeeId: number) {
  const jobsite = await (await getDatabase())
    .prepare("SELECT name FROM jobsites WHERE id = ? AND employee_id = ?")
    .bind(jobsiteId, employeeId)
    .first<{ name: string }>();
  return jobsite?.name ?? "";
}

async function findEstimateByNumber(
  employeeId: number,
  estimateNumber: string,
  excludeEstimateId = 0,
) {
  const query =
    excludeEstimateId > 0
      ? `
          SELECT id FROM estimates
          WHERE employee_id = ? AND estimate_number = ? AND id != ?
          LIMIT 1
        `
      : `
          SELECT id FROM estimates
          WHERE employee_id = ? AND estimate_number = ?
          LIMIT 1
        `;
  const statement = (await getDatabase()).prepare(query);
  return excludeEstimateId > 0
    ? statement.bind(employeeId, estimateNumber, excludeEstimateId).first()
    : statement.bind(employeeId, estimateNumber).first();
}

function parsePayload(value: unknown) {
  if (typeof value !== "string") return {};
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return {};
  }
}

function toEstimateResponse(estimate: Record<string, unknown>) {
  return {
    clientName: estimate.client_name,
    createdAt: estimate.created_at,
    estimateNumber: estimate.estimate_number,
    id: estimate.id,
    jobsiteId: estimate.jobsite_id,
    jobsiteName: estimate.jobsite_name ?? "",
    payload: parsePayload(estimate.payload_json),
    projectAddress: estimate.project_address,
    projectType: estimate.project_type,
    status: estimate.status,
    total: Number(estimate.total_cents ?? 0) / 100,
  };
}
