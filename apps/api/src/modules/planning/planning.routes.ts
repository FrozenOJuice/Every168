import { Router } from "express";
import {
  blockInput,
  timeEntryInput,
  idSchema,
  dateSchema,
} from "@168hours/contracts";
import { currentUser } from "../../shared/auth/middleware.js";
import type { PlanningService } from "./planning.service.js";
export function planningRoutes(s: PlanningService) {
  const r = Router();
  r.get("/weeks/:date", async (req, res) =>
    res.json(
      await s.getWeek(currentUser(res).id, dateSchema.parse(req.params.date)),
    ),
  );
  r.post("/time-blocks", async (req, res) =>
    res
      .status(201)
      .json(
        await s.createBlock(currentUser(res).id, blockInput.parse(req.body)),
      ),
  );
  r.get("/time-blocks/:id", async (req, res) =>
    res.json(
      await s.getBlock(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  r.put("/time-blocks/:id", async (req, res) =>
    res.json(
      await s.updateBlock(
        currentUser(res).id,
        idSchema.parse(req.params.id),
        blockInput.parse(req.body),
      ),
    ),
  );
  r.delete("/time-blocks/:id", async (req, res) =>
    res.json(
      await s.deleteBlock(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  r.post("/time-entries", async (req, res) =>
    res
      .status(201)
      .json(
        await s.createEntry(
          currentUser(res).id,
          timeEntryInput.parse(req.body),
        ),
      ),
  );
  r.get("/time-entries/:id", async (req, res) =>
    res.json(
      await s.getEntry(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  r.put("/time-entries/:id", async (req, res) =>
    res.json(
      await s.updateEntry(
        currentUser(res).id,
        idSchema.parse(req.params.id),
        timeEntryInput.parse(req.body),
      ),
    ),
  );
  r.delete("/time-entries/:id", async (req, res) =>
    res.json(
      await s.deleteEntry(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  return r;
}
