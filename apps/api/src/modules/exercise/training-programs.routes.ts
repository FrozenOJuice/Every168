import { Router } from "express";
import {
  idSchema,
  pageQuerySchema,
  trainingProgramInput,
  trainingProgramQuery,
  programBeginInput,
  programScheduleInput,
  programSkipInput,
  programPauseInput,
} from "@168hours/contracts";
import { currentUser } from "../../shared/auth/middleware.js";
import { mutation, emptyInput } from "../../shared/http/mutation.js";
import type { WritesService } from "../../infrastructure/writes/writes.service.js";
import type { TrainingProgramsService } from "./training-programs.service.js";
export function trainingProgramsRoutes(
  programs: TrainingProgramsService,
  writes: WritesService,
) {
  const r = Router();
  r.get("/training-program-for-session/:id", async (req, res) =>
    res.json({
      program: await programs.forSession(
        currentUser(res).id,
        idSchema.parse(req.params.id),
      ),
    }),
  );
  r.get("/training-programs", async (req, res) =>
    res.json(
      await programs.list(
        currentUser(res).id,
        trainingProgramQuery.parse(req.query),
      ),
    ),
  );
  r.get("/training-programs/:id", async (req, res) =>
    res.json(
      await programs.get(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  r.get("/training-programs/:id/history", async (req, res) =>
    res.json(
      await programs.history(
        currentUser(res).id,
        idSchema.parse(req.params.id),
        pageQuerySchema.parse(req.query),
      ),
    ),
  );
  r.post(
    "/training-programs",
    mutation(
      writes,
      trainingProgramInput,
      ({ userId, input, context }) => programs.create(userId, input, context),
      { status: 201 },
    ),
  );
  r.put(
    "/training-programs/:id",
    mutation(
      writes,
      trainingProgramInput,
      ({ userId, id, input, version, context }) =>
        programs.update(userId, id, input, version, context),
      { versioned: true },
    ),
  );
  r.delete(
    "/training-programs/:id",
    mutation(
      writes,
      emptyInput,
      ({ userId, id, version, context }) =>
        programs.remove(userId, id, version, context),
      { versioned: true },
    ),
  );
  r.put(
    "/training-programs/:id/paused",
    mutation(
      writes,
      programPauseInput,
      ({ userId, id, input, version, context }) =>
        programs.pause(userId, id, input.paused, version, context),
      { versioned: true },
    ),
  );
  r.post(
    "/training-programs/:id/begin",
    mutation(
      writes,
      programBeginInput,
      ({ userId, id, input, version, context }) =>
        programs.begin(userId, id, input, version, context),
      { versioned: true, status: 201 },
    ),
  );
  r.post(
    "/training-programs/:id/schedule",
    mutation(
      writes,
      programScheduleInput,
      ({ userId, id, input, version, context }) =>
        programs.schedule(userId, id, input, version, context),
      { versioned: true },
    ),
  );
  r.post(
    "/training-programs/:id/skip",
    mutation(
      writes,
      programSkipInput,
      ({ userId, id, input, version, context }) =>
        programs.skip(userId, id, input, version, context),
      { versioned: true },
    ),
  );
  return r;
}
