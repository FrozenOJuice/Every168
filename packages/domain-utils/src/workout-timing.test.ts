import { expect, it } from "vitest";
import {
  activeIntervals,
  clipWorkoutPauses,
  workoutSeconds,
  type WorkoutTiming,
} from "./time";
const at = (minute: number) =>
  new Date(Date.UTC(2026, 9, 28, 12, minute)).toISOString();
it("excludes closed and open pauses while retaining rest and actual wall-clock bounds", () => {
  const workout: WorkoutTiming = {
    startedAt: at(0),
    endedAt: null,
    pauses: [{ startsAt: at(10), endsAt: null }],
  };
  expect(workoutSeconds(workout, Date.parse(at(40)))).toBe(600);
  expect(workoutSeconds(workout, Date.parse(at(5)))).toBe(600);
  workout.pauses = [{ startsAt: at(10), endsAt: at(30) }];
  expect(workoutSeconds(workout, Date.parse(at(40)))).toBe(1200);
  expect(workoutSeconds(workout, Date.parse(at(5)))).toBe(600);
  expect(workoutSeconds({ ...workout, endedAt: at(60) })).toBe(2400);
  expect(workoutSeconds({ startedAt: at(0), endedAt: at(60) })).toBe(3600);
});
it("clips exclusions at day/range boundaries, merges overlap and retains the real active spans", () => {
  expect(
    activeIntervals({ startsAt: at(0), endsAt: at(60) }, [
      { startsAt: at(-10), endsAt: at(10) },
      { startsAt: at(5), endsAt: at(20) },
      { startsAt: at(40), endsAt: at(70) },
    ]),
  ).toEqual([{ startsAt: at(20), endsAt: at(40) }]);
  expect(
    clipWorkoutPauses({
      startedAt: at(15),
      endedAt: at(45),
      pauses: [
        { startsAt: at(10), endsAt: at(20) },
        { startsAt: at(40), endsAt: null },
      ],
    }),
  ).toEqual([
    { startsAt: at(15), endsAt: at(20) },
    { startsAt: at(40), endsAt: at(45) },
  ]);
});

it("preserves pauses while a timing correction has an invalid range", () => {
  const pauses = [{ startsAt: at(10), endsAt: at(20) }];
  expect(
    clipWorkoutPauses({ startedAt: at(30), endedAt: at(5), pauses }),
  ).toEqual(pauses);
});
