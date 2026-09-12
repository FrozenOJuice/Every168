import { createApp } from "./app.js";
import { compose } from "./composition.js";
import { readConfig } from "./infrastructure/config/env.js";
const config = readConfig();
const deps = compose(config);
const app = createApp(deps);
const server = app.listen(config.PORT, "127.0.0.1", () =>
  deps.logger.info({ port: config.PORT }, "API listening"),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.once(signal, () => {
    server.close(() => {
      void deps.pool.end().then(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
