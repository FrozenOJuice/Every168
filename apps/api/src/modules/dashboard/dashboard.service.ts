import type { StrengthService } from "../exercise/strength.service.js";
import type { CardioService } from "../exercise/cardio.service.js";
import type { BodyService } from "../body/body.service.js";
import type { HydrationService } from "../hydration/hydration.service.js";
import type { NutritionService } from "../nutrition/nutrition.service.js";
import { localDate } from "@168hours/domain-utils";
import type { IdentityService } from "../identity/identity.service.js";
import type { PlanningService } from "../planning/planning.service.js";
import type { GoalsService } from "../goals/goals.service.js";
export function dashboardService(
  identity: IdentityService,
  planning: PlanningService,
  goals: GoalsService,
  nutrition: NutritionService,
  hydration: HydrationService,
  body: BodyService,
  strength: StrengthService,
  cardio: CardioService,
) {
  return {
    async getDashboard(u: string) {
      const prefs = await identity.getPreferences(u);
      const now = new Date();
      const today = localDate(now, prefs.timezone);
      const [week, active, food, water, weight, lastWorkout, lastCardio] =
        await Promise.all([
          planning.getWeek(u, today),
          goals.list(u, { status: "active", limit: 5 }),
          nutrition.daily(u, today),
          hydration.daily(u, today),
          body.latest(u),
          strength.latest(u),
          cardio.latest(u),
        ]);
      const todayIds = week.days.find((d) => d.date === today)?.blockIds ?? [];
      return {
        lastWorkout,
        lastCardio,
        nutrition: { count: food.count, totals: food.totals },
        water,
        weight,
        today,
        now: now.toISOString(),
        week,
        todayBlocks: week.blocks.filter((b) => todayIds.includes(b.id)),
        goals: active.items,
      };
    },
  };
}
export type DashboardService = ReturnType<typeof dashboardService>;
