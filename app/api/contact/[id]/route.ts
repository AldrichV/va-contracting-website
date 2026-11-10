import { getCurrentEmployee, getDatabase, toAuthError } from "../../auth/_lib/employee-auth";
import { QUOTE_STATUSES, ensureContactTable, toQuoteRequest } from "../_store";

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

/** Employees: update a quote request's status and/or internal notes. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const employee = await getCurrentEmployee(request);
    if (!employee) return Response.json({ error: "Employee sign-in required." }, { status: 401 });

    const { id } = await context.params;
    const requestId = Number(id);
    if (!Number.isInteger(requestId) || requestId <= 0) {
      return Response.json({ error: "Unknown request." }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as { notes?: string; status?: string };
    const status = body.status && (QUOTE_STATUSES as readonly string[]).includes(body.status) ? body.status : null;
    const notes = typeof body.notes === "string" ? body.notes.slice(0, 2000) : null;
    if (!status && notes === null) {
      return Response.json({ error: "Nothing to update." }, { status: 400 });
    }

    await ensureContactTable();
    const row = await (await getDatabase())
      .prepare(
        `UPDATE contact_requests
         SET status = COALESCE(?, status), notes = COALESCE(?, notes), updated_at = CURRENT_TIMESTAMP
         WHERE id = ? RETURNING *`,
      )
      .bind(status, notes, requestId)
      .first<Record<string, unknown>>();

    if (!row) return Response.json({ error: "Unknown request." }, { status: 404 });
    return Response.json({ request: toQuoteRequest(row) });
  } catch (error) {
    const authError = toAuthError(error);
    return Response.json({ error: authError.message }, { status: authError.status });
  }
}
