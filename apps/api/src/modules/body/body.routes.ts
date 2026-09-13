import { mutation, emptyInput } from "../../shared/http/mutation.js";
import type { WritesService } from "../../infrastructure/writes/writes.service.js";
import { Router } from "express";
import {
  weightInput,
  idSchema,
  measurementHistoryQuery,
  dateQuerySchema,
} from "@168hours/contracts";
import { currentUser } from "../../shared/auth/middleware.js";
import type { BodyService } from "./body.service.js";
export function bodyRoutes(s: BodyService, writes: WritesService) {
  const r = Router();
  r.get("/weight-entries", async (req, res) =>
    res.json(
      await s.list(
        currentUser(res).id,
        measurementHistoryQuery.parse(req.query),
      ),
    ),
  );
  r.get("/body/weight-review", async (req, res) =>
    res.json(
      await s.review(
        currentUser(res).id,
        dateQuerySchema.parse(req.query).date,
      ),
    ),
  );
  r.post(
    "/weight-entries",
    mutation(
      writes,
      weightInput,
      ({ userId, input, context }) => s.create(userId, input, context),
      { status: 201 },
    ),
  );
  r.get("/weight-entries/:id", async (req, res) =>
    res.json(await s.get(currentUser(res).id, idSchema.parse(req.params.id))),
  );
  r.put(
    "/weight-entries/:id",
    mutation(
      writes,
      weightInput,
      ({ userId, id, input, version, context }) =>
        s.update(userId, id, input, version, context),
      { versioned: true },
    ),
  );
  r.delete(
    "/weight-entries/:id",
    mutation(
      writes,
      emptyInput,
      ({ userId, id, version, context }) =>
        s.remove(userId, id, version, context),
      { versioned: true },
    ),
  );
  return r;
}
