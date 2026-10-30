export type ReleaseScope = "core" | "preview";

/** Deferred domains stay implemented, but are unavailable in the first release. */
export function releaseFeatures(scope: ReleaseScope = "core") {
  return {
    tasks: scope === "preview",
    food: scope === "preview",
    assistant: scope === "preview",
    trainingPrograms: scope === "preview",
  };
}
