import { z } from "zod";
import { recordSchema, titleSchema, instantSchema } from "./common";
export const categoryInput = z
  .object({
    name: titleSchema,
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .nullable()
      .default(null),
    icon: z.string().max(40).nullable().default(null),
  })
  .strict();
export const categorySchema = recordSchema.extend({
  ...categoryInput.shape,
  archivedAt: instantSchema.nullable(),
});
export type CategoryInput = z.infer<typeof categoryInput>;
export type Category = z.infer<typeof categorySchema>;
