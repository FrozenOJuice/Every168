import { mutation } from "../../shared/http/mutation.js";
import type { WritesService } from "../../infrastructure/writes/writes.service.js";
import { Router } from "express";
import { goalInput, goalsQuery, idSchema } from "@168hours/contracts";
import { currentUser } from "../../shared/auth/middleware.js";
import type { GoalsService } from "./goals.service.js";
export function goalsRoutes(s: GoalsService, writes: WritesService) {
  const r = Router();
  r.get("/goals", async (req, res) =>
    res.json(await s.list(currentUser(res).id, goalsQuery.parse(req.query))),
  );
  r.post(
    "/goals",
    mutation(
      writes,
      goalInput,
      ({ userId, input, context }) => s.create(userId, input, context),
      { status: 201 },
    ),
  );
  r.get("/goals/:id", async (req, res) =>
    res.json(await s.get(currentUser(res).id, idSchema.parse(req.params.id))),
  );
  r.put(
    "/goals/:id",
    mutation(
      writes,
      goalInput,
      ({ userId, id, input, version, context }) =>
        s.update(userId, id, input, version, context),
      { versioned: true },
    ),
  );
  return r;
}
