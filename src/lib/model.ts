import { z } from "zod";
const id = z.string().uuid();
const optionalId = id
  .or(z.literal(""))
  .optional()
  .transform((v) => v || undefined);
const text = z.string().max(10000).default("");
export function validHttpUrl(value: string): boolean {
  try {
    if (/\s/.test(value) || !/^https?:\/\//i.test(value)) return false;
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) && !!parsed.hostname && !parsed.username && !parsed.password;
  } catch { return false; }
}
const requiredUrl = z.string().trim().min(1).max(2048).refine(validHttpUrl, "To‘g‘ri HTTP(S) havola kiriting; login-parolni havolaga yozmang");
const url = requiredUrl.or(z.literal("")).default("");
export const projectSchema = z.object({
  id: optionalId,
  name: z.string().trim().min(1).max(200),
  description: text,
  status: z
    .enum(["idea", "building", "live", "paused", "archived"])
    .default("idea"),
  platform: z
    .enum(["website", "telegram", "mobile", "api", "other"])
    .default("website"),
  ownership: z.enum(["solo", "team"]).default("solo"),
  groupId: id
    .nullable()
    .optional()
    .transform((v) => v || null),
  tags: z.array(z.string().max(80)).max(30).default([]),
  favorite: z.boolean().default(false),
  links: z
    .array(
      z.object({
        id: optionalId,
        label: z.string().max(200).default(""),
        url: requiredUrl,
        kind: z.string().max(100).default("website"),
        note: text,
      }),
    )
    .max(100)
    .default([]),
  accounts: z
    .array(
      z.object({
        id: optionalId,
        label: z.string().max(200).default(""),
        role: z.string().max(200).default(""),
        login: z.string().max(500).default(""),
        password: z.string().max(4000).default(""),
        url,
        note: text,
      }),
    )
    .max(100)
    .default([]),
  tasks: z
    .array(
      z.object({
        id: optionalId,
        text: z.string().max(2000),
        done: z.boolean().default(false),
      }),
    )
    .max(500)
    .default([]),
  notes: text,
  domainExpiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional()
    .or(z.literal(""))
    .transform((v) => v || null),
  hostingExpiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional()
    .or(z.literal(""))
    .transform((v) => v || null),
  monitor: z
    .object({
      enabled: z.boolean().default(false),
      url,
      expectedStatus: z.number().int().min(100).max(599).default(200),
    })
    .refine((m) => !m.enabled || !!m.url, {message: "Monitoring manzilini kiriting", path: ["url"]})
    .default({ enabled: false, url: "", expectedStatus: 200 }),
});
export type ProjectInput = z.infer<typeof projectSchema>;
export type Project = ProjectInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
  monitor: ProjectInput["monitor"] & {
    status?: string;
    lastCheckedAt?: string;
    error?: string;
  };
};
export const groupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#6366f1"),
});
