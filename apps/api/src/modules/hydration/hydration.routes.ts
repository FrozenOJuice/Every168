import { Router } from "express";
import {
  waterInput,
  idSchema,
  pageQuerySchema,
  dateQuerySchema,
} from "@168hours/contracts";
import { currentUser } from "../../shared/auth/middleware.js";
import type { HydrationService } from "./hydration.service.js";
export function hydrationRoutes(s: HydrationService) {
  const r = Router();
  r.get("/water-entries", async (req, res) =>
    res.json(
      await s.list(currentUser(res).id, pageQuerySchema.parse(req.query)),
    ),
  );
  r.post("/water-entries", async (req, res) =>
    res
      .status(201)
      .json(await s.create(currentUser(res).id, waterInput.parse(req.body))),
  );
  r.get("/water-entries/:id", async (req, res) =>
    res.json(await s.get(currentUser(res).id, idSchema.parse(req.params.id))),
  );
  r.put("/water-entries/:id", async (req, res) =>
    res.json(
      await s.update(
        currentUser(res).id,
        idSchema.parse(req.params.id),
        waterInput.parse(req.body),
      ),
    ),
  );
  r.delete("/water-entries/:id", async (req, res) =>
    res.json(
      await s.remove(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  r.get("/hydration/daily", async (req, res) =>
    res.json(
      await s.daily(currentUser(res).id, dateQuerySchema.parse(req.query).date),
    ),
  );
  return r;
}
