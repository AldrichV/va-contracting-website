import { getCurrentEmployee, getMediaBucket, toAuthError } from "../../auth/_lib/employee-auth";

type RouteContext = { params: Promise<{ key: string }> | { key: string } };

/** Employees only: photos customers attached to quote requests. */
export async function GET(request: Request, context: RouteContext) {
  try {
    const employee = await getCurrentEmployee(request);
    if (!employee) return Response.json({ error: "Employee sign-in required." }, { status: 401 });

    const { key } = await context.params;
    const decodedKey = decodeURIComponent(key);
    if (!decodedKey.startsWith("quote-")) {
      return Response.json({ error: "File not found." }, { status: 404 });
    }

    const object = await (await getMediaBucket()).get(decodedKey);
    if (!object) return Response.json({ error: "File not found." }, { status: 404 });

    return new Response(object.body, {
      headers: {
        "Cache-Control": "private, max-age=3600",
        "Content-Type": object.httpMetadata?.contentType ?? "image/jpeg",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const authError = toAuthError(error);
    return Response.json({ error: authError.message }, { status: authError.status });
  }
}
