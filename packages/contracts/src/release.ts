export type ReleaseScope = "core" | "preview";

/** Deferred features stay implemented, but are unavailable in the first release. */
export function releaseFeatures(scope: ReleaseScope = "core") {
  return {
    goals: scope === "preview",
    routines: scope === "preview",
    unscheduled: scope === "preview",
    legacyCardio: scope === "preview",
    legacyDashboard: scope === "preview",
    calendarTemplates: scope === "preview",
    tasks: scope === "preview",
    food: true,
    assistant: scope === "preview",
    trainingPrograms: scope === "preview",
  };
}
