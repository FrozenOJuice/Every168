import type {
  Goal,
  GoalInput,
  GoalsQuery,
  Page,
  Dashboard,
} from "@168hours/contracts";
import { writeHeaders, body, query, type Http } from "./http";
export function goalsClient(http: Http) {
  return {
    getGoals: (q: Partial<GoalsQuery> = {}) =>
      http<Page<Goal>>("/api/v1/goals" + query(q)),
    createGoal: (v: GoalInput, key?: string) =>
      http<Goal>("/api/v1/goals", {
        method: "POST",
        headers: writeHeaders(key),
        body: body(v),
      }),
    updateGoal: (id: string, v: GoalInput, version: number, key?: string) =>
      http<Goal>("/api/v1/goals/" + id, {
        method: "PUT",
        headers: writeHeaders(key, version),
        body: body(v),
      }),
    getDashboard: () => http<Dashboard>("/api/v1/dashboard"),
  };
}
