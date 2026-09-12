import { mutation, emptyInput } from "../../shared/http/mutation.js";
import type { WritesService } from "../../infrastructure/writes/writes.service.js";
import { Router } from "express";
import {
  blockInput,
  timeEntryInput,
  idSchema,
  dateSchema,
} from "@168hours/contracts";
import { currentUser } from "../../shared/auth/middleware.js";
import type { PlanningService } from "./planning.service.js";
export function planningRoutes(s: PlanningService, writes: WritesService) {
  const r = Router();
  r.get("/weeks/:date", async (req, res) =>
    res.json(
      await s.getWeek(currentUser(res).id, dateSchema.parse(req.params.date)),
    ),
  );
  r.post(
    "/time-blocks",
    mutation(
      writes,
      blockInput,
      ({ userId, input, context }) => s.createBlock(userId, input, context),
      { status: 201 },
    ),
  );
  r.get("/time-blocks/:id", async (req, res) =>
    res.json(
      await s.getBlock(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  r.put(
    "/time-blocks/:id",
    mutation(
      writes,
      blockInput,
      ({ userId, id, input, version, context }) =>
        s.updateBlock(userId, id, input, version, context),
      { versioned: true },
    ),
  );
  r.delete(
    "/time-blocks/:id",
    mutation(
      writes,
      emptyInput,
      ({ userId, id, version, context }) =>
        s.deleteBlock(userId, id, version, context),
      { versioned: true },
    ),
  );
  r.post(
    "/time-entries",
    mutation(
      writes,
      timeEntryInput,
      ({ userId, input, context }) => s.createEntry(userId, input, context),
      { status: 201 },
    ),
  );
  r.get("/time-entries/:id", async (req, res) =>
    res.json(
      await s.getEntry(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  r.put(
    "/time-entries/:id",
    mutation(
      writes,
      timeEntryInput,
      ({ userId, id, input, version, context }) =>
        s.updateEntry(userId, id, input, version, context),
      { versioned: true },
    ),
  );
  r.delete(
    "/time-entries/:id",
    mutation(
      writes,
      emptyInput,
      ({ userId, id, version, context }) =>
        s.deleteEntry(userId, id, version, context),
      { versioned: true },
    ),
  );
  return r;
}
