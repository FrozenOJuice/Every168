import { Router } from "express";
import { goalInput, goalsQuery, idSchema } from "@168hours/contracts";
import { currentUser } from "../../shared/auth/middleware.js";
import type { GoalsService } from "./goals.service.js";
export function goalsRoutes(s: GoalsService) {
  const r = Router();
  r.get("/goals", async (req, res) =>
    res.json(await s.list(currentUser(res).id, goalsQuery.parse(req.query))),
  );
  r.post("/goals", async (req, res) =>
    res
      .status(201)
      .json(await s.create(currentUser(res).id, goalInput.parse(req.body))),
  );
  r.get("/goals/:id", async (req, res) =>
    res.json(await s.get(currentUser(res).id, idSchema.parse(req.params.id))),
  );
  r.put("/goals/:id", async (req, res) =>
    res.json(
      await s.update(
        currentUser(res).id,
        idSchema.parse(req.params.id),
        goalInput.parse(req.body),
      ),
    ),
  );
  return r;
}
