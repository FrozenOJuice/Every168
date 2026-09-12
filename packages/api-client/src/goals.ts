import type {
  Goal,
  GoalInput,
  GoalsQuery,
  Page,
  Dashboard,
} from "@168hours/contracts";
import { body, query, type Http } from "./http";
export function goalsClient(http: Http) {
  return {
    getGoals: (q: Partial<GoalsQuery> = {}) =>
      http<Page<Goal>>("/api/v1/goals" + query(q)),
    createGoal: (v: GoalInput) =>
      http<Goal>("/api/v1/goals", { method: "POST", body: body(v) }),
    updateGoal: (id: string, v: GoalInput) =>
      http<Goal>("/api/v1/goals/" + id, { method: "PUT", body: body(v) }),
    getDashboard: () => http<Dashboard>("/api/v1/dashboard"),
  };
}
