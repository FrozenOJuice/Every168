import {
  fitnessProgressQuery,
  exerciseReportQuery,
  progressExerciseQuery,
} from "@168hours/contracts";
import type { StrengthProgressService } from "./strength-progress.service.js";
import { useCatalogExerciseInput } from "@168hours/contracts";
import type { StrengthPlansService } from "./strength-plans.service.js";
import {
  strengthPlanInput,
  strengthPlanQuery,
  strengthScheduleInput,
  strengthBeginInput,
} from "@168hours/contracts";
import { mutation, emptyInput } from "../../shared/http/mutation.js";
import type { WritesService } from "../../infrastructure/writes/writes.service.js";
import { Router } from "express";
import {
  exerciseInput,
  workoutStartInput,
  workoutUpdateInput,
  cardioInput,
  idSchema,
  dateSchema,
  strengthProgressQuery,
  exerciseLibraryQuery,
  exerciseFavouriteInput,
  exerciseHiddenInput,
  exerciseDuplicateInput,
  workoutHistoryQuery,
  cardioHistoryQuery,
} from "@168hours/contracts";
import { currentUser } from "../../shared/auth/middleware.js";
import type { ExerciseService } from "./exercise.service.js";
import type { StrengthService } from "./strength.service.js";
import type { CardioService } from "./cardio.service.js";
export function exerciseRoutes(
  exercises: ExerciseService,
  strength: StrengthService,
  cardio: CardioService,
  plans: StrengthPlansService,
  writes: WritesService,
  progress: StrengthProgressService,
) {
  const r = Router();
  r.get("/strength-plans/day-links", async (req, res) =>
    res.json(
      await plans.dayLinks(
        currentUser(res).id,
        dateSchema.parse(req.query.date),
      ),
    ),
  );
  r.get("/fitness-progress", async (req, res) =>
    res.json(
      await progress.overview(
        currentUser(res).id,
        fitnessProgressQuery.parse(req.query).date,
      ),
    ),
  );
  r.get("/fitness-progress/exercises", async (req, res) =>
    res.json(
      await progress.exercises(
        currentUser(res).id,
        progressExerciseQuery.parse(req.query),
      ),
    ),
  );
  r.get("/fitness-progress/exercises/:id", async (req, res) =>
    res.json(
      await progress.exercise(
        currentUser(res).id,
        idSchema.parse(req.params.id),
        exerciseReportQuery.parse(req.query),
      ),
    ),
  );
  r.get("/fitness-progress/workouts/:id", async (req, res) =>
    res.json(
      await progress.comparison(
        currentUser(res).id,
        idSchema.parse(req.params.id),
      ),
    ),
  );
  r.get("/strength-plans", async (req, res) =>
    res.json(
      await plans.list(currentUser(res).id, strengthPlanQuery.parse(req.query)),
    ),
  );
  r.get("/strength-plan-for-block/:id", async (req, res) =>
    res.json({
      plan: await plans.forBlock(
        currentUser(res).id,
        idSchema.parse(req.params.id),
      ),
    }),
  );
  r.get("/strength-plans/next", async (_req, res) =>
    res.json({ workout: await plans.next(currentUser(res).id) }),
  );
  r.get("/strength-plans/:id", async (req, res) =>
    res.json(
      await plans.get(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  r.post(
    "/strength-plans",
    mutation(
      writes,
      strengthPlanInput,
      ({ userId, input, context }) => plans.create(userId, input, context),
      { status: 201 },
    ),
  );
  r.put(
    "/strength-plans/:id",
    mutation(
      writes,
      strengthPlanInput,
      ({ userId, id, input, version, context }) =>
        plans.update(userId, id, input, version, context),
      { versioned: true },
    ),
  );
  r.delete(
    "/strength-plans/:id",
    mutation(
      writes,
      emptyInput,
      ({ userId, id, version, context }) =>
        plans.remove(userId, id, version, context),
      { versioned: true },
    ),
  );
  r.post(
    "/strength-plans/:id/schedule",
    mutation(
      writes,
      strengthScheduleInput,
      ({ userId, id, input, version, context }) =>
        plans.schedule(userId, id, input, version, context),
      { versioned: true, status: 201 },
    ),
  );
  r.post(
    "/strength-plans/:id/begin",
    mutation(
      writes,
      strengthBeginInput,
      ({ userId, id, input, version, context }) =>
        plans.begin(userId, id, input.startedAt, version, context),
      { versioned: true, status: 201 },
    ),
  );
  r.get("/exercise-catalog", async (_req, res) =>
    res.json(await exercises.catalog(currentUser(res).id)),
  );
  r.post(
    "/exercises/from-catalog",
    mutation(
      writes,
      useCatalogExerciseInput,
      ({ userId, input, context }) =>
        exercises.useCatalog(userId, input.key, context),
      { status: 201 },
    ),
  );
  r.get("/exercises", async (req, res) =>
    res.json(
      await exercises.list(
        currentUser(res).id,
        exerciseLibraryQuery.parse(req.query),
      ),
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
  r.put(
    "/exercises/:id/favourite",
    mutation(
      writes,
      exerciseFavouriteInput,
      ({ userId, id, input, version, context }) =>
        exercises.favourite(userId, id, input.favourite, version, context),
      { versioned: true },
    ),
  );
  r.post(
    "/exercises/duplicate",
    mutation(
      writes,
      exerciseDuplicateInput,
      ({ userId, input, context }) =>
        exercises.duplicate(userId, input, context),
      { status: 201 },
    ),
  );
  r.put(
    "/exercises/:id/hidden",
    mutation(
      writes,
      exerciseHiddenInput,
      ({ userId, id, input, version, context }) =>
        exercises.hidden(userId, id, input.hidden, version, context),
      { versioned: true },
    ),
  );
  r.delete(
    "/exercises/:id",
    mutation(
      writes,
      emptyInput,
      ({ userId, id, version, context }) =>
        exercises.remove(userId, id, version, context),
      { versioned: true },
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
        strengthProgressQuery.parse(req.query),
      ),
    ),
  );
  r.post(
    "/exercises/:id/restore",
    mutation(
      writes,
      emptyInput,
      ({ userId, id, version, context }) =>
        exercises.restore(userId, id, version, context),
      { versioned: true },
    ),
  );
  r.get("/strength-workouts", async (req, res) =>
    res.json(
      await strength.list(
        currentUser(res).id,
        workoutHistoryQuery.parse(req.query),
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
  r.post(
    "/strength-workouts/:id/repeat",
    mutation(
      writes,
      emptyInput,
      ({ userId, id, version, context }) =>
        strength.repeat(userId, id, version, context),
      { versioned: true, status: 201 },
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
      await cardio.list(
        currentUser(res).id,
        cardioHistoryQuery.parse(req.query),
      ),
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
