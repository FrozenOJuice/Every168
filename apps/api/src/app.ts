import { trainingProgramsRoutes } from "./modules/exercise/training-programs.routes.js";
import { adminRoutes } from "./modules/identity/admin.routes.js";
import { calendarRoutes } from "./modules/planning/calendar.routes.js";
import { routinesRoutes } from "./modules/routines/routines.routes.js";
import { apiRateLimit } from "./shared/http/rate-limit.js";
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
  admin,
  metrics,
  writes,
  calendarItems,
  series,
  templates,
  calendarSelection,
  routines,
  calendarSearch,
  calendarActivity,
  databaseHealth,
  lifecycle,
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
  strengthPlans,
  fitnessProgress,
  trainingPrograms,
  cardio,
}: Omit<Dependencies, "db" | "pool">) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.TRUSTED_PROXY_CIDRS);
  app.use(helmet());
  app.use(requestLog(logger, metrics));
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api", (_req, _res, next) =>
    lifecycle.draining
      ? next(
          new AppError(
            503,
            "SHUTTING_DOWN",
            "The server is restarting. Please try again shortly.",
          ),
        )
      : next(),
  );
  app.use("/api", apiRateLimit(config.API_RATE_LIMIT));
  app.get("/api/ready", async (_req, res) => {
    await databaseHealth.ready();
    res.setHeader("Cache-Control", "no-store");
    res.json({ status: "ready" });
  });
  app.use("/api/auth", apiRateLimit(100));
  app.post("/api/auth/sign-in/email", apiRateLimit(10));
  app.post(
    "/api/auth/sign-up/email",
    apiRateLimit(config.NODE_ENV === "test" ? 100 : 10),
  );
  app.all(
    "/api/auth/*splat",
    express.raw({ type: () => true, limit: "256kb", inflate: false }),
    authHandler(auth, config.BETTER_AUTH_URL, config.WEB_ORIGIN, identity),
  );
  app.use(express.json({ limit: "256kb" }));
  app.use(
    "/api/v1",
    requireOrigin(config.WEB_ORIGIN),
    requireSession(auth, identity),
    identityRoutes(identity, writes),
    adminRoutes(admin, writes),
    categoriesRoutes(categories, writes),
    planningRoutes(planning, writes),
    calendarRoutes(
      calendarItems,
      series,
      templates,
      calendarSelection,
      calendarSearch,
      writes,
      calendarActivity,
    ),
    routinesRoutes(routines, writes),
    goalsRoutes(goals, writes),
    dashboardRoutes(dashboard),
    nutritionRoutes(nutrition, writes),
    hydrationRoutes(hydration, writes),
    bodyRoutes(body, writes),
    trainingProgramsRoutes(trainingPrograms, writes),
    exerciseRoutes(
      exercises,
      strength,
      cardio,
      strengthPlans,
      writes,
      fitnessProgress,
    ),
  );
  app.use((_req, _res, next) =>
    next(new AppError(404, "NOT_FOUND", "Route not found.")),
  );
  app.use(errorHandler(logger));
  return app;
}
