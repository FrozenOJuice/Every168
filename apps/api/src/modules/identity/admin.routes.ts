import { Router } from "express";
import {
  adminUsersQuery,
  adminStatusInput,
  adminDeleteInput,
  pageQuerySchema,
} from "@168hours/contracts";
import { currentUser } from "../../shared/auth/middleware.js";
import { mutation, emptyInput } from "../../shared/http/mutation.js";
import type { WritesService } from "../../infrastructure/writes/writes.service.js";
import type { AdminService } from "./admin.service.js";
export function adminRoutes(service: AdminService, writes: WritesService) {
  const router = Router();
  // Authorize before pagination, validation or idempotent receipt replay.
  router.use("/admin", async (_req, res, next) => {
    await service.authorize(currentUser(res).id);
    next();
  });
  router.get("/admin/users", async (req, res) =>
    res.json(
      await service.users(
        currentUser(res).id,
        adminUsersQuery.parse(req.query),
      ),
    ),
  );
  router.get("/admin/audit", async (req, res) =>
    res.json(
      await service.audits(
        currentUser(res).id,
        pageQuerySchema.strict().parse(req.query),
      ),
    ),
  );
  router.get("/admin/statistics", async (_req, res) =>
    res.json(await service.statistics(currentUser(res).id)),
  );
  router.get("/admin/health", async (_req, res) =>
    res.json(await service.health(currentUser(res).id)),
  );
  router.put(
    "/admin/users/:id/status",
    mutation(
      writes,
      adminStatusInput,
      ({ userId, id, input, version, context }) =>
        service.manage(
          userId,
          id,
          input.suspended ? "suspended" : "reactivated",
          version,
          context,
        ),
      { versioned: true },
    ),
  );
  router.post(
    "/admin/users/:id/revoke-sessions",
    mutation(
      writes,
      emptyInput,
      ({ userId, id, version, context }) =>
        service.manage(userId, id, "sessions_revoked", version, context),
      { versioned: true },
    ),
  );
  router.delete(
    "/admin/users/:id",
    mutation(
      writes,
      adminDeleteInput,
      ({ userId, id, input, version, context }) =>
        service.deleteAccount(
          userId,
          id,
          input.confirmationEmail,
          version,
          context,
        ),
      { versioned: true },
    ),
  );
  return router;
}
