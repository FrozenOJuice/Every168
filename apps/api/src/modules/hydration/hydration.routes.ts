import { mutation, emptyInput } from "../../shared/http/mutation.js";
import type { WritesService } from "../../infrastructure/writes/writes.service.js";
import { Router } from "express";
import {
  waterInput,
  idSchema,
  pageQuerySchema,
  dateQuerySchema,
} from "@168hours/contracts";
import { currentUser } from "../../shared/auth/middleware.js";
import type { HydrationService } from "./hydration.service.js";
export function hydrationRoutes(s: HydrationService, writes: WritesService) {
  const r = Router();
  r.get("/water-entries", async (req, res) =>
    res.json(
      await s.list(currentUser(res).id, pageQuerySchema.parse(req.query)),
    ),
  );
  r.post(
    "/water-entries",
    mutation(
      writes,
      waterInput,
      ({ userId, input, context }) => s.create(userId, input, context),
      { status: 201 },
    ),
  );
  r.get("/water-entries/:id", async (req, res) =>
    res.json(await s.get(currentUser(res).id, idSchema.parse(req.params.id))),
  );
  r.put(
    "/water-entries/:id",
    mutation(
      writes,
      waterInput,
      ({ userId, id, input, version, context }) =>
        s.update(userId, id, input, version, context),
      { versioned: true },
    ),
  );
  r.delete(
    "/water-entries/:id",
    mutation(
      writes,
      emptyInput,
      ({ userId, id, version, context }) =>
        s.remove(userId, id, version, context),
      { versioned: true },
    ),
  );
  r.get("/hydration/daily", async (req, res) =>
    res.json(
      await s.daily(currentUser(res).id, dateQuerySchema.parse(req.query).date),
    ),
  );
  return r;
}
