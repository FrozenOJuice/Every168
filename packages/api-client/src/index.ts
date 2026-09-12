import { exerciseClient } from "./exercise";
import { nutritionClient } from "./nutrition";
import { measurementsClient } from "./measurements";
import { goalsClient } from "./goals";
import { planningClient } from "./planning";
import type { Me, Preferences } from "@168hours/contracts";
import { createHttp, body, type ClientOptions } from "./http";
export * from "./http";
export function createClient(options: ClientOptions = {}) {
  const http = createHttp(options);
  return {
    ...exerciseClient(http),
    ...nutritionClient(http),
    ...measurementsClient(http),
    ...goalsClient(http),
    ...planningClient(http),
    getCurrentUser: () => http<Me>("/api/v1/me"),
    savePreferences: (input: Preferences) =>
      http<Preferences>("/api/v1/preferences", {
        method: "PUT",
        body: body(input),
      }),
    signUp: (input: { name: string; email: string; password: string }) =>
      http<unknown>("/api/auth/sign-up/email", {
        method: "POST",
        body: body(input),
      }),
    signIn: (input: { email: string; password: string }) =>
      http<unknown>("/api/auth/sign-in/email", {
        method: "POST",
        body: body(input),
      }),
    signOut: () =>
      http<unknown>("/api/auth/sign-out", { method: "POST", body: "{}" }),
  };
}
export type ApiClient = ReturnType<typeof createClient>;
