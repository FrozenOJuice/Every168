import { afterEach, describe, expect, it } from "vitest";
import { createServer as createTcpServer } from "node:net";
import { request as httpRequest } from "node:http";
import { once } from "node:events";
import pino from "pino";
import { testApp } from "./helpers.js";
import { compose } from "../src/composition.js";
import { startServer } from "../src/infrastructure/lifecycle.js";
const { deps: fixture } = testApp();
const active: Awaited<ReturnType<typeof startServer>>[] = [];
afterEach(async () => {
  for (const node of active.splice(0)) await node.shutdown("test cleanup");
});
function dependencies() {
  const deps = compose({ ...fixture.config, SHUTDOWN_TIMEOUT_MS: 500 });
  deps.config.PORT = 0;
  const logs: string[] = [];
  deps.logger = pino(
    { level: "info" },
    {
      write(line: string) {
        logs.push(line);
      },
    },
  );
  return { deps, logs };
}
async function launch(deps: ReturnType<typeof compose>) {
  const node = await startServer(deps);
  active.push(node);
  const address = node.server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing test address");
  return {
    ...node,
    url: `http://127.0.0.1:${address.port}`,
    port: address.port,
  };
}
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("server lifecycle", () => {
  it("fails startup with a bounded stalled DB handshake and closes the pool", async () => {
    const sockets = new Set<import("node:net").Socket>();
    const tcp = createTcpServer((socket) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
    });
    tcp.listen(0, "127.0.0.1");
    await once(tcp, "listening");
    const address = tcp.address();
    if (!address || typeof address === "string")
      throw new Error("Missing test address");
    const deps = compose({
      ...fixture.config,
      DATABASE_URL: `postgresql://synthetic:secret-audit@127.0.0.1:${address.port}/hours_test`,
      DB_CONNECT_TIMEOUT_MS: 100,
    });
    deps.config.PORT = 0;
    try {
      const began = Date.now();
      await expect(startServer(deps)).rejects.toThrow();
      expect(Date.now() - began).toBeLessThan(2500);
      expect(deps.pool.totalCount).toBe(0);
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => tcp.close(() => resolve()));
    }
  });
  it("handles a port conflict without leaking the second pool", async () => {
    const first = await launch(dependencies().deps);
    const { deps, logs } = dependencies();
    deps.config.PORT = first.port;
    await expect(startServer(deps)).rejects.toMatchObject({
      code: "EADDRINUSE",
    });
    expect(deps.pool.totalCount).toBe(0);
    expect(logs.join("")).toContain("EADDRINUSE");
    expect((await fetch(first.url + "/api/health")).status).toBe(200);
  });
  it("drains an in-flight request, marks stopping and makes shutdown idempotent", async () => {
    const { deps, logs } = dependencies();
    let release!: () => void;
    let entered!: () => void;
    const enteredPromise = new Promise<void>((resolve) => {
      entered = resolve;
    });
    deps.databaseHealth.ready = () =>
      new Promise<void>((resolve) => {
        release = resolve;
        entered();
      });
    const node = await launch(deps);
    const response = fetch(node.url + "/api/ready");
    await enteredPromise;
    const stopping = node.shutdown("SIGTERM");
    expect(node.shutdown("SIGINT")).toBe(stopping);
    expect(deps.lifecycle.draining).toBe(true);
    release();
    expect((await response).status).toBe(200);
    expect(await stopping).toBe(0);
    expect(deps.pool.totalCount).toBe(0);
    expect(
      logs.filter((line) => line.includes("API shutdown started")),
    ).toHaveLength(1);
  });
  it("bounds a stuck request and records its aborted completion once", async () => {
    const { deps, logs } = dependencies();
    let release!: () => void;
    let entered!: () => void;
    const enteredPromise = new Promise<void>((resolve) => {
      entered = resolve;
    });
    deps.databaseHealth.ready = () =>
      new Promise<void>((resolve) => {
        release = resolve;
        entered();
      });
    const node = await launch(deps);
    const response = fetch(node.url + "/api/ready").catch(() => null);
    await enteredPromise;
    expect(await node.shutdown("SIGTERM")).toBe(1);
    expect(await response).toBeNull();
    release();
    await delay(20);
    expect(logs.join("")).toContain("shutdown deadline exceeded");
    expect(
      logs.filter((line) => line.includes("Request aborted")),
    ).toHaveLength(1);
  });
  it("logs client disconnects without their query strings", async () => {
    const { deps, logs } = dependencies();
    let entered!: () => void;
    const enteredPromise = new Promise<void>((resolve) => {
      entered = resolve;
    });
    deps.databaseHealth.ready = async () => {
      entered();
      await delay(80);
    };
    const node = await launch(deps);
    const req = httpRequest(node.url + "/api/ready?token=private-audit-token");
    req.on("error", () => {});
    req.end();
    await enteredPromise;
    req.destroy();
    await delay(100);
    const output = logs.join("");
    expect(output).toContain("Request aborted");
    expect(output).not.toContain("private-audit-token");
  });
  it("reports pool close failures as an unsuccessful shutdown", async () => {
    const { deps, logs } = dependencies();
    const end = deps.pool.end.bind(deps.pool);
    const node = await launch(deps);
    deps.pool.end = async () => {
      await end();
      throw new Error("synthetic pool-close failure");
    };
    expect(await node.shutdown("SIGTERM")).toBe(1);
    expect(logs.join("")).toContain("API shutdown failed");
  });
});
