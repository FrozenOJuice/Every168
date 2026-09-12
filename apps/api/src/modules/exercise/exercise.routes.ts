import { Router } from "express";
import {
  exerciseInput,
  workoutStartInput,
  workoutUpdateInput,
  cardioInput,
  idSchema,
  pageQuerySchema,
  libraryQuery,
} from "@168hours/contracts";
import { currentUser } from "../../shared/auth/middleware.js";
import type { ExerciseService } from "./exercise.service.js";
import type { StrengthService } from "./strength.service.js";
import type { CardioService } from "./cardio.service.js";
export function exerciseRoutes(
  exercises: ExerciseService,
  strength: StrengthService,
  cardio: CardioService,
) {
  const r = Router();
  r.get("/exercises", async (req, res) =>
    res.json(
      await exercises.list(currentUser(res).id, libraryQuery.parse(req.query)),
    ),
  );
  r.post("/exercises", async (req, res) =>
    res
      .status(201)
      .json(
        await exercises.create(
          currentUser(res).id,
          exerciseInput.parse(req.body),
        ),
      ),
  );
  r.get("/exercises/:id", async (req, res) =>
    res.json(
      await exercises.get(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  r.put("/exercises/:id", async (req, res) =>
    res.json(
      await exercises.update(
        currentUser(res).id,
        idSchema.parse(req.params.id),
        exerciseInput.parse(req.body),
      ),
    ),
  );
  r.post("/exercises/:id/archive", async (req, res) =>
    res.json(
      await exercises.archive(
        currentUser(res).id,
        idSchema.parse(req.params.id),
      ),
    ),
  );
  r.get("/strength-progress/:id", async (req, res) =>
    res.json(
      await exercises.progress(
        currentUser(res).id,
        idSchema.parse(req.params.id),
        pageQuerySchema.parse(req.query),
      ),
    ),
  );
  r.get("/strength-workouts", async (req, res) =>
    res.json(
      await strength.list(
        currentUser(res).id,
        pageQuerySchema.parse(req.query),
      ),
    ),
  );
  r.post("/strength-workouts", async (req, res) =>
    res
      .status(201)
      .json(
        await strength.start(
          currentUser(res).id,
          workoutStartInput.parse(req.body),
        ),
      ),
  );
  r.get("/strength-workouts/:id", async (req, res) =>
    res.json(
      await strength.get(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  r.put("/strength-workouts/:id", async (req, res) =>
    res.json(
      await strength.save(
        currentUser(res).id,
        idSchema.parse(req.params.id),
        workoutUpdateInput.parse(req.body),
      ),
    ),
  );
  r.delete("/strength-workouts/:id", async (req, res) =>
    res.json(
      await strength.remove(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  r.get("/cardio-activities", async (req, res) =>
    res.json(
      await cardio.list(currentUser(res).id, pageQuerySchema.parse(req.query)),
    ),
  );
  r.post("/cardio-activities", async (req, res) =>
    res
      .status(201)
      .json(
        await cardio.create(currentUser(res).id, cardioInput.parse(req.body)),
      ),
  );
  r.get("/cardio-activities/:id", async (req, res) =>
    res.json(
      await cardio.get(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  r.put("/cardio-activities/:id", async (req, res) =>
    res.json(
      await cardio.update(
        currentUser(res).id,
        idSchema.parse(req.params.id),
        cardioInput.parse(req.body),
      ),
    ),
  );
  r.delete("/cardio-activities/:id", async (req, res) =>
    res.json(
      await cardio.remove(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  return r;
}
