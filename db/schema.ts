import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const employees = sqliteTable("employees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const employeeSessions = sqliteTable("employee_sessions", {
  id: text("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const jobsites = sqliteTable("jobsites", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address").notNull().default(""),
  clientName: text("client_name").notNull().default(""),
  status: text("status").notNull().default("Active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const estimates = sqliteTable("estimates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  jobsiteId: integer("jobsite_id").references(() => jobsites.id, {
    onDelete: "set null",
  }),
  estimateNumber: text("estimate_number").notNull(),
  clientName: text("client_name").notNull().default(""),
  projectAddress: text("project_address").notNull().default(""),
  projectType: text("project_type").notNull().default(""),
  status: text("status").notNull().default("Draft"),
  totalCents: integer("total_cents").notNull(),
  payloadJson: text("payload_json").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const testimonials = sqliteTable("testimonials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerName: text("customer_name").notNull(),
  location: text("location").notNull().default(""),
  projectType: text("project_type").notNull().default(""),
  rating: integer("rating").notNull().default(5),
  comment: text("comment").notNull(),
  imageKey: text("image_key").notNull().default(""),
  imageName: text("image_name").notNull().default(""),
  imageType: text("image_type").notNull().default(""),
  imageSize: integer("image_size").notNull().default(0),
  status: text("status").notNull().default("pending"),
  moderationReason: text("moderation_reason").notNull().default(""),
  moderatedBy: integer("moderated_by").references(() => employees.id, {
    onDelete: "set null",
  }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
