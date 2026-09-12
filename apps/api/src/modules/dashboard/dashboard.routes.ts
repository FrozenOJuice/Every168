import { Router } from "express";
import { currentUser } from "../../shared/auth/middleware.js";
import type { DashboardService } from "./dashboard.service.js";
export function dashboardRoutes(s: DashboardService) {
  const r = Router();
  r.get("/dashboard", async (_req, res) =>
    res.json(await s.getDashboard(currentUser(res).id)),
  );
  return r;
}
