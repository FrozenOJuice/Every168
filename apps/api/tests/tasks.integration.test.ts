import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, it, expect } from "vitest";
import { testApp, origin, commandHeaders } from "./helpers.js";
const { app, signUp } = testApp();
function client(cookie: string) {
  return {
    get: (path: string) =>
      request(app)
        .get("/api/v1/" + path)
        .set("Cookie", cookie),
    write: (
      method: "post" | "put" | "delete",
      path: string,
      data: object = {},
      version = 1,
      key?: string,
    ) =>
      request(app)
        [method]("/api/v1/" + path)
        .set("Cookie", cookie)
        .set("Origin", origin)
        .set({
          ...commandHeaders(version),
          ...(key ? { "Idempotency-Key": key } : {}),
        })
        .send(data),
  };
}
describe("Tasks", () => {
  it("captures, organizes, orders, filters, completes and reopens tasks independently of their project", async () => {
    const a = client((await signUp()).cookie);
    const section = { id: randomUUID(), title: "Preparation" };
    const project = (
      await a
        .write("post", "task-projects", {
          name: "Move house",
          sections: [section],
        })
        .expect(201)
    ).body;
    const task = (
      await a.write("post", "tasks", { title: "Book a van" }).expect(201)
    ).body;
    expect(
      (await a.get("tasks?date=2026-10-23")).body.items.map(
        (x: { id: string }) => x.id,
      ),
    ).toContain(task.id);
    const v = {
      title: "Book a van",
      projectId: project.id,
      sectionId: section.id,
      inbox: false,
      dueDate: "2026-10-25",
      plannedDate: "2026-10-23",
      tags: ["Moving", "moving"],
      subtasks: [
        { id: randomUUID(), title: "Compare quotes", completed: false },
      ],
    };
    const edited = (
      await a.write("put", `tasks/${task.id}`, v, task.version).expect(200)
    ).body;
    expect(edited.tags).toEqual(["moving"]);
    await a.write("put", `tasks/${task.id}`, v, task.version).expect(409);
    expect(
      (await a.get("tasks?date=2026-10-23&view=today&tag=moving")).body.items,
    ).toHaveLength(1);
    const done = (
      await a
        .write(
          "put",
          `tasks/${task.id}/state`,
          { status: "done" },
          edited.version,
        )
        .expect(200)
    ).body;
    expect(done.completedAt).not.toBeNull();
    expect((await a.get("task-projects")).body.items[0]).toMatchObject({
      taskCount: 1,
      completedCount: 1,
      status: "active",
    });
    await a
      .write("put", `tasks/${task.id}/state`, { status: "todo" }, done.version)
      .expect(200);
    const p = (await a.get(`task-projects/${project.id}`)).body;
    await a.write("delete", `task-projects/${p.id}`, {}, p.version).expect(200);
    expect((await a.get(`tasks/${task.id}`)).body.task).toMatchObject({
      projectId: null,
      sectionId: null,
      status: "todo",
    });
  });
  it("keeps schedule, completion and actual time separate and supports Calendar move/delete/undo", async () => {
    const a = client((await signUp()).cookie);
    const t = (
      await a
        .write("post", "tasks", { title: "Write draft", inbox: false })
        .expect(201)
    ).body;
    const timing = {
      startsAt: "2026-10-23T18:00:00Z",
      endsAt: "2026-10-23T19:00:00Z",
    };
    const schedule = (
      await a
        .write("post", `tasks/${t.id}/schedules`, timing, t.version)
        .expect(201)
    ).body;
    const second = (await a.get(`tasks/${t.id}`)).body.task;
    await a
      .write(
        "post",
        `tasks/${t.id}/schedules`,
        { startsAt: "2026-10-24T18:00:00Z", endsAt: "2026-10-24T19:00:00Z" },
        second.version,
      )
      .expect(201);
    expect((await a.get(`tasks/${t.id}`)).body.task.status).toBe("todo");
    const logKey = randomUUID(),
      ver = (await a.get(`tasks/${t.id}`)).body.task.version;
    const log = (
      await a
        .write("post", `tasks/${t.id}/times`, timing, ver, logKey)
        .expect(201)
    ).body;
    expect(
      (
        await a
          .write("post", `tasks/${t.id}/times`, timing, ver, logKey)
          .expect(201)
      ).body.id,
    ).toBe(log.id);
    let week = (await a.get("weeks/2026-10-23")).body;
    expect(
      week.entries.filter((e: { sourceId: string }) => e.sourceId === log.id),
    ).toHaveLength(1);
    expect((await a.get(`tasks/${t.id}`)).body.task.status).toBe("todo");
    const moved = (
      await a
        .write(
          "put",
          `time-blocks/${schedule.block.id}`,
          {
            title: "Revised work",
            startsAt: "2026-10-25T18:00:00Z",
            endsAt: "2026-10-25T19:00:00Z",
          },
          schedule.block.version,
        )
        .expect(200)
    ).body;
    expect(
      (await a.get("tasks/day-links?date=2026-10-25")).body.blockIds,
    ).toContain(moved.id);
    expect(
      (await a.get("tasks?view=today&date=2026-10-25")).body.items.map(
        (x: { id: string }) => x.id,
      ),
    ).toContain(t.id);
    const removal = (
      await a
        .write("delete", `time-blocks/${moved.id}`, {}, moved.version)
        .expect(200)
    ).body;
    expect((await a.get(`tasks/${t.id}`)).body.schedules).toHaveLength(1);
    if (removal.undoId) {
      await a
        .write("post", `time-block-deletions/${removal.undoId}/undo`)
        .expect(200);
      expect((await a.get(`tasks/${t.id}`)).body.schedules).toHaveLength(2);
    }
    const corrected = (
      await a
        .write(
          "put",
          `task-times/${log.id}`,
          { startsAt: timing.startsAt, endsAt: "2026-10-23T18:30:00Z" },
          log.version,
        )
        .expect(200)
    ).body;
    week = (await a.get("weeks/2026-10-23")).body;
    expect(
      week.entries.find((e: { sourceId: string }) => e.sourceId === log.id)
        .endsAt,
    ).toBe(corrected.endsAt);
    await a
      .write("delete", `task-times/${log.id}`, {}, corrected.version)
      .expect(200);
    expect((await a.get("weeks/2026-10-23")).body.entries).toHaveLength(0);
  });
  it("preserves monthly anchors, advances once, changes future repetition and retains completed history", async () => {
    const a = client((await signUp()).cookie);
    const t = (
      await a
        .write("post", "tasks", {
          title: "Monthly review",
          inbox: false,
          plannedDate: "2028-01-31",
          repeat: { frequency: "monthly", until: "2028-04-30" },
        })
        .expect(201)
    ).body;
    const key = randomUUID();
    const done = (
      await a
        .write("put", `tasks/${t.id}/state`, { status: "done" }, t.version, key)
        .expect(200)
    ).body;
    await a
      .write("put", `tasks/${t.id}/state`, { status: "done" }, t.version, key)
      .expect(200);
    let list = (await a.get("tasks?date=2028-02-01&view=all&status=all")).body
      .items;
    expect(list).toHaveLength(2);
    const feb = list.find((x: { status: string }) => x.status === "todo");
    expect(feb.plannedDate).toBe("2028-02-29");
    const input = {
      title: "Updated review",
      inbox: false,
      plannedDate: feb.plannedDate,
      repeat: { frequency: "monthly", until: "2028-03-31" },
    };
    const revised = (
      await a
        .write("put", `tasks/${feb.id}/future`, input, feb.version)
        .expect(200)
    ).body;
    await a
      .write(
        "put",
        `tasks/${feb.id}/state`,
        { status: "skipped" },
        revised.version,
      )
      .expect(200);
    list = (await a.get("tasks?date=2028-03-01&view=all&status=all")).body
      .items;
    expect(
      list.find((x: { plannedDate: string }) => x.plannedDate === "2028-03-31")
        .title,
    ).toBe("Updated review");
    expect((await a.get(`tasks/${t.id}`)).body.task).toMatchObject({
      title: "Monthly review",
      status: "done",
      version: done.version,
    });
    const march = list.find((x: { status: string }) => x.status === "todo");
    await a
      .write(
        "put",
        `tasks/${march.id}/state`,
        { status: "done" },
        march.version,
      )
      .expect(200);
    expect(
      (await a.get("tasks?date=2028-04-01&view=all")).body.items,
    ).toHaveLength(0);
  });
  it("isolates tasks, projects, sections, time and schedule references across accounts", async () => {
    const a = client((await signUp()).cookie),
      b = client((await signUp()).cookie);
    const project = (
      await a.write("post", "task-projects", { name: "Private" }).expect(201)
    ).body;
    const task = (
      await a
        .write("post", "tasks", {
          title: "Private task",
          projectId: project.id,
        })
        .expect(201)
    ).body;
    await b.get(`tasks/${task.id}`).expect(404);
    await b
      .write("put", `tasks/${task.id}`, { title: "Other" }, task.version)
      .expect(404);
    await b.write("delete", `tasks/${task.id}`, {}, task.version).expect(404);
    await b.get(`task-projects/${project.id}`).expect(404);
    await b
      .write("post", "tasks", { title: "Wrong project", projectId: project.id })
      .expect(404);
    await a
      .write("post", "tasks", {
        title: "Wrong section",
        projectId: project.id,
        sectionId: randomUUID(),
      })
      .expect(422);
    const log = (
      await a
        .write(
          "post",
          `tasks/${task.id}/times`,
          { startsAt: "2026-10-23T18:00:00Z", endsAt: "2026-10-23T19:00:00Z" },
          task.version,
        )
        .expect(201)
    ).body;
    await b
      .write("delete", `task-times/${log.id}`, {}, log.version)
      .expect(404);
    expect((await b.get("tasks?date=2026-10-23&view=all")).body.items).toEqual(
      [],
    );
    await a
      .write("post", "tasks", { title: "", dueDate: "invalid" })
      .expect(422);
  });
});

it("serializes competing completions and allows corrections inside a closed project", async () => {
  const a = client((await signUp()).cookie),
    b = client((await signUp()).cookie);
  const p = (
    await a
      .write("post", "task-projects", { name: "Monthly admin" })
      .expect(201)
  ).body;
  const task = (
    await a
      .write("post", "tasks", {
        title: "Review",
        projectId: p.id,
        plannedDate: "2026-10-23",
        repeat: { frequency: "daily", until: "2026-10-25" },
      })
      .expect(201)
  ).body;
  const results = await Promise.all([
    a.write("put", `tasks/${task.id}/state`, { status: "done" }, task.version),
    a.write("put", `tasks/${task.id}/state`, { status: "done" }, task.version),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(
    (await a.get("tasks?view=all&status=all&date=2026-10-23")).body.items,
  ).toHaveLength(2);
  await a
    .write(
      "put",
      `task-projects/${p.id}`,
      { name: p.name, status: "archived" },
      p.version,
    )
    .expect(200);
  const current = (await a.get(`tasks/${task.id}`)).body.task;
  await a
    .write(
      "put",
      `tasks/${task.id}`,
      {
        title: "Corrected review",
        projectId: p.id,
        plannedDate: current.plannedDate,
        repeat: current.repeat,
      },
      current.version,
    )
    .expect(200);
  await a
    .write("post", "tasks", { title: "New assignment", projectId: p.id })
    .expect(422);
  const log = (
    await a
      .write(
        "post",
        `tasks/${task.id}/times`,
        { startsAt: "2026-10-23T18:00:00Z", endsAt: "2026-10-23T19:00:00Z" },
        (await a.get(`tasks/${task.id}`)).body.task.version,
      )
      .expect(201)
  ).body;
  expect(
    (await a.get(`tasks/for-time/${log.id}`).expect(200)).body.taskId,
  ).toBe(task.id);
  await b.get(`tasks/for-time/${log.id}`).expect(404);
});

it("orders project tasks, paginates, duplicates independently and deletes linked work atomically", async () => {
  const a = client((await signUp()).cookie);
  const p = (
    await a.write("post", "task-projects", { name: "Prepare" }).expect(201)
  ).body;
  const first = (
    await a
      .write("post", "tasks", { title: "First", projectId: p.id, inbox: false })
      .expect(201)
  ).body;
  const second = (
    await a
      .write("post", "tasks", {
        title: "Second",
        projectId: p.id,
        inbox: false,
      })
      .expect(201)
  ).body;
  const moved = (
    await a
      .write(
        "post",
        `tasks/${second.id}/move`,
        { direction: "up" },
        second.version,
      )
      .expect(200)
  ).body;
  const list = (
    await a
      .get(`tasks?view=all&date=2026-10-23&projectId=${p.id}&limit=1`)
      .expect(200)
  ).body;
  expect(list.items[0].id).toBe(second.id);
  expect(
    (
      await a.get(
        `tasks?view=all&date=2026-10-23&projectId=${p.id}&limit=1&cursor=${list.nextCursor}`,
      )
    ).body.items[0].id,
  ).toBe(first.id);
  const copy = (
    await a
      .write("post", `tasks/${second.id}/duplicate`, {}, moved.version)
      .expect(201)
  ).body;
  expect(copy).toMatchObject({ repeat: null, inbox: true, status: "todo" });
  const archived = (
    await a
      .write("put", `tasks/${copy.id}/state`, { archived: true }, copy.version)
      .expect(200)
  ).body;
  expect(
    (
      await a.get("tasks?view=all&date=2026-10-23&archived=true")
    ).body.items.map((x: { id: string }) => x.id),
  ).toEqual([copy.id]);
  await a
    .write(
      "put",
      `tasks/${copy.id}/state`,
      { archived: false },
      archived.version,
    )
    .expect(200);
  const task = (await a.get(`tasks/${second.id}`)).body.task;
  const timing = {
    startsAt: "2026-10-23T18:00:00Z",
    endsAt: "2026-10-23T19:00:00Z",
  };
  await a
    .write("post", `tasks/${task.id}/schedules`, timing, task.version)
    .expect(201);
  await a
    .write(
      "post",
      `tasks/${task.id}/times`,
      timing,
      (await a.get(`tasks/${task.id}`)).body.task.version,
    )
    .expect(201);
  await a
    .write(
      "delete",
      `tasks/${task.id}`,
      {},
      (await a.get(`tasks/${task.id}`)).body.task.version,
    )
    .expect(200);
  await a.get(`tasks/${task.id}`).expect(404);
  expect((await a.get("weeks/2026-10-23")).body).toMatchObject({
    blocks: [],
    entries: [],
  });
});

it("isolates occurrence-only edits from the future template and keeps template references valid after project deletion", async () => {
  const a = client((await signUp()).cookie);
  const p = (
    await a
      .write("post", "task-projects", { name: "Review project" })
      .expect(201)
  ).body;
  const task = (
    await a
      .write("post", "tasks", {
        title: "Original review",
        projectId: p.id,
        plannedDate: "2027-01-30",
        dueDate: "2027-01-31",
        repeat: { frequency: "monthly", until: "2027-03-31" },
      })
      .expect(201)
  ).body;
  const edited = (
    await a
      .write(
        "put",
        `tasks/${task.id}`,
        {
          title: "This occurrence only",
          projectId: p.id,
          plannedDate: "2027-01-29",
          dueDate: "2027-02-01",
          repeat: task.repeat,
        },
        task.version,
      )
      .expect(200)
  ).body;
  await a
    .write("put", `tasks/${task.id}/state`, { status: "done" }, edited.version)
    .expect(200);
  const next = (await a.get("tasks?view=all&date=2027-02-01")).body.items[0];
  expect(next).toMatchObject({
    title: "Original review",
    dueDate: "2027-02-28",
    plannedDate: "2027-02-27",
  });
  await a.write("delete", `task-projects/${p.id}`, {}, p.version).expect(200);
  const standalone = (await a.get(`tasks/${next.id}`)).body.task;
  expect(standalone.projectId).toBeNull();
  await a
    .write(
      "put",
      `tasks/${next.id}/state`,
      { status: "done" },
      standalone.version,
    )
    .expect(200);
  const third = (await a.get("tasks?view=all&date=2027-03-01")).body.items[0];
  expect(third).toMatchObject({
    title: "Original review",
    projectId: null,
    dueDate: "2027-03-31",
    plannedDate: "2027-03-30",
  });
});
