import { Router } from "express";
import { weightInput, idSchema, pageQuerySchema } from "@168hours/contracts";
import { currentUser } from "../../shared/auth/middleware.js";
import type { BodyService } from "./body.service.js";
export function bodyRoutes(s: BodyService) {
  const r = Router();
  r.get("/weight-entries", async (req, res) =>
    res.json(
      await s.list(currentUser(res).id, pageQuerySchema.parse(req.query)),
    ),
  );
  r.post("/weight-entries", async (req, res) =>
    res
      .status(201)
      .json(await s.create(currentUser(res).id, weightInput.parse(req.body))),
  );
  r.get("/weight-entries/:id", async (req, res) =>
    res.json(await s.get(currentUser(res).id, idSchema.parse(req.params.id))),
  );
  r.put("/weight-entries/:id", async (req, res) =>
    res.json(
      await s.update(
        currentUser(res).id,
        idSchema.parse(req.params.id),
        weightInput.parse(req.body),
      ),
    ),
  );
  r.delete("/weight-entries/:id", async (req, res) =>
    res.json(
      await s.remove(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  return r;
}
