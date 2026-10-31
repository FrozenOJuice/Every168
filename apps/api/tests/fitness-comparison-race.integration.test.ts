import { transactionRunner } from "../src/infrastructure/database/transactions.js";
import { expect, it } from "vitest";
import request from "supertest";
import { origin, commandHeaders, testApp } from "./helpers.js";
import { strengthProgressRepository } from "../src/modules/exercise/strength-progress.repository.js";
import { strengthProgressService } from "../src/modules/exercise/strength-progress.service.js";
const { app, deps, signUp } = testApp("core");
for (const change of ["correct", "delete"] as const)
  it(`compares one coherent snapshot while the earlier workout is ${change}d`, async () => {
    const owner = await signUp();
    const write = async (path: string, data: object, version?: number) => {
      const result = await request(app)
        [version ? "put" : "post"](`/api/v1/${path}`)
        .set("Cookie", owner.cookie)
        .set("Origin", origin)
        .set(commandHeaders(version))
        .send(data);
      expect(result.status).toBe(version ? 200 : 201);
      return result.body;
    };
    const a = await write("exercises", { name: "Original exercise" });
    const b = await write("exercises", { name: "Different exercise" });
    async function workout(day: string) {
      const w = await write("strength-workouts", {
        title: "Snapshot",
        startedAt: `2026-10-${day}T12:00:00Z`,
      });
      return write(
        `strength-workouts/${w.id}`,
        {
          title: w.title,
          startedAt: w.startedAt,
          endedAt: `2026-10-${day}T13:00:00Z`,
          exercises: [
            { exerciseId: a.id, sets: [{ reps: 8, completed: true }] },
          ],
        },
        w.version,
      );
    }
    const previous = await workout("01"),
      current = await workout("02");
    const repo = strengthProgressRepository(deps.db);
    const original = repo.previousMatching;
    let release!: () => void, entered!: () => void;
    const gate = new Promise<void>((r) => (release = r)),
      matched = new Promise<void>((r) => (entered = r));
    repo.previousMatching = async (...args) => {
      const id = await original(...args);
      entered();
      await gate;
      return id;
    };
    const service = strengthProgressService(
      repo,
      deps.identity,
      deps.exercises,
      deps.strength,
      transactionRunner(deps.db, {
        isolationLevel: "repeatable read",
        accessMode: "read only",
      }),
    );
    const comparing = service.comparison(owner.id, current.id);
    await matched;
    try {
      if (change === "correct")
        await write(
          `strength-workouts/${previous.id}`,
          {
            title: previous.title,
            startedAt: previous.startedAt,
            endedAt: previous.endedAt,
            exercises: [
              { exerciseId: b.id, sets: [{ reps: 99, completed: true }] },
            ],
          },
          previous.version,
        );
      else
        await request(app)
          .delete(`/api/v1/strength-workouts/${previous.id}`)
          .set("Cookie", owner.cookie)
          .set("Origin", origin)
          .set(commandHeaders(previous.version))
          .expect(200);
    } finally {
      release();
    }
    const comparison = await comparing;
    expect(comparison.previous?.exercises[0]?.exerciseId).toBe(a.id);
    expect(comparison.previous?.exercises[0]?.maxReps).toBe(8);
  });
