"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { DurationUnit } from "@168hours/domain-utils";
import type { SetDraft } from "./strength-draft";

export type WorkoutDisplayUnits = {
  weightUnit: "kg" | "lb";
  distanceUnit: "m" | "km" | "yd" | "mi";
  durationUnit?: DurationUnit;
};
type Overrides = Partial<WorkoutDisplayUnits>;
type Context = {
  shared: Overrides;
  sets: Record<string, Overrides>;
  change: (scope: string | null, patch: Overrides) => void;
};
export const WorkoutDisplayUnitsContext = createContext<Context | null>(null);
const Scope = createContext<string | null>(null);
export const setUnitKey = (set: SetDraft, index: number) =>
  set.clientKey ?? set.id ?? String(index);
export function WorkoutUnitScope({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  return <Scope.Provider value={id}>{children}</Scope.Provider>;
}
export function useWorkoutDisplayUnits() {
  const context = useContext(WorkoutDisplayUnitsContext);
  const scope = useContext(Scope);
  return context
    ? {
        units: {
          ...context.shared,
          ...(scope === null ? {} : context.sets[scope]),
        },
        change: (patch: Overrides) => context.change(scope, patch),
      }
    : null;
}
export function useExerciseDisplayUnits(preferences: WorkoutDisplayUnits) {
  const signature = JSON.stringify([
    preferences.weightUnit,
    preferences.distanceUnit,
    preferences.durationUnit,
  ]);
  const [state, setState] = useState({
    signature,
    shared: {} as Overrides,
    sets: {} as Record<string, Overrides>,
  });
  if (state.signature !== signature)
    setState({ signature, shared: {}, sets: {} });
  const context: Context = {
    shared: state.shared,
    sets: state.sets,
    change: (scope, patch) =>
      setState((current) =>
        scope === null
          ? {
              ...current,
              shared: { ...current.shared, ...patch },
              // A shared unit selection applies to all sets just like shared targets.
              sets: Object.fromEntries(
                Object.entries(current.sets).map(([key, units]) => [
                  key,
                  Object.fromEntries(
                    Object.entries(units).filter(
                      ([field]) => !(field in patch),
                    ),
                  ),
                ]),
              ),
            }
          : {
              ...current,
              sets: {
                ...current.sets,
                [scope]: { ...current.sets[scope], ...patch },
              },
            },
      ),
  };
  return {
    context,
    copySetUnits: (source: string, destination: string) =>
      setState((current) =>
        current.sets[source]
          ? {
              ...current,
              sets: {
                ...current.sets,
                [destination]: { ...current.sets[source] },
              },
            }
          : current,
      ),
    units: { ...preferences, ...state.shared },
    forSet: (set: SetDraft, index: number) => ({
      ...preferences,
      ...state.shared,
      ...state.sets[setUnitKey(set, index)],
    }),
  };
}
