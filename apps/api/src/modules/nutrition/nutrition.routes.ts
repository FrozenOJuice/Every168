import { Router } from "express";
import {
  foodInput,
  foodEntryInput,
  foodEntryUpdate,
  idSchema,
  libraryQuery,
  dateQuerySchema,
} from "@168hours/contracts";
import { currentUser } from "../../shared/auth/middleware.js";
import type { NutritionService } from "./nutrition.service.js";
export function nutritionRoutes(s: NutritionService) {
  const r = Router();
  r.get("/foods", async (req, res) =>
    res.json(
      await s.listFoods(currentUser(res).id, libraryQuery.parse(req.query)),
    ),
  );
  r.post("/foods", async (req, res) =>
    res
      .status(201)
      .json(await s.createFood(currentUser(res).id, foodInput.parse(req.body))),
  );
  r.get("/foods/:id", async (req, res) =>
    res.json(
      await s.getFood(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  r.put("/foods/:id", async (req, res) =>
    res.json(
      await s.updateFood(
        currentUser(res).id,
        idSchema.parse(req.params.id),
        foodInput.parse(req.body),
      ),
    ),
  );
  r.post("/foods/:id/archive", async (req, res) =>
    res.json(
      await s.archiveFood(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  r.post("/food-entries", async (req, res) =>
    res
      .status(201)
      .json(
        await s.logFood(currentUser(res).id, foodEntryInput.parse(req.body)),
      ),
  );
  r.get("/food-entries/:id", async (req, res) =>
    res.json(
      await s.getEntry(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  r.put("/food-entries/:id", async (req, res) =>
    res.json(
      await s.updateEntry(
        currentUser(res).id,
        idSchema.parse(req.params.id),
        foodEntryUpdate.parse(req.body),
      ),
    ),
  );
  r.post("/food-entries/:id/repeat", async (req, res) =>
    res
      .status(201)
      .json(
        await s.repeatEntry(
          currentUser(res).id,
          idSchema.parse(req.params.id),
          foodEntryUpdate.parse(req.body),
        ),
      ),
  );
  r.delete("/food-entries/:id", async (req, res) =>
    res.json(
      await s.deleteEntry(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  r.get("/nutrition/daily", async (req, res) =>
    res.json(
      await s.daily(currentUser(res).id, dateQuerySchema.parse(req.query).date),
    ),
  );
  return r;
}
