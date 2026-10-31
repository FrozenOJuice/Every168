import type { Config } from "../../infrastructure/config/env.js";

// Development can sign in without delivery; test/production keep the real gate.
export const requiresEmailVerification = (config: Pick<Config, "NODE_ENV">) =>
  config.NODE_ENV !== "development";
