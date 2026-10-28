import { measurementsFor, type ExerciseMeasurement } from "@168hours/contracts";
import { fromKilograms, fromMeters } from "@168hours/domain-utils";
import { formatFitnessDuration } from "./rest-duration";
import type { ExerciseDraft } from "./strength-draft";

type Units = {
  weightUnit: "kg" | "lb";
  distanceUnit: "m" | "km" | "yd" | "mi";
  durationUnit?: import("@168hours/domain-utils").DurationUnit;
};
const targetKeys = {
  reps: "targetReps",
  load: "targetWeightKg",
  duration: "targetDurationSeconds",
  distance: "targetDistanceMeters",
  laps: "targetLaps",
} as const;
const order: ExerciseMeasurement[] = [
  "reps",
  "duration",
  "distance",
  "laps",
  "load",
];
const number = (value: number) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(value);

/** Summarize planned targets only; hidden measurements and recorded results are excluded. */
export function workoutExerciseSummary(
  exercise: ExerciseDraft,
  units: Units,
  compact = false,
  setUnits?: Units[],
): string {
  const count = exercise.sets.length;
  const countLabel = `${count} ${count === 1 ? "set" : "sets"}`;
  if (!count) return countLabel;
  const selections = exercise.sets.map((set) =>
    measurementsFor(
      set.measurementOverride ?? exercise.loggingType ?? "reps_load",
    ),
  );
  if (compact) {
    const signatures = exercise.sets.map((set, index) =>
      JSON.stringify(
        selections[index]!.map((field) => [field, set[targetKeys[field]]]),
      ),
    );
    if (signatures.some((signature) => signature !== signatures[0]))
      return `${countLabel} · Mixed targets`;
    if (selections[0]!.length > 2)
      return `${countLabel} · ${selections[0]!.length} measurements`;
  }
  if (setUnits?.length === count) {
    const signature = (index: number) =>
      JSON.stringify([
        selections[index]!.includes("load")
          ? setUnits[index]!.weightUnit
          : units.weightUnit,
        selections[index]!.includes("distance")
          ? setUnits[index]!.distanceUnit
          : units.distanceUnit,
        selections[index]!.includes("duration")
          ? setUnits[index]!.durationUnit
          : units.durationUnit,
      ]);
    if (setUnits.some((_, index) => signature(index) !== signature(0))) {
      if (compact) return `${countLabel} · Mixed units`;
      const groups: {
        signature: string;
        sets: ExerciseDraft["sets"];
        units: Units;
      }[] = [];
      exercise.sets.forEach((set, index) => {
        const key = signature(index);
        const previous = groups.at(-1);
        if (previous?.signature === key) previous.sets.push(set);
        else
          groups.push({ signature: key, sets: [set], units: setUnits[index]! });
      });
      const visible = groups.slice(0, 3);
      const parts = visible.map((group) =>
        workoutExerciseSummary({ ...exercise, sets: group.sets }, group.units),
      );
      const remaining =
        count - visible.reduce((sum, group) => sum + group.sets.length, 0);
      if (remaining)
        parts.push(`+ ${remaining} ${remaining === 1 ? "set" : "sets"}`);
      return parts.join(" / ");
    }
    units = setUnits[0]!;
  }
  if (selections.some((fields) => fields.join() !== selections[0]!.join())) {
    // Only merge adjacent sets with the same selected fields and planned values.
    // Hidden targets, recorded results and rest do not affect these groups.
    const groups: { signature: string; sets: ExerciseDraft["sets"] }[] = [];
    exercise.sets.forEach((set, index) => {
      const fields = selections[index]!;
      const signature = JSON.stringify(
        fields.map((field) => [field, set[targetKeys[field]]]),
      );
      const previous = groups.at(-1);
      if (previous?.signature === signature) previous.sets.push(set);
      else groups.push({ signature, sets: [set] });
    });
    const visible = groups.slice(0, 3);
    const parts = visible.map(({ sets }) => {
      const summary = workoutExerciseSummary({ ...exercise, sets }, units);
      const fields = measurementsFor(
        sets[0]!.measurementOverride ?? exercise.loggingType ?? "reps_load",
      );
      return fields.every((field) => sets[0]![targetKeys[field]] === null)
        ? `${summary} | ${fields.join(" + ")}`
        : summary;
    });
    const remaining =
      count - visible.reduce((sum, group) => sum + group.sets.length, 0);
    if (remaining)
      parts.push(`+ ${remaining} ${remaining === 1 ? "set" : "sets"}`);
    return parts.join(" / ");
  }

  const fields = order.filter((field) => selections[0]!.includes(field));
  const targets = fields.flatMap((field) => {
    const values = exercise.sets
      .map((set) => set[targetKeys[field]])
      .filter(
        (value): value is number =>
          typeof value === "number" && Number.isFinite(value),
      );
    return values.length
      ? [
          {
            field,
            min: Math.min(...values),
            max: Math.max(...values),
            partial: values.length < count,
          },
        ]
      : [];
  });
  const partial = targets.some((target) => target.partial);
  const uniform =
    !partial && targets.every((target) => target.min === target.max);
  const primary =
    uniform && targets[0]?.field !== "load" ? targets[0] : undefined;
  const range = (
    field: ExerciseMeasurement,
    min: number,
    max: number,
    compactReps = false,
  ) => {
    const convert = (value: number) =>
      field === "load"
        ? fromKilograms(value, units.weightUnit)
        : field === "distance"
          ? fromMeters(value, units.distanceUnit)
          : value;
    const format = (value: number) =>
      field === "load"
        ? number(Number(convert(value).toFixed(2)))
        : number(convert(value));
    const low = format(min),
      high = format(max);
    const value = low === high ? low : `${low}–${high}`;
    switch (field) {
      case "reps":
        return compactReps ? value : `${value} reps`;
      case "load":
        return `${value} ${units.weightUnit}`;
      case "distance":
        return `${value} ${units.distanceUnit}`;
      case "laps":
        return `${value} ${min === 1 && max === 1 ? "lap" : "laps"}`;
      case "duration":
        return min === max
          ? formatFitnessDuration(min, units.durationUnit)
          : `${formatFitnessDuration(min, units.durationUnit)}–${formatFitnessDuration(max, units.durationUnit)}`;
    }
  };
  const parts = [
    primary
      ? `${count}×${range(primary.field, primary.min, primary.max, true)}`
      : countLabel,
  ];
  for (const target of targets) {
    if (target === primary) continue;
    parts.push(range(target.field, target.min, target.max));
  }
  if (partial) parts.push("Some targets unset");
  return parts.join(" | ");
}
