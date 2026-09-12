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
  user: z.object({ id: z.uuid(), name: z.string(), email: z.email() }),
  preferences: preferencesInput,
});
export const authInput = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().max(254),
  password: z.string().min(12).max(128),
});
export type Preferences = z.infer<typeof preferencesInput>;
export type Me = z.infer<typeof meSchema>;
