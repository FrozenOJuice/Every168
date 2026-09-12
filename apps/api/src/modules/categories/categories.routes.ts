import { mutation, emptyInput } from "../../shared/http/mutation.js";
import type { WritesService } from "../../infrastructure/writes/writes.service.js";
import { Router } from "express";
import { categoryInput, idSchema } from "@168hours/contracts";
import { currentUser } from "../../shared/auth/middleware.js";
import type { CategoriesService } from "./categories.service.js";
export function categoriesRoutes(
  service: CategoriesService,
  writes: WritesService,
) {
  const r = Router();
  r.get("/categories", async (_req, res) =>
    res.json(await service.list(currentUser(res).id)),
  );
  r.post(
    "/categories",
    mutation(
      writes,
      categoryInput,
      ({ userId, input, context }) => service.create(userId, input, context),
      { status: 201 },
    ),
  );
  r.get("/categories/:id", async (req, res) =>
    res.json(
      await service.get(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  r.put(
    "/categories/:id",
    mutation(
      writes,
      categoryInput,
      ({ userId, id, input, version, context }) =>
        service.update(userId, id, input, version, context),
      { versioned: true },
    ),
  );
  r.post(
    "/categories/:id/archive",
    mutation(
      writes,
      emptyInput,
      ({ userId, id, version, context }) =>
        service.archive(userId, id, version, context),
      { versioned: true },
    ),
  );
  return r;
}
