import { z } from "zod";
export const idSchema = z.uuid();
export const instantSchema = z.iso.datetime({ offset: true });
export const dateSchema = z.iso.date();
export const titleSchema = z.string().trim().min(1).max(160);
export const notesSchema = z.string().trim().max(4000).nullable().default(null);
export const recordSchema = z.object({
  id: idSchema,
  createdAt: instantSchema,
  updatedAt: instantSchema,
});
export const pageQuerySchema = z.object({
  cursor: z.string().max(300).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type PageQuery = z.infer<typeof pageQuerySchema>;
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), nextCursor: z.string().nullable() });
}
export type Page<T> = { items: T[]; nextCursor: string | null };
export const dateQuerySchema = z.object({ date: dateSchema });
export const okSchema = z.object({ ok: z.literal(true) });
export const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
});
