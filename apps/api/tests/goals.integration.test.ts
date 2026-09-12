import { it, expect } from "vitest";
import request from "supertest";
import { testApp, origin } from "./helpers.js";
const { app, signUp } = testApp();
it("creates, edits, completes/reopens goals, enforces goal/category links and composes dashboard", async () => {
  const a = await signUp(),
    b = await signUp();
  const post = (path: string, input: object, cookie = a.cookie) =>
    request(app)
      .post("/api/v1/" + path)
      .set("Cookie", cookie)
      .set("Origin", origin)
      .send(input);
  const category = await post("categories", { name: "Learning" }).expect(201);
  const input = {
    title: "Read a book",
    categoryId: category.body.id,
    targetDate: "2026-10-01",
    description: "Read a little each week",
    status: "active",
  };
  const goal = await post("goals", input).expect(201);
  await request(app)
    .get("/api/v1/goals/" + goal.body.id)
    .set("Cookie", b.cookie)
    .expect(404);
  await request(app)
    .put("/api/v1/goals/" + goal.body.id)
    .set("Cookie", b.cookie)
    .set("Origin", origin)
    .send(input)
    .expect(404);
  await post("goals", input, b.cookie).expect(404);
  await post(
    "time-blocks",
    {
      title: "Reading",
      goalId: goal.body.id,
      startsAt: "2026-09-12T10:00:00Z",
      endsAt: "2026-09-12T11:00:00Z",
    },
    b.cookie,
  ).expect(404);
  const completed = await request(app)
    .put("/api/v1/goals/" + goal.body.id)
    .set("Cookie", a.cookie)
    .set("Origin", origin)
    .send({ ...input, status: "completed" })
    .expect(200);
  expect(completed.body.completedAt).toBeTruthy();
  const reopened = await request(app)
    .put("/api/v1/goals/" + goal.body.id)
    .set("Cookie", a.cookie)
    .set("Origin", origin)
    .send(input)
    .expect(200);
  expect(reopened.body.completedAt).toBeNull();
  const dashboard = await request(app)
    .get("/api/v1/dashboard")
    .set("Cookie", a.cookie)
    .expect(200);
  expect(dashboard.body.goals[0].title).toBe(input.title);
});
