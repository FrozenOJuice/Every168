import type {
  Exercise,
  ExerciseSort,
  ExerciseCatalogEntry,
  ExerciseCatalogDefinition,
} from "@168hours/contracts";
export type LibraryExercise = {
  key: string;
  name: string;
  notes: string | null;
  equipment: Exercise["equipment"];
  muscles: Exercise["muscles"];
  exercise: Exercise | null;
  definition?: ExerciseCatalogDefinition;
};
export function libraryExercises(
  catalog: ExerciseCatalogEntry[],
  custom: Exercise[],
): LibraryExercise[] {
  return [
    ...catalog.map((entry) => ({
      key: entry.key,
      name: entry.name,
      notes: entry.notes,
      equipment: [entry.equipment],
      muscles: entry.muscles,
      exercise: entry.exercise,
      definition: entry,
    })),
    ...custom
      .filter((entry) => !entry.catalogKey)
      .map((entry) => ({
        key: entry.id,
        name: entry.name,
        notes: entry.notes,
        equipment: entry.equipment,
        muscles: entry.muscles,
        exercise: entry,
      })),
  ];
}
export function filterLibrary(
  rows: LibraryExercise[],
  filters: {
    search: string;
    equipment: string[];
    muscle: string[];
    archived: boolean;
    favourites?: boolean;
  },
) {
  const search = filters.search.trim().toLocaleLowerCase();
  return rows.filter(
    (row) =>
      !!(row.definition ? row.exercise?.hidden : row.exercise?.archivedAt) ===
        filters.archived &&
      (!filters.favourites || !!row.exercise?.favourite) &&
      (!search ||
        `${row.name} ${row.definition?.name ?? ""}`
          .toLocaleLowerCase()
          .includes(search)) &&
      (!filters.equipment.length ||
        row.equipment.some((equipment) =>
          filters.equipment.includes(equipment),
        )) &&
      (!filters.muscle.length ||
        row.muscles.some((muscle) => filters.muscle.includes(muscle))),
  );
}

export function sortLibrary(rows: LibraryExercise[], sort: ExerciseSort) {
  const compareName = (a: LibraryExercise, b: LibraryExercise) =>
    compareLibraryNames(a.name, b.name) || compareKeys(a.key, b.key);
  const addedAt = (row: LibraryExercise) =>
    row.definition
      ? 0
      : Date.parse(row.exercise?.createdAt ?? "1970-01-01T00:00:00Z");
  return [...rows].sort((a, b) =>
    sort === "recent"
      ? addedAt(b) - addedAt(a) ||
        (a.definition && b.definition
          ? compareName(a, b)
          : compareKeys(b.key, a.key))
      : (sort === "name_asc" ? 1 : -1) * compareName(a, b),
  );
}

function compareKeys(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

// Match the API's lower(name) COLLATE "C" order across page boundaries.
function compareLibraryNames(a: string, b: string) {
  const encoder = new TextEncoder();
  const left = encoder.encode(a.toLowerCase());
  const right = encoder.encode(b.toLowerCase());
  for (let index = 0; index < Math.min(left.length, right.length); index++) {
    const difference = left[index]! - right[index]!;
    if (difference) return difference;
  }
  return left.length - right.length;
}

export function libraryWindow(
  rows: LibraryExercise[],
  fetched: Exercise[],
  sort: ExerciseSort,
  hasMore: boolean,
) {
  const boundary = fetched.at(-1);
  return sortLibrary(
    rows.filter((row) => {
      if (!hasMore) return true;
      if (sort === "recent") return !row.definition;
      if (!boundary) return false;
      const order = compareLibraryNames(row.name, boundary.name);
      // Defer the complete boundary-name bucket so ties cannot insert earlier cards.
      return sort === "name_asc" ? order < 0 : order > 0;
    }),
    sort,
  );
}

export function libraryEmptyState(filters: {
  search: string;
  equipment: string[];
  muscle: string[];
  favourites: boolean;
  archived: boolean;
}) {
  if (
    filters.search.trim() ||
    filters.equipment.length ||
    filters.muscle.length
  )
    return {
      title: "No matching exercises",
      description: filters.archived
        ? "Try another name or clear the filters to see hidden and archived exercises."
        : "Try another name or clear the filters.",
    };
  if (filters.archived)
    return filters.favourites
      ? {
          title: "No hidden favourites",
          description:
            "None of your favourite exercises are hidden or archived. Turn off Favourites to see all hidden and archived exercises.",
        }
      : {
          title: "No hidden or archived exercises",
          description:
            "Exercises you hide or archive appear here. Turn off Hidden to return to your active library.",
        };
  if (filters.favourites)
    return {
      title: "No favourite exercises yet",
      description:
        "Use the star on an exercise to keep it here for quick access.",
    };
  return {
    title: "No exercises yet",
    description: "Create an exercise to start building your library.",
  };
}
