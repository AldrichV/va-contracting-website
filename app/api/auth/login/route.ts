import {
  createEmployeeSession,
  employeeResponse,
  ensureAuthTables,
  findEmployeeByEmail,
  normalizeEmail,
  sessionCookie,
  toAuthError,
  verifyPassword,
} from "../_lib/employee-auth";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      email?: string;
      password?: string;
    };

    const email = normalizeEmail(payload.email ?? "");
    const password = payload.password ?? "";

    await ensureAuthTables();
    const employee = await findEmployeeByEmail(email);
    if (!employee) {
      return Response.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const validPassword = await verifyPassword(
      password,
      employee.password_salt,
      employee.password_hash,
    );
    if (!validPassword) {
      return Response.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const session = await createEmployeeSession(employee.id);
    const response = employeeResponse({
      email: employee.email,
      id: employee.id,
      name: employee.name,
    });
    response.headers.append("Set-Cookie", sessionCookie(session.sessionId, session.expiresAt));
    return response;
  } catch (error) {
    const authError = toAuthError(error);
    return Response.json({ error: authError.message }, { status: authError.status });
  }
}
