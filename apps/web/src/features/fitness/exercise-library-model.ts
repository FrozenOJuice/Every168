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
  const nameOrder = new Intl.Collator("en", { sensitivity: "base" });
  const compareName = (a: LibraryExercise, b: LibraryExercise) =>
    nameOrder.compare(a.name, b.name) || a.key.localeCompare(b.key);
  const addedAt = (row: LibraryExercise) =>
    row.definition
      ? 0
      : Date.parse(row.exercise?.createdAt ?? "1970-01-01T00:00:00Z");
  return [...rows].sort((a, b) =>
    sort === "recent"
      ? addedAt(b) - addedAt(a) || compareName(a, b)
      : (sort === "name_asc" ? 1 : -1) * compareName(a, b),
  );
}
