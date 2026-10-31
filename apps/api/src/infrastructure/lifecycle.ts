import { createServer } from "node:http";
import { createApp } from "../app.js";
import type { Dependencies } from "../composition.js";
import { errorDiagnostics } from "./logging/diagnostics.js";

export async function startServer(
  deps: Dependencies,
  handler = createApp(deps),
) {
  const { config, logger, pool, databaseHealth, lifecycle } = deps;
  const server = createServer(
    {
      requestTimeout: 15000,
      headersTimeout: 10000,
      keepAliveTimeout: 5000,
      connectionsCheckingInterval: 1000,
    },
    handler,
  );
  // Also bounds stalled responses/idle sockets; database work has its own limits.
  server.setTimeout(30000, (socket) => socket.destroy());
  server.on("request", (_req, res) => {
    res.once("finish", () => {
      // A connection can become idle after close() initially scans sockets.
      if (lifecycle.draining) setImmediate(() => server.closeIdleConnections());
    });
  });
  try {
    await databaseHealth.startup();
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(config.PORT, "127.0.0.1", () => {
        server.removeListener("error", reject);
        resolve();
      });
    });
    logger.info({ port: config.PORT }, "API ready and listening");
  } catch (error) {
    logger.fatal({ diagnostic: errorDiagnostics(error) }, "API startup failed");
    await pool.end();
    throw error;
  }

  let stopping: Promise<number> | undefined;
  function shutdown(reason: string): Promise<number> {
    if (stopping) return stopping;
    lifecycle.draining = true;
    logger.info({ reason }, "API shutdown started");
    stopping = (async () => {
      let timer: NodeJS.Timeout | undefined;
      const drained = (async () => {
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
        await pool.end();
        return 0;
      })().catch((error: unknown) => {
        logger.error(
          { diagnostic: errorDiagnostics(error) },
          "API shutdown failed",
        );
        return 1;
      });
      const deadline = new Promise<number>((resolve) => {
        timer = setTimeout(() => {
          logger.error(
            { timeoutMs: config.SHUTDOWN_TIMEOUT_MS },
            "API shutdown deadline exceeded",
          );
          server.closeAllConnections();
          resolve(1);
        }, config.SHUTDOWN_TIMEOUT_MS);
      });
      const code = await Promise.race([drained, deadline]);
      clearTimeout(timer);
      logger.info({ exitCode: code }, "API shutdown finished");
      return code;
    })();
    return stopping;
  }
  return { server, shutdown };
}
