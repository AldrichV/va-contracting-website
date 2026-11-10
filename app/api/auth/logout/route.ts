import {
  clearSessionCookie,
  deleteCurrentSession,
  ensureAuthTables,
  toAuthError,
} from "../_lib/employee-auth";

export async function POST(request: Request) {
  try {
    await ensureAuthTables();
    await deleteCurrentSession(request);

    const response = Response.json({ ok: true });
    response.headers.append("Set-Cookie", clearSessionCookie());
    return response;
  } catch (error) {
    const authError = toAuthError(error);
    return Response.json({ error: authError.message }, { status: authError.status });
  }
}
