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
import type { Config } from "./infrastructure/config/env.js";
import { createAuth } from "./shared/auth/auth.js";
import { identityRepository } from "./modules/identity/identity.repository.js";
import { identityService } from "./modules/identity/identity.service.js";
export function compose(config: Config) {
  const { db, pool } = createDatabase(config.DATABASE_URL);
  const logger = createLogger(config.LOG_LEVEL);
  pool.on("error", (error) =>
    logger.error({ errorType: error.name }, "Database pool error"),
  );
  const identity = identityService(identityRepository(db));
  const categories = categoriesService(categoriesRepository(db));
  const goals = goalsService(goalsRepository(db), categories);
  const planning = planningService(
    planningRepository(db),
    categories,
    identity,
    goals,
  );
  const nutrition = nutritionService(nutritionRepository(db), identity);
  const hydration = hydrationService(hydrationRepository(db), identity);
  const body = bodyService(bodyRepository(db));
  const exerciseRepo = exerciseRepository(db);
  const strengthRepo = strengthRepository(db);
  const exercises = exerciseService(exerciseRepo, strengthRepo);
  const strength = strengthService(db, strengthRepo, exerciseRepo, planning);
  const cardio = cardioService(db, cardioRepository(db), planning);
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
  return {
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
    auth: createAuth(db, config),
    identity,
  };
}
export type Dependencies = ReturnType<typeof compose>;
