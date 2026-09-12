import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { testApp } from "./helpers.js";
import { createDatabase } from "../src/infrastructure/database/client.js";
import {
  databaseFor,
  transactionRunner,
} from "../src/infrastructure/database/transactions.js";
import type { TransactionContext } from "../src/shared/transactions.js";
import { grantRuntimeAccess } from "../src/infrastructure/database/permissions.js";
const { deps } = testApp();

describe("database failure boundaries", () => {
  it("bounds statements and pool waits and remains usable afterwards", async () => {
    const { pool } = createDatabase(deps.config.DATABASE_URL, {
      ...deps.config,
      DB_POOL_MAX: 1,
      DB_CONNECT_TIMEOUT_MS: 100,
      DB_STATEMENT_TIMEOUT_MS: 100,
      DB_LOCK_TIMEOUT_MS: 50,
      DB_QUERY_TIMEOUT_MS: 300,
    });
    try {
      await expect(pool.query("select pg_sleep(1)")).rejects.toMatchObject({
        code: "57014",
      });
      const client = await pool.connect();
      try {
        await expect(pool.query("select 1")).rejects.toThrow(
          "timeout exceeded",
        );
      } finally {
        client.release();
      }
      expect((await pool.query("select 1 as ok")).rows[0].ok).toBe(1);
    } finally {
      await pool.end();
    }
  });
  it("bounds lock waits and idle transactions", async () => {
    const { pool } = createDatabase(deps.config.DATABASE_URL, {
      ...deps.config,
      DB_LOCK_TIMEOUT_MS: 50,
      DB_IDLE_TRANSACTION_TIMEOUT_MS: 100,
    });
    const a = await deps.pool.connect();
    const b = await pool.connect();
    try {
      await a.query("select pg_advisory_lock(1680001)");
      await expect(
        b.query("select pg_advisory_lock(1680001)"),
      ).rejects.toMatchObject({ code: "55P03" });
      const disconnected = new Promise<unknown>((resolve) =>
        b.once("error", resolve),
      );
      await b.query("begin");
      expect(await disconnected).toMatchObject({ code: "25P03" });
    } finally {
      await a.query("select pg_advisory_unlock_all()");
      a.release();
      b.release(true);
      await pool.end();
    }
  });
  it("keeps transaction tokens opaque, rolls back failures, and rejects expired scopes", async () => {
    const run = transactionRunner(deps.db);
    let expired: TransactionContext | undefined;
    const label = randomUUID();
    await expect(
      run(async (context) => {
        expired = context;
        expect(Object.keys(context)).toEqual([]);
        await databaseFor(deps.db, context).execute(
          sql`insert into verifications (identifier, value, expires_at) values (${label}, 'synthetic', now())`,
        );
        throw new Error("rollback audit");
      }),
    ).rejects.toThrow("rollback audit");
    expect(
      (
        await deps.pool.query(
          "select count(*)::int as count from verifications where identifier=$1",
          [label],
        )
      ).rows[0].count,
    ).toBe(0);
    expect(() => databaseFor(deps.db, expired)).toThrow("expired transaction");
  });
  it("grants runtime CRUD while denying DDL, role creation and migration-table access", async () => {
    const role = "audit_" + randomUUID().replaceAll("-", "");
    const client = await deps.pool.connect();
    try {
      await client.query(
        `CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`,
      );
      const url = new URL(deps.config.DATABASE_URL);
      url.username = role;
      await grantRuntimeAccess(deps.pool, url.toString());
      await client.query(`SET ROLE ${role}`);
      const id = randomUUID();
      await client.query(
        "insert into verifications (id, identifier, value, expires_at) values ($1, 'synthetic-role-test', 'synthetic', now())",
        [id],
      );
      await client.query(
        "update verifications set value='updated' where id=$1",
        [id],
      );
      expect(
        (
          await client.query("select value from verifications where id=$1", [
            id,
          ])
        ).rows[0].value,
      ).toBe("updated");
      await client.query("delete from verifications where id=$1", [id]);
      for (const query of [
        "create table audit_forbidden (id integer)",
        "alter table verifications add column forbidden integer",
        "select * from drizzle.__drizzle_migrations",
        "create role audit_forbidden_role",
      ])
        await expect(client.query(query)).rejects.toMatchObject({
          code: "42501",
        });
    } finally {
      await client.query("RESET ROLE");
      await client.query(`DROP OWNED BY ${role}`);
      await client.query(`DROP ROLE ${role}`);
      client.release();
    }
  });
});
