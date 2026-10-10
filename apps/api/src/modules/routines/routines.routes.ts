import { Router } from "express";
import {
  idSchema,
  routineInput,
  routineProgressInput,
} from "@168hours/contracts";
import { currentUser } from "../../shared/auth/middleware.js";
import { mutation, emptyInput } from "../../shared/http/mutation.js";
import type { WritesService } from "../../infrastructure/writes/writes.service.js";
import type { RoutinesService } from "./routines.service.js";

export function routinesRoutes(
  service: RoutinesService,
  writes: WritesService,
) {
  const r = Router();
  r.get("/routines", async (_req, res) =>
    res.json(await service.list(currentUser(res).id)),
  );
  r.get("/routines/:id", async (req, res) =>
    res.json(
      await service.get(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  r.post(
    "/routines",
    mutation(
      writes,
      routineInput,
      ({ userId, input, context }) => service.create(userId, input, context),
      { status: 201 },
    ),
  );
  r.put(
    "/routines/:id",
    mutation(
      writes,
      routineInput,
      ({ userId, id, input, version, context }) =>
        service.update(userId, id, input, version, context),
      { versioned: true },
    ),
  );
  r.put(
    "/routines/:id/progress",
    mutation(
      writes,
      routineProgressInput,
      ({ userId, id, input, version, context }) =>
        service.progress(userId, id, input, version, context),
      { versioned: true },
    ),
  );
  r.post(
    "/routines/:id/complete",
    mutation(
      writes,
      emptyInput,
      ({ userId, id, version, context }) =>
        service.complete(userId, id, version, context),
      { versioned: true },
    ),
  );
  r.delete(
    "/routines/:id",
    mutation(
      writes,
      emptyInput,
      ({ userId, id, version, context }) =>
        service.remove(userId, id, version, context),
      { versioned: true },
    ),
  );
  return r;
}
