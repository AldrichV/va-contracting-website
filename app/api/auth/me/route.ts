import { getCurrentEmployee, toAuthError } from "../_lib/employee-auth";

export async function GET(request: Request) {
  try {
    const employee = await getCurrentEmployee(request);
    return Response.json({ employee });
  } catch (error) {
    const authError = toAuthError(error);
    return Response.json({ employee: null, error: authError.message }, { status: 200 });
  }
}
