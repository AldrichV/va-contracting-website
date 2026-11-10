import {
  createEmployeeSession,
  createPasswordHash,
  employeeResponse,
  ensureAuthTables,
  insertEmployee,
  normalizeEmail,
  sessionCookie,
  toAuthError,
} from "../_lib/employee-auth";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      email?: string;
      name?: string;
      password?: string;
    };

    const name = payload.name?.trim() ?? "";
    const email = normalizeEmail(payload.email ?? "");
    const password = payload.password ?? "";

    if (!name) {
      return Response.json({ error: "Name is required." }, { status: 400 });
    }
    if (!email.includes("@")) {
      return Response.json({ error: "A valid email is required." }, { status: 400 });
    }
    if (password.length < 8) {
      return Response.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 },
      );
    }

    await ensureAuthTables();
    const passwordHash = await createPasswordHash(password);
    const employee = await insertEmployee({
      email,
      name,
      passwordHash: passwordHash.hash,
      passwordSalt: passwordHash.salt,
    });
    const session = await createEmployeeSession(employee.id);

    const response = employeeResponse(employee, 201);
    response.headers.append("Set-Cookie", sessionCookie(session.sessionId, session.expiresAt));
    return response;
  } catch (error) {
    const authError = toAuthError(error);
    if (authError.message.includes("UNIQUE") || authError.message.includes("unique")) {
      return Response.json(
        { error: "An employee account already exists for that email." },
        { status: 409 },
      );
    }
    return Response.json({ error: authError.message }, { status: authError.status });
  }
}
