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
    durationUnit: z.enum(["min_sec", "s", "min", "h"]).default("min_sec"),
    distanceUnit: z.enum(["m", "km", "yd", "mi"]),
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

export const accountEmailInput = z
  .object({ email: signInInput.shape.email })
  .strict();
export const accountTokenInput = z
  .object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) })
  .strict();
export const resetPasswordInput = accountTokenInput.extend({
  newPassword: authInput.shape.password,
});
export const changePasswordInput = z
  .object({
    currentPassword: signInInput.shape.password,
    newPassword: authInput.shape.password,
  })
  .strict();

export const signupResultSchema = z.object({
  status: z.literal(true),
  verificationRequired: z.boolean(),
});
