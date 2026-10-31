import { tasksClient } from "./tasks";
import { trainingProgramsClient } from "./training-programs";
import { adminClient } from "./admin";
import { exerciseClient } from "./exercise";
import { nutritionClient } from "./nutrition";
import { measurementsClient } from "./measurements";
import { goalsClient } from "./goals";
import { planningClient } from "./planning";
import { calendarClient } from "./calendar";
import { routinesClient } from "./routines";
import { signupResultSchema } from "@168hours/contracts";
import type { Me, Preferences } from "@168hours/contracts";
import { writeHeaders, createHttp, body, type ClientOptions } from "./http";
export * from "./http";
export function createClient(options: ClientOptions = {}) {
  const http = createHttp(options);
  return {
    ...adminClient(http),
    ...tasksClient(http),
    ...calendarClient(http),
    ...routinesClient(http),
    ...exerciseClient(http),
    ...trainingProgramsClient(http),
    ...nutritionClient(http),
    ...measurementsClient(http),
    ...goalsClient(http),
    ...planningClient(http),
    getCurrentUser: () => http<Me>("/api/v1/me"),
    savePreferences: (input: Preferences, version: number, key?: string) =>
      http<Me["preferences"]>("/api/v1/preferences", {
        method: "PUT",
        headers: writeHeaders(key, version),
        body: body(input),
      }),
    signUp: (input: { name: string; email: string; password: string }) =>
      http<unknown>("/api/auth/sign-up/email", {
        method: "POST",
        body: body(input),
      }).then((result) => signupResultSchema.parse(result)),
    signIn: (input: { email: string; password: string }) =>
      http<unknown>("/api/auth/sign-in/email", {
        method: "POST",
        body: body({ email: input.email, password: input.password }),
      }),
    requestPasswordReset: (email: string) =>
      http<{ status: true }>("/api/auth/request-password-reset", {
        method: "POST",
        body: body({ email }),
      }),
    sendVerificationEmail: (email: string) =>
      http<{ status: true }>("/api/auth/send-verification-email", {
        method: "POST",
        body: body({ email }),
      }),
    verifyEmail: (token: string) =>
      http<{ status: true }>("/api/auth/verify-email", {
        method: "POST",
        body: body({ token }),
      }),
    resetPassword: (token: string, newPassword: string) =>
      http<{ status: true }>("/api/auth/reset-password", {
        method: "POST",
        body: body({ token, newPassword }),
      }),
    changePassword: (currentPassword: string, newPassword: string) =>
      http<{ status: true }>("/api/auth/change-password", {
        method: "POST",
        body: body({ currentPassword, newPassword }),
      }),
    signOut: () =>
      http<unknown>("/api/auth/sign-out", { method: "POST", body: "{}" }),
  };
}
export type ApiClient = ReturnType<typeof createClient>;
