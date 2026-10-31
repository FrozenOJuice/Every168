import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import request from "supertest";
import { origin, testApp } from "./helpers.js";
import { user } from "../src/modules/identity/identity.table.js";

const { app, deps, mail } = testApp("core", "development");
it("allows an unverified development account to sign in, use private routes and change its password without pretending its email was verified", async () => {
  const email = `local-access-${randomUUID()}@example.com`;
  const password = "Synthetic-development-password-123";
  const input = { name: "Local access", email, password };
  const post = (path: string, body: object, cookie = "") =>
    request(app)
      .post(`/api/auth/${path}`)
      .set("Origin", origin)
      .set("Cookie", cookie)
      .send(body);
  const cookieOf = (response: request.Response) =>
    (response.headers["set-cookie"] as unknown as string[])
      .map((value) => value.split(";")[0])
      .join("; ");
  try {
    const created = await post("sign-up/email", input).expect(200);
    expect(created.body).toEqual({ status: true, verificationRequired: false });
    expect(created.headers["set-cookie"]).toBeUndefined();
    expect((await post("sign-up/email", input).expect(200)).body).toEqual(
      created.body,
    );
    expect(mail).toEqual([]);
    const login = await post("sign-in/email", { email, password }).expect(200);
    const cookie = cookieOf(login);
    await request(app).get("/api/v1/me").set("Cookie", cookie).expect(200);
    const changed = "Changed-development-password-123";
    await post(
      "change-password",
      { currentPassword: password, newPassword: changed },
      cookie,
    ).expect(200);
    await request(app).get("/api/v1/me").set("Cookie", cookie).expect(401);
    await post("sign-in/email", { email, password }).expect(401);
    const next = await post("sign-in/email", {
      email,
      password: changed,
    }).expect(200);
    const [owner] = await deps.db
      .select()
      .from(user)
      .where(eq(user.email, email));
    expect(owner!.emailVerified).toBe(false);
    await deps.db
      .update(user)
      .set({ suspendedAt: new Date() })
      .where(eq(user.id, owner!.id));
    await request(app)
      .get("/api/v1/me")
      .set("Cookie", cookieOf(next))
      .expect(401);
    await post("sign-in/email", { email, password: changed }).expect(401);
  } finally {
    await deps.db.delete(user).where(eq(user.email, email));
  }
});
