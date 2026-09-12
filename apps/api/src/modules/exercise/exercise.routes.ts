import { mutation, emptyInput } from "../../shared/http/mutation.js";
import type { WritesService } from "../../infrastructure/writes/writes.service.js";
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
  writes: WritesService,
) {
  const r = Router();
  r.get("/exercises", async (req, res) =>
    res.json(
      await exercises.list(currentUser(res).id, libraryQuery.parse(req.query)),
    ),
  );
  r.post(
    "/exercises",
    mutation(
      writes,
      exerciseInput,
      ({ userId, input, context }) => exercises.create(userId, input, context),
      { status: 201 },
    ),
  );
  r.get("/exercises/:id", async (req, res) =>
    res.json(
      await exercises.get(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  r.put(
    "/exercises/:id",
    mutation(
      writes,
      exerciseInput,
      ({ userId, id, input, version, context }) =>
        exercises.update(userId, id, input, version, context),
      { versioned: true },
    ),
  );
  r.post(
    "/exercises/:id/archive",
    mutation(
      writes,
      emptyInput,
      ({ userId, id, version, context }) =>
        exercises.archive(userId, id, version, context),
      { versioned: true },
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
  r.post(
    "/strength-workouts",
    mutation(
      writes,
      workoutStartInput,
      ({ userId, input, context }) => strength.start(userId, input, context),
      { status: 201 },
    ),
  );
  r.get("/strength-workouts/:id", async (req, res) =>
    res.json(
      await strength.get(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  r.put(
    "/strength-workouts/:id",
    mutation(
      writes,
      workoutUpdateInput,
      ({ userId, id, input, version, context }) =>
        strength.save(userId, id, input, version, context),
      { versioned: true },
    ),
  );
  r.delete(
    "/strength-workouts/:id",
    mutation(
      writes,
      emptyInput,
      ({ userId, id, version, context }) =>
        strength.remove(userId, id, version, context),
      { versioned: true },
    ),
  );
  r.get("/cardio-activities", async (req, res) =>
    res.json(
      await cardio.list(currentUser(res).id, pageQuerySchema.parse(req.query)),
    ),
  );
  r.post(
    "/cardio-activities",
    mutation(
      writes,
      cardioInput,
      ({ userId, input, context }) => cardio.create(userId, input, context),
      { status: 201 },
    ),
  );
  r.get("/cardio-activities/:id", async (req, res) =>
    res.json(
      await cardio.get(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  r.put(
    "/cardio-activities/:id",
    mutation(
      writes,
      cardioInput,
      ({ userId, id, input, version, context }) =>
        cardio.update(userId, id, input, version, context),
      { versioned: true },
    ),
  );
  r.delete(
    "/cardio-activities/:id",
    mutation(
      writes,
      emptyInput,
      ({ userId, id, version, context }) =>
        cardio.remove(userId, id, version, context),
      { versioned: true },
    ),
  );
  return r;
}
