import { mutation, emptyInput } from "../../shared/http/mutation.js";
import type { WritesService } from "../../infrastructure/writes/writes.service.js";
import { Router } from "express";
import {
  foodInput,
  foodEntryInput,
  foodEntryUpdate,
  idSchema,
  libraryQuery,
  dateQuerySchema,
  foodHistoryQuery,
} from "@168hours/contracts";
import { currentUser } from "../../shared/auth/middleware.js";
import type { NutritionService } from "./nutrition.service.js";
export function nutritionRoutes(s: NutritionService, writes: WritesService) {
  const r = Router();
  r.get("/foods", async (req, res) =>
    res.json(
      await s.listFoods(currentUser(res).id, libraryQuery.parse(req.query)),
    ),
  );
  r.post(
    "/foods",
    mutation(
      writes,
      foodInput,
      ({ userId, input, context }) => s.createFood(userId, input, context),
      { status: 201 },
    ),
  );
  r.get("/foods/:id", async (req, res) =>
    res.json(
      await s.getFood(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  r.put(
    "/foods/:id",
    mutation(
      writes,
      foodInput,
      ({ userId, id, input, version, context }) =>
        s.updateFood(userId, id, input, version, context),
      { versioned: true },
    ),
  );
  r.post(
    "/foods/:id/archive",
    mutation(
      writes,
      emptyInput,
      ({ userId, id, version, context }) =>
        s.archiveFood(userId, id, version, context),
      { versioned: true },
    ),
  );
  r.post(
    "/food-entries",
    mutation(
      writes,
      foodEntryInput,
      ({ userId, input, context }) => s.logFood(userId, input, context),
      { status: 201 },
    ),
  );
  r.post(
    "/foods/:id/restore",
    mutation(
      writes,
      emptyInput,
      ({ userId, id, version, context }) =>
        s.restoreFood(userId, id, version, context),
      { versioned: true },
    ),
  );
  r.get("/food-entries", async (req, res) =>
    res.json(
      await s.history(currentUser(res).id, foodHistoryQuery.parse(req.query)),
    ),
  );
  r.get("/food-entries/:id", async (req, res) =>
    res.json(
      await s.getEntry(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  r.put(
    "/food-entries/:id",
    mutation(
      writes,
      foodEntryUpdate,
      ({ userId, id, input, version, context }) =>
        s.updateEntry(userId, id, input, version, context),
      { versioned: true },
    ),
  );
  r.post(
    "/food-entries/:id/repeat",
    mutation(
      writes,
      foodEntryUpdate,
      ({ userId, id, input, context }) =>
        s.repeatEntry(userId, id, input, context),
      { status: 201 },
    ),
  );
  r.delete(
    "/food-entries/:id",
    mutation(
      writes,
      emptyInput,
      ({ userId, id, version, context }) =>
        s.deleteEntry(userId, id, version, context),
      { versioned: true },
    ),
  );
  r.get("/nutrition/daily", async (req, res) =>
    res.json(
      await s.daily(currentUser(res).id, dateQuerySchema.parse(req.query).date),
    ),
  );
  return r;
}
