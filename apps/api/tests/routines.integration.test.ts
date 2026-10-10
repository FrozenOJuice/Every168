import { expect, it } from "vitest";
import request from "supertest";
import { testApp, commandHeaders, origin } from "./helpers.js";

const { app, signUp } = testApp();
function client(cookie: string) {
  const root = "/api/v1/routines";
  return {
    list: () => request(app).get(root).set("Cookie", cookie),
    get: (id: string) =>
      request(app)
        .get(root + "/" + id)
        .set("Cookie", cookie),
    post: (input: object) =>
      request(app)
        .post(root)
        .set("Cookie", cookie)
        .set("Origin", origin)
        .set(commandHeaders())
        .send(input),
    put: (id: string, input: object, version: number) =>
      request(app)
        .put(root + "/" + id)
        .set("Cookie", cookie)
        .set("Origin", origin)
        .set(commandHeaders(version))
        .send(input),
    progress: (id: string, checked: number[], version: number) =>
      request(app)
        .put(root + "/" + id + "/progress")
        .set("Cookie", cookie)
        .set("Origin", origin)
        .set(commandHeaders(version))
        .send({ checked }),
    complete: (id: string, version: number) =>
      request(app)
        .post(root + "/" + id + "/complete")
        .set("Cookie", cookie)
        .set("Origin", origin)
        .set(commandHeaders(version))
        .send({}),
    delete: (id: string, version: number) =>
      request(app)
        .delete(root + "/" + id)
        .set("Cookie", cookie)
        .set("Origin", origin)
        .set(commandHeaders(version)),
  };
}

it("keeps ordered routine checklists private and records completed runs", async () => {
  const a = client((await signUp()).cookie),
    b = client((await signUp()).cookie);
  const input = { name: "Bedtime", steps: ["Brush teeth", "Read"] };
  const created = (await a.post(input).expect(201)).body;
  expect(created.steps).toEqual(input.steps);
  expect((await a.list().expect(200)).body).toHaveLength(1);
  expect((await b.list().expect(200)).body).toHaveLength(0);
  await b.get(created.id).expect(404);
  await b.put(created.id, input, created.version).expect(404);
  await b.progress(created.id, [0], created.version).expect(404);
  await b.complete(created.id, created.version).expect(404);
  await b.delete(created.id, created.version).expect(404);
  await a.progress(created.id, [2], created.version).expect(422);
  const first = (await a.progress(created.id, [0], created.version).expect(200))
    .body;
  await a.complete(created.id, first.version).expect(422);
  const second = (
    await a.progress(created.id, [0, 1], first.version).expect(200)
  ).body;
  await a.progress(created.id, [0], first.version).expect(409);
  const done = (await a.complete(created.id, second.version).expect(200)).body;
  expect(done.checked).toEqual([]);
  expect(done.runCount).toBe(1);
  expect(done.lastCompletedAt).toBeTruthy();
  const changed = (
    await a
      .put(
        created.id,
        { name: "Night", steps: ["Read", "Sleep"] },
        done.version,
      )
      .expect(200)
  ).body;
  expect(changed.steps).toEqual(["Read", "Sleep"]);
  expect(changed.runCount).toBe(1);
  await a.delete(created.id, changed.version).expect(200);
  expect((await a.list().expect(200)).body).toHaveLength(0);
});
