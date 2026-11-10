import {
  getCurrentEmployee,
  getDatabase,
  getMediaBucket,
  toAuthError,
} from "../../auth/_lib/employee-auth";
import { ensureTestimonialTable } from "../route";

type ModerationPayload = {
  moderationReason?: string;
  status?: string;
};

const allowedStatuses = new Set(["pending", "approved", "flagged", "hidden"]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const employee = await getCurrentEmployee(request);
    if (!employee) {
      return Response.json({ error: "Employee sign-in required." }, { status: 401 });
    }

    const { id } = await context.params;
    const testimonialId = Number(id);
    const payload = (await request.json()) as ModerationPayload;
    const status = payload.status?.trim() ?? "";
    if (!testimonialId || !allowedStatuses.has(status)) {
      return Response.json({ error: "Invalid moderation action." }, { status: 400 });
    }

    await ensureTestimonialTable();
    const result = await (await getDatabase())
      .prepare(
        `
          UPDATE testimonials
          SET status = ?, moderation_reason = ?, moderated_by = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
          RETURNING id
        `,
      )
      .bind(
        status,
        payload.moderationReason?.replace(/\s+/g, " ").trim().slice(0, 180) ?? "",
        employee.id,
        testimonialId,
      )
      .first();

    if (!result) {
      return Response.json({ error: "Review not found." }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    const authError = toAuthError(error);
    return Response.json({ error: authError.message }, { status: authError.status });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const employee = await getCurrentEmployee(request);
    if (!employee) {
      return Response.json({ error: "Employee sign-in required." }, { status: 401 });
    }

    const { id } = await context.params;
    await ensureTestimonialTable();
    const db = await getDatabase();
    const testimonial = await db
      .prepare("SELECT image_key FROM testimonials WHERE id = ?")
      .bind(Number(id))
      .first<{ image_key: string }>();

    await db.prepare("DELETE FROM testimonials WHERE id = ?").bind(Number(id)).run();
    if (testimonial?.image_key) {
      await (await getMediaBucket()).delete(testimonial.image_key);
    }

    return Response.json({ ok: true });
  } catch (error) {
    const authError = toAuthError(error);
    return Response.json({ error: authError.message }, { status: authError.status });
  }
}
