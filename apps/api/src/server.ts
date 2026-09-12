import { compose } from "./composition.js";
import { readConfig, ConfigurationError } from "./infrastructure/config/env.js";
import { startServer } from "./infrastructure/lifecycle.js";
import { createLogger } from "./infrastructure/logging/logger.js";
import { errorDiagnostics } from "./infrastructure/logging/diagnostics.js";

const bootstrapLogger = createLogger("info");
try {
  const deps = compose(readConfig());
  const boot = startServer(deps);
  let exiting = false;
  let fatalExit = false;
  const stop = async (reason: string, fatal = false) => {
    fatalExit ||= fatal;
    if (exiting) return;
    exiting = true;
    let code = 1;
    try {
      code = await (await boot).shutdown(reason);
    } catch {
      /* Startup already logged the failure and closed its pool. */
    }
    deps.logger.flush();
    process.exit(fatalExit ? 1 : code);
  };
  for (const signal of ["SIGTERM", "SIGINT"] as const)
    process.on(signal, () => {
      void stop(signal);
    });
  // Fatal failures terminate after draining; never continue in an unknown state.
  process.on("uncaughtException", (error) => {
    deps.logger.fatal(
      { diagnostic: errorDiagnostics(error) },
      "Uncaught exception",
    );
    void stop("uncaughtException", true);
  });
  process.on("unhandledRejection", (error) => {
    deps.logger.fatal(
      { diagnostic: errorDiagnostics(error) },
      "Unhandled rejection",
    );
    void stop("unhandledRejection", true);
  });
  const running = await boot;
  running.server.on("error", (error) => {
    deps.logger.fatal(
      { diagnostic: errorDiagnostics(error) },
      "HTTP server failed",
    );
    void stop("serverError", true);
  });
} catch (error) {
  bootstrapLogger.fatal(
    {
      diagnostic: errorDiagnostics(error),
      configurationFields:
        error instanceof ConfigurationError ? error.fields : undefined,
    },
    "Unable to start API; check configuration and database setup",
  );
  bootstrapLogger.flush();
  process.exitCode = 1;
}
