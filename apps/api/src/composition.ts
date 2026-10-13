import { calendarActivityService } from "./modules/planning/calendar-activity.service.js";
import { routinesRepository } from "./modules/routines/routines.repository.js";
import { routinesService } from "./modules/routines/routines.service.js";
import apiPackage from "../package.json" with { type: "json" };
import { AppError } from "./shared/errors/app-error.js";
import { adminRepository } from "./modules/identity/admin.repository.js";
import { adminService } from "./modules/identity/admin.service.js";
import { requestMetrics } from "./infrastructure/logging/request-metrics.js";
import { calendarItemsRepository } from "./modules/planning/calendar-items.repository.js";
import { calendarItemsService } from "./modules/planning/calendar-items.service.js";
import { seriesRepository } from "./modules/planning/series.repository.js";
import { seriesService } from "./modules/planning/series.service.js";
import { templatesRepository } from "./modules/planning/templates.repository.js";
import { templatesService } from "./modules/planning/templates.service.js";
import { calendarSelectionRepository } from "./modules/planning/calendar-selection.repository.js";
import { calendarSelectionService } from "./modules/planning/calendar-selection.service.js";
import { calendarSearchRepository } from "./modules/planning/calendar-search.repository.js";
import { calendarSearchService } from "./modules/planning/calendar-search.service.js";
import { transactionRunner } from "./infrastructure/database/transactions.js";
import { writesService } from "./infrastructure/writes/writes.service.js";
import { writesRepository } from "./infrastructure/writes/writes.repository.js";
import { databaseHealth } from "./infrastructure/database/health.js";
import { cardioRepository } from "./modules/exercise/cardio.repository.js";
import { cardioService } from "./modules/exercise/cardio.service.js";
import { strengthRepository } from "./modules/exercise/strength.repository.js";
import { strengthService } from "./modules/exercise/strength.service.js";
import { exerciseRepository } from "./modules/exercise/exercise.repository.js";
import { exerciseService } from "./modules/exercise/exercise.service.js";
import { bodyRepository } from "./modules/body/body.repository.js";
import { bodyService } from "./modules/body/body.service.js";
import { hydrationRepository } from "./modules/hydration/hydration.repository.js";
import { hydrationService } from "./modules/hydration/hydration.service.js";
import { nutritionRepository } from "./modules/nutrition/nutrition.repository.js";
import { nutritionService } from "./modules/nutrition/nutrition.service.js";
import { goalsRepository } from "./modules/goals/goals.repository.js";
import { goalsService } from "./modules/goals/goals.service.js";
import { dashboardService } from "./modules/dashboard/dashboard.service.js";
import { categoriesRepository } from "./modules/categories/categories.repository.js";
import { categoriesService } from "./modules/categories/categories.service.js";
import { planningRepository } from "./modules/planning/planning.repository.js";
import { planningService } from "./modules/planning/planning.service.js";
import { createDatabase } from "./infrastructure/database/client.js";
import { createLogger } from "./infrastructure/logging/logger.js";
import { envSchema, type ConfigInput } from "./infrastructure/config/env.js";
import { createAuth } from "./shared/auth/auth.js";
import { identityRepository } from "./modules/identity/identity.repository.js";
import { identityService } from "./modules/identity/identity.service.js";
export function compose(input: ConfigInput) {
  const config = envSchema.parse(input);
  const logger = createLogger(config.LOG_LEVEL);
  const { db, pool } = createDatabase(config.DATABASE_URL, config, logger);
  const runInTransaction = transactionRunner(db);
  const identity = identityService(identityRepository(db));
  const categories = categoriesService(categoriesRepository(db));
  const goals = goalsService(goalsRepository(db), categories);
  const planning = planningService(
    planningRepository(db),
    categories,
    identity,
    goals,
    {
      capture: (u, id, context) => exercises.capturePlanLinks(u, id, context),
      restore: (u, id, links, context) =>
        exercises.restorePlanLinks(u, id, links, context),
    },
  );
  const calendarItems = calendarItemsService(
    calendarItemsRepository(db),
    categories,
    goals,
    planning,
    runInTransaction,
  );
  const series = seriesService(
    seriesRepository(db),
    categories,
    goals,
    planning,
    calendarItems,
    runInTransaction,
  );
  const templates = templatesService(
    templatesRepository(db),
    identity,
    planning,
    calendarItems,
    runInTransaction,
  );
  const calendarSelection = calendarSelectionService(
    calendarSelectionRepository(db),
    planning,
    calendarItems,
    runInTransaction,
  );
  const routines = routinesService(routinesRepository(db));
  const calendarSearch = calendarSearchService(
    calendarSearchRepository(db),
    identity,
  );
  const nutrition = nutritionService(
    nutritionRepository(db),
    identity,
    runInTransaction,
  );
  const hydration = hydrationService(hydrationRepository(db), identity);
  const body = bodyService(bodyRepository(db), identity);
  const exerciseRepo = exerciseRepository(db);
  const strengthRepo = strengthRepository(db);
  const cardioRepo = cardioRepository(db);
  const exercises = exerciseService(exerciseRepo, strengthRepo, cardioRepo);
  const strength = strengthService(
    runInTransaction,
    strengthRepo,
    exerciseRepo,
    planning,
  );
  const cardio = cardioService(runInTransaction, cardioRepo, planning);
  const calendarActivity = calendarActivityService(identity, [
    nutrition.calendarActivity,
    hydration.calendarActivity,
    body.calendarActivity,
    strength.calendarActivity,
    cardio.calendarActivity,
  ]);
  const dashboard = dashboardService(
    identity,
    planning,
    goals,
    nutrition,
    hydration,
    body,
    strength,
    cardio,
  );
  const metrics = requestMetrics();
  const health = databaseHealth(pool, config.NODE_ENV === "production", logger);
  const admin = adminService(
    adminRepository(db),
    runInTransaction,
    async () => {
      const [plans, goalCounts, foodCounts, exerciseCounts] = await Promise.all(
        [
          planning.platformUsage(),
          goals.platformUsage(),
          nutrition.platformUsage(),
          exercises.platformUsage(),
        ],
      );
      return { ...plans, ...goalCounts, ...foodCounts, ...exerciseCounts };
    },
    async () => {
      let database: "ready" | "unavailable" = "ready";
      try {
        await health.ready();
      } catch {
        database = "unavailable";
      }
      return {
        checkedAt: new Date().toISOString(),
        api: "ready",
        database,
        version: apiPackage.version,
        uptimeSeconds: Math.floor(process.uptime()),
        requests: metrics.snapshot(),
      };
    },
  );
  return {
    admin,
    metrics,
    calendarItems,
    series,
    templates,
    calendarSelection,
    routines,
    calendarSearch,
    calendarActivity,
    writes: writesService(
      runInTransaction,
      writesRepository(db),
      async (userId, context) => {
        const access = await identity.getAccess(userId, context);
        if (!access || access.suspendedAt)
          throw new AppError(
            401,
            "UNAUTHORIZED",
            "Please sign in to continue.",
          );
      },
    ),
    databaseHealth: databaseHealth(
      pool,
      config.NODE_ENV === "production",
      logger,
    ),
    lifecycle: { draining: false },
    exercises,
    strength,
    cardio,
    nutrition,
    hydration,
    body,
    goals,
    dashboard,
    categories,
    planning,
    db,
    pool,
    config,
    logger,
    auth: createAuth(db, config, logger),
    identity,
  };
}
export type Dependencies = ReturnType<typeof compose>;
