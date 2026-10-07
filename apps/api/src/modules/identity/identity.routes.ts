import { mutation } from "../../shared/http/mutation.js";
import type { WritesService } from "../../infrastructure/writes/writes.service.js";
import { Router } from "express";
import { preferencesInput } from "@168hours/contracts";
import { currentUser } from "../../shared/auth/middleware.js";
import type { IdentityService } from "./identity.service.js";
export function identityRoutes(
  service: IdentityService,
  writes: WritesService,
) {
  const router = Router();
  router.get("/me", async (_req, res) => {
    const user = currentUser(res);
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        accountType: user.accountType,
      },
      preferences: await service.getPreferences(user.id),
    });
  });
  router.put(
    "/preferences",
    mutation(
      writes,
      preferencesInput,
      ({ userId, input, version, context }) =>
        service.savePreferences(userId, input, version, context),
      { versioned: true },
    ),
  );
  return router;
}
