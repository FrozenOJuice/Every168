import "dotenv/config";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { addDays, weekRange, localDate } from "@168hours/domain-utils";
import { compose } from "../../composition.js";
import { readConfig } from "../config/env.js";
import { user } from "../../modules/identity/identity.table.js";
const config = readConfig();
const location = new URL(config.DATABASE_URL);
if (
  config.NODE_ENV !== "development" ||
  !["localhost", "127.0.0.1"].includes(location.hostname) ||
  location.pathname !== "/hours_dev"
) {
  throw new Error(
    "Seeding is restricted to local development database hours_dev.",
  );
}
const password = z.string().min(12).max(128).parse(process.env.SEED_PASSWORD);
const deps = compose(config);
try {
  const email = "demo@example.com";
  const existing = await deps.db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  if (existing.length) {
    console.log("Demo account already exists; no records changed.");
  } else {
    const result = await deps.auth.api.signUpEmail({
      body: { name: "Demo member", email, password },
    });
    const id = result.user.id;
    const today = localDate(new Date(), "UTC");
    const monday = weekRange(today, "UTC", 1).weekStart;
    const at = (date: string, time: string) => `${date}T${time}:00Z`;
    const categories = await Promise.all(
      ["Work", "Exercise", "Learning", "Free Time"].map((name) =>
        deps.categories.create(id, { name, color: null, icon: null }),
      ),
    );
    const work = categories[0]!,
      exercise = categories[1]!,
      learning = categories[2]!;
    const goal = await deps.goals.create(id, {
      title: "Finish a book",
      description: "Make some room for reading this week.",
      categoryId: learning.id,
      targetDate: addDays(today, 21),
      status: "active",
    });
    for (let i = 0; i < 5; i++)
      await deps.planning.createBlock(id, {
        title: "Focused work",
        categoryId: work.id,
        goalId: null,
        notes: null,
        startsAt: at(addDays(monday, i), "09:00"),
        endsAt: at(addDays(monday, i), "12:00"),
      });
    await deps.planning.createBlock(id, {
      title: "A chapter and a cup of tea",
      categoryId: learning.id,
      goalId: goal.id,
      notes: null,
      startsAt: at(today, "18:00"),
      endsAt: at(today, "19:00"),
    });
    const block = await deps.planning.createBlock(id, {
      title: "Strength session",
      categoryId: exercise.id,
      goalId: null,
      notes: null,
      startsAt: at(today, "07:00"),
      endsAt: at(today, "08:00"),
    });
    const oats = await deps.nutrition.createFood(id, {
      name: "Rolled oats (demo)",
      servingAmount: 40,
      servingUnit: "g",
      calories: 150,
      proteinG: 5,
      carbsG: 27,
      fatG: 3,
      fiberG: 4,
    });
    await deps.nutrition.createFood(id, {
      name: "Homemade soup (demo)",
      servingAmount: 1,
      servingUnit: "serving",
      calories: 250,
      proteinG: null,
      carbsG: null,
      fatG: null,
      fiberG: null,
    });
    await deps.nutrition.logFood(id, {
      foodId: oats.id,
      quantity: 1.5,
      mealType: "breakfast",
      consumedAt: at(today, "08:30"),
    });
    await deps.hydration.create(id, {
      amountMl: 250,
      consumedAt: at(today, "08:30"),
    });
    await deps.body.create(id, {
      weightKg: 72,
      measuredAt: at(today, "07:00"),
    });
    const squat = await deps.exercises.create(id, {
      name: "Squat",
      notes: null,
    });
    const workout = await deps.strength.start(id, {
      title: "Demo strength session",
      startedAt: at(today, "07:00"),
      notes: null,
      linkedTimeBlockId: block.id,
    });
    await deps.strength.save(
      id,
      workout.id,
      {
        title: workout.title,
        startedAt: at(today, "07:00"),
        endedAt: at(today, "07:45"),
        notes: null,
        linkedTimeBlockId: block.id,
        exercises: [
          {
            exerciseId: squat.id,
            notes: null,
            sets: [
              {
                reps: 5,
                weightKg: 40,
                durationSeconds: null,
                distanceMeters: null,
                laps: null,
                completed: true,
                skipped: false,
                targetReps: null,
                targetWeightKg: null,
                targetDurationSeconds: null,
                targetDistanceMeters: null,
                targetLaps: null,
                restSeconds: null,
              },
              {
                reps: 5,
                weightKg: 45,
                durationSeconds: null,
                distanceMeters: null,
                laps: null,
                completed: true,
                skipped: false,
                targetReps: null,
                targetWeightKg: null,
                targetDurationSeconds: null,
                targetDistanceMeters: null,
                targetLaps: null,
                restSeconds: null,
              },
            ],
          },
        ],
      },
      workout.version,
    );
    console.log(
      "Synthetic demo created. Sign in as demo@example.com using your SEED_PASSWORD.",
    );
  }
} finally {
  await deps.pool.end();
}
