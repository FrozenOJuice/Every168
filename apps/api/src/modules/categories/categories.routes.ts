import { Router } from "express";
import { categoryInput, idSchema } from "@168hours/contracts";
import { currentUser } from "../../shared/auth/middleware.js";
import type { CategoriesService } from "./categories.service.js";
export function categoriesRoutes(service: CategoriesService) {
  const r = Router();
  r.get("/categories", async (_req, res) =>
    res.json(await service.list(currentUser(res).id)),
  );
  r.post("/categories", async (req, res) =>
    res
      .status(201)
      .json(
        await service.create(
          currentUser(res).id,
          categoryInput.parse(req.body),
        ),
      ),
  );
  r.get("/categories/:id", async (req, res) =>
    res.json(
      await service.get(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  r.put("/categories/:id", async (req, res) =>
    res.json(
      await service.update(
        currentUser(res).id,
        idSchema.parse(req.params.id),
        categoryInput.parse(req.body),
      ),
    ),
  );
  r.post("/categories/:id/archive", async (req, res) =>
    res.json(
      await service.archive(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  return r;
}
