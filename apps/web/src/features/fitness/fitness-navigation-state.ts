import { z } from "zod";
import { exerciseLoggingTypeSchema, idSchema } from "@168hours/contracts";
import { parseExerciseWorkoutReturn } from "./exercise-workout-return";

const route =
  /^\/fitness(?:\/(?:history|exercises(?:\/(?:[0-9a-f-]{36}|catalog\/[a-zA-Z0-9_-]+))?|session\/[0-9a-f-]{36}|workout\/(?:new|[0-9a-f-]{36})))?$/;
export function fitnessHref(value: unknown): string | undefined {
  if (
    typeof value !== "string" ||
    value.length > 2500 ||
    !route.test(value.split("?")[0]!)
  )
    return;
  const url = new URL(value, "https://fitness.invalid");
  if (
    url.origin !== "https://fitness.invalid" ||
    url.hash ||
    !route.test(url.pathname)
  )
    return;
  return url.pathname + url.search;
}
const href = z.string().refine((value) => fitnessHref(value) === value);
export const libraryFilterSchema = z.object({
  search: z.string().max(160),
  sort: z.enum(["name_asc", "name_desc", "recent"]),
  equipment: z.array(z.string().max(100)).max(100),
  muscle: z.array(z.string().max(100)).max(100),
  favourites: z.boolean(),
  archived: z.boolean(),
  pages: z.number().int().min(1).max(1000).optional(),
});
export type LibraryFilters = z.infer<typeof libraryFilterSchema>;
const positionSchema = z.object({
  page: z.number().min(0),
  pane: z.number().min(0),
  builder: z.number().min(0),
  library: z.number().min(0),
  focus: z.string().max(300).optional(),
  focusText: z.string().max(300).optional(),
  focusOccurrence: z.number().int().min(0).max(10000).optional(),
  reference: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  occurrence: z.number().int().min(0).max(10000).optional(),
});
export type FitnessPosition = z.infer<typeof positionSchema>;
export const screenViews = z.enum([
  "default",
  "summary",
  "live",
  "editor",
  "corrections",
]);
export type ScreenView = z.infer<typeof screenViews>;
export const navigationNodeSchema = z.object({
  kind: z.enum(["screen", "exercise"]),
  href,
  location: href,
  view: screenViews.default("default"),
  exerciseId: idSchema.optional(),
  catalogKey: z.string().max(100).optional(),
  mode: exerciseLoggingTypeSchema.optional(),
  history: z.boolean().optional(),
  inline: z.boolean().optional(),
  compact: z.boolean().optional(),
  fromLibrary: z.boolean().optional(),
  position: positionSchema.optional(),
  filters: libraryFilterSchema.optional(),
  entryKey: z.string().max(200).optional(),
  entryIndex: z.number().int().optional(),
});
export type FitnessNode = z.infer<typeof navigationNodeSchema>;
export const navigationEntrySchema = z.object({
  token: z.uuid(),
  location: href,
  path: z.array(navigationNodeSchema).min(1).max(24),
});
export type FitnessEntry = z.infer<typeof navigationEntrySchema>;
export function nodeKey(node: FitnessNode) {
  return node.kind === "exercise"
    ? `exercise:${node.exerciseId ?? node.catalogKey ?? node.href.split("?")[0]}`
    : `screen:${node.href.split("?")[0]}`;
}
export function visitFitnessNode(path: FitnessNode[], next: FitnessNode) {
  const index = path.findIndex((node) => nodeKey(node) === nodeKey(next));
  if (index >= 0) return { path: path.slice(0, index + 1), existing: true };
  const appended = [...path, next];
  return {
    path:
      appended.length > 24 ? [appended[0]!, ...appended.slice(-23)] : appended,
    existing: false,
  };
}
export function screenNode(
  href: string,
  view: ScreenView = "default",
): FitnessNode {
  return { kind: "screen", href, location: href, view };
}
export function exerciseNode(
  href: string,
  exerciseId?: string,
  catalogKey?: string,
): FitnessNode {
  return {
    kind: "exercise",
    href,
    location: href,
    view: "default",
    exerciseId,
    catalogKey,
  };
}
export function rootPath(href: string): FitnessNode[] {
  const url = new URL(href, "https://fitness.invalid");
  if (url.pathname.startsWith("/fitness/exercises/")) {
    const catalog = url.pathname.split("/catalog/")[1];
    return [
      screenNode("/fitness/exercises"),
      exerciseNode(
        href,
        catalog ? undefined : url.pathname.split("/")[3],
        catalog,
      ),
    ];
  }
  if (url.pathname.startsWith("/fitness/session/")) {
    const origin = parseExerciseWorkoutReturn(
      url.searchParams.get("returnExercise"),
      url.searchParams.get("returnTo"),
    );
    if (origin) {
      const restore = new URL(origin.href, "https://fitness.invalid");
      restore.searchParams.set(
        "restoreWorkout",
        url.pathname.split("/").at(-1)!,
      );
      const target = exerciseNode(
        restore.pathname + restore.search,
        origin.exerciseId,
      );
      return [screenNode("/fitness/exercises"), target, screenNode(href)];
    }
    const history = fitnessHref(url.searchParams.get("returnHistory"));
    return [
      screenNode(
        history?.startsWith("/fitness/history") ? history : "/fitness/history",
      ),
      screenNode(href),
    ];
  }
  if (url.pathname.startsWith("/fitness/workout/")) {
    const source = fitnessHref(url.searchParams.get("returnTo"));
    if (source?.startsWith("/fitness/exercises/"))
      return [...rootPath(source), screenNode(href, "editor")];
    return [screenNode("/fitness"), screenNode(href, "editor")];
  }
  return [screenNode(href)];
}
