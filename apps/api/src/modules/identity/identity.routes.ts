import { Router } from "express";
import { preferencesInput } from "@168hours/contracts";
import { currentUser } from "../../shared/auth/middleware.js";
import type { IdentityService } from "./identity.service.js";
export function identityRoutes(service: IdentityService) {
  const router = Router();
  router.get("/me", async (_req, res) => {
    const user = currentUser(res);
    res.json({
      user: { id: user.id, name: user.name, email: user.email },
      preferences: await service.getPreferences(user.id),
    });
  });
  router.put("/preferences", async (req, res) =>
    res.json(
      await service.savePreferences(
        currentUser(res).id,
        preferencesInput.parse(req.body),
      ),
    ),
  );
  return router;
}
