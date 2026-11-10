import {
  getCurrentEmployee,
  getDatabase,
  getMediaBucket,
  toAuthError,
} from "../../auth/_lib/employee-auth";
import { ensureTestimonialTable } from "../../testimonials/route";

type RouteContext = {
  params: Promise<{ key: string }> | { key: string };
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { key } = await context.params;
    const decodedKey = decodeURIComponent(key);
    await ensureTestimonialTable();

    const testimonial = await (await getDatabase())
      .prepare("SELECT status FROM testimonials WHERE image_key = ?")
      .bind(decodedKey)
      .first<{ status: string }>();
    const employee = await getCurrentEmployee(request);
    if (!testimonial || (testimonial.status !== "approved" && !employee)) {
      return Response.json({ error: "Image not found." }, { status: 404 });
    }

    const object = await (await getMediaBucket()).get(decodedKey);
    if (!object) {
      return Response.json({ error: "Image not found." }, { status: 404 });
    }

    return new Response(object.body, {
      headers: {
        "Cache-Control":
          testimonial.status === "approved"
            ? "public, max-age=3600"
            : "private, max-age=60",
        "Content-Type": object.httpMetadata?.contentType ?? "image/jpeg",
      },
    });
  } catch (error) {
    const authError = toAuthError(error);
    return Response.json({ error: authError.message }, { status: authError.status });
  }
}
