import {
  getCurrentEmployee,
  getDatabase,
  getMediaBucket,
  toAuthError,
} from "../auth/_lib/employee-auth";

type TestimonialPayload = {
  comment?: string;
  customerName?: string;
  location?: string;
  projectType?: string;
  rating?: number;
  website?: string;
};

const MAX_TESTIMONIAL_IMAGE_SIZE = 6 * 1024 * 1024;

export async function GET(request: Request) {
  try {
    await ensureTestimonialTable();
    const employee = await getCurrentEmployee(request);
    const db = await getDatabase();
    const url = new URL(request.url);
    const includeAll = url.searchParams.get("all") === "1";

    if (includeAll && employee) {
      const rows = await db
        .prepare(
          `
            SELECT id, customer_name, location, project_type, rating, comment,
                   image_key, image_name, image_type, image_size,
                   status, moderation_reason, created_at, updated_at
            FROM testimonials
            ORDER BY created_at DESC, id DESC
          `,
        )
        .all();
      return Response.json({ testimonials: rows.results.map(toTestimonial) });
    }

    const rows = await db
      .prepare(
        `
          SELECT id, customer_name, location, project_type, rating, comment,
                 image_key, image_name, image_type, image_size,
                 status, moderation_reason, created_at, updated_at
          FROM testimonials
          WHERE status = 'approved'
          ORDER BY created_at DESC, id DESC
          LIMIT 12
        `,
      )
      .all();

    return Response.json({ testimonials: rows.results.map(toTestimonial) });
  } catch (error) {
    const authError = toAuthError(error);
    return Response.json({ error: authError.message }, { status: authError.status });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await readTestimonialPayload(request);
    if (payload.website) {
      return Response.json({ ok: true }, { status: 201 });
    }

    const customerName = cleanText(payload.customerName ?? "", 80);
    const location = cleanText(payload.location ?? "", 80);
    const projectType = cleanText(payload.projectType ?? "", 80);
    const comment = cleanText(payload.comment ?? "", 900);
    const rating = Math.max(1, Math.min(5, Math.round(Number(payload.rating ?? 5))));

    if (!customerName || !comment || comment.length < 20) {
      return Response.json(
        { error: "Name and a review of at least 20 characters are required." },
        { status: 400 },
      );
    }

    await ensureTestimonialTable();
    const image = await uploadTestimonialImage(payload.image);
    await (await getDatabase())
      .prepare(
        `
          INSERT INTO testimonials (
            customer_name, location, project_type, rating, comment,
            image_key, image_name, image_type, image_size
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .bind(
        customerName,
        location,
        projectType,
        rating,
        comment,
        image.key,
        image.name,
        image.type,
        image.size,
      )
      .run();

    return Response.json(
      {
        message:
          "Thank you. Your testimonial was submitted and will appear after review.",
      },
      { status: 201 },
    );
  } catch (error) {
    const authError = toAuthError(error);
    return Response.json({ error: authError.message }, { status: authError.status });
  }
}

export async function ensureTestimonialTable() {
  const db = await getDatabase();
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS testimonials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        location TEXT NOT NULL DEFAULT '',
        project_type TEXT NOT NULL DEFAULT '',
        rating INTEGER NOT NULL DEFAULT 5,
        comment TEXT NOT NULL,
        image_key TEXT NOT NULL DEFAULT '',
        image_name TEXT NOT NULL DEFAULT '',
        image_type TEXT NOT NULL DEFAULT '',
        image_size INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        moderation_reason TEXT NOT NULL DEFAULT '',
        moderated_by INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (moderated_by) REFERENCES employees(id) ON DELETE SET NULL
      )
    `),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS testimonials_status_idx ON testimonials (status)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS testimonials_created_at_idx ON testimonials (created_at)",
    ),
  ]);

  await addColumnIfMissing("testimonials", "image_key", "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing("testimonials", "image_name", "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing("testimonials", "image_type", "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing("testimonials", "image_size", "INTEGER NOT NULL DEFAULT 0");
}

function toTestimonial(row: Record<string, unknown>) {
  return {
    comment: row.comment,
    createdAt: row.created_at,
    customerName: row.customer_name,
    id: row.id,
    imageName: row.image_name,
    imageSize: row.image_size,
    imageType: row.image_type,
    imageUrl: row.image_key ? `/api/testimonial-images/${encodeURIComponent(String(row.image_key))}` : "",
    location: row.location,
    moderationReason: row.moderation_reason,
    projectType: row.project_type,
    rating: row.rating,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

function cleanText(value: string, maxLength: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

async function readTestimonialPayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return (await request.json()) as TestimonialPayload & { image?: File };
  }

  const formData = await request.formData();
  const image = formData.get("image");
  return {
    comment: String(formData.get("comment") ?? ""),
    customerName: String(formData.get("customerName") ?? ""),
    image: image instanceof File ? image : undefined,
    location: String(formData.get("location") ?? ""),
    projectType: String(formData.get("projectType") ?? ""),
    rating: Number(formData.get("rating") ?? 5),
    website: String(formData.get("website") ?? ""),
  };
}

async function uploadTestimonialImage(file?: File) {
  if (!file || file.size === 0) {
    return { key: "", name: "", size: 0, type: "" };
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Testimonial uploads must be image files.");
  }
  if (file.size > MAX_TESTIMONIAL_IMAGE_SIZE) {
    throw new Error("Testimonial images must be 6 MB or smaller.");
  }

  const key = `testimonial-${crypto.randomUUID()}-${cleanFilename(file.name)}`;
  await (await getMediaBucket()).put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type || "image/jpeg",
    },
  });

  return {
    key,
    name: file.name,
    size: file.size,
    type: file.type || "image/jpeg",
  };
}

async function addColumnIfMissing(table: string, columnName: string, definition: string) {
  const db = await getDatabase();
  const columns = await db.prepare(`PRAGMA table_info(${table})`).all();
  const hasColumn = columns.results.some(
    (column) => String(column.name) === columnName,
  );
  if (!hasColumn) {
    await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${columnName} ${definition}`).run();
  }
}

function cleanFilename(name: string) {
  return (
    name
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "testimonial-image"
  );
}
