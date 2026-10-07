import { z } from "zod";
export const preferencesInput = z
  .object({
    timezone: z
      .string()
      .max(100)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, "Choose a valid IANA timezone"),
    weekStartsOn: z.union([z.literal(0), z.literal(1)]),
    weightUnit: z.enum(["kg", "lb"]),
    distanceUnit: z.enum(["km", "mi"]),
  })
  .strict();
export const meSchema = z.object({
  user: z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.email(),
    accountType: z.enum(["user", "admin"]),
  }),
  preferences: preferencesInput.extend({
    version: z.number().int().positive(),
  }),
});
export const signInInput = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    password: z.string().min(1).max(128),
  })
  .strict();
export const authInput = signInInput.extend({
  name: z.string().trim().min(1).max(100),
  password: z.string().min(12).max(128),
});
export const authUserSchema = meSchema.shape.user.omit({ accountType: true });
export const authSessionSchema = z
  .object({
    user: authUserSchema,
    session: z.object({ expiresAt: z.iso.datetime() }),
  })
  .nullable();
export type Preferences = z.infer<typeof preferencesInput>;
export type Me = z.infer<typeof meSchema>;
