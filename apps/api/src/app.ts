import { exerciseRoutes } from "./modules/exercise/exercise.routes.js";
import { bodyRoutes } from "./modules/body/body.routes.js";
import { hydrationRoutes } from "./modules/hydration/hydration.routes.js";
import { nutritionRoutes } from "./modules/nutrition/nutrition.routes.js";
import { goalsRoutes } from "./modules/goals/goals.routes.js";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes.js";
import { categoriesRoutes } from "./modules/categories/categories.routes.js";
import { planningRoutes } from "./modules/planning/planning.routes.js";
import express from "express";
import helmet from "helmet";
import { authHandler } from "./shared/auth/handler.js";
import { requestLog } from "./shared/http/request-log.js";
import { errorHandler } from "./shared/errors/error-handler.js";
import type { Dependencies } from "./composition.js";
import { requireSession, requireOrigin } from "./shared/auth/middleware.js";
import { identityRoutes } from "./modules/identity/identity.routes.js";
import { AppError } from "./shared/errors/app-error.js";
export function createApp({
  pool,
  logger,
  auth,
  config,
  identity,
  categories,
  planning,
  goals,
  dashboard,
  nutrition,
  hydration,
  body,
  exercises,
  strength,
  cardio,
}: Dependencies) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(requestLog(logger));
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/ready", async (_req, res) => {
    await pool.query("select 1");
    res.json({ status: "ready" });
  });
  app.all("/api/auth/*splat", authHandler(auth, config.BETTER_AUTH_URL));
  app.use(express.json({ limit: "256kb" }));
  app.use(
    "/api/v1",
    requireOrigin(config.WEB_ORIGIN),
    requireSession(auth),
    identityRoutes(identity),
    categoriesRoutes(categories),
    planningRoutes(planning),
    goalsRoutes(goals),
    dashboardRoutes(dashboard),
    nutritionRoutes(nutrition),
    hydrationRoutes(hydration),
    bodyRoutes(body),
    exerciseRoutes(exercises, strength, cardio),
  );
  app.use((_req, _res, next) =>
    next(new AppError(404, "NOT_FOUND", "Route not found.")),
  );
  app.use(errorHandler(logger));
  return app;
}
