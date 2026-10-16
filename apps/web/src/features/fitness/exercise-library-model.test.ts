import { expect, it } from "vitest";
import { exerciseSchema, exerciseCatalogSchema } from "@168hours/contracts";
import {
  libraryExercises,
  filterLibrary,
  sortLibrary,
} from "./exercise-library-model";
const row = exerciseSchema.parse({
  id: "00000000-0000-4000-8000-000000000001",
  version: 1,
  createdAt: "2026-10-14T15:00:00Z",
  updatedAt: "2026-10-14T15:00:00Z",
  name: "My bench",
  notes: "Custom notes",
  archivedAt: null,
  catalogKey: "bench",
  favourite: false,
  source: "system",
  hidden: false,
  canDelete: false,
  equipment: ["Barbell"],
  muscles: ["Chest", "Arms"],
});
it("keeps curated definitions immutable, merges references once and filters custom metadata", () => {
  const catalog = exerciseCatalogSchema.parse([
    {
      key: "bench",
      name: "Bench press",
      notes: "Original instructions",
      equipment: "Barbell",
      muscles: ["Chest", "Arms"],
      loggingType: "reps_load",
      exercise: row,
    },
  ]);
  const custom = {
    ...row,
    id: "00000000-0000-4000-8000-000000000002",
    catalogKey: null,
    name: "My movement",
    equipment: [],
    muscles: [],
  };
  const rows = libraryExercises(catalog, [row, custom]);
  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({
    name: "Bench press",
    notes: "Original instructions",
  });
  const filters = {
    search: "BENCH PRESS",
    equipment: ["Barbell"],
    muscle: ["Chest"],
    archived: false,
  };
  expect(filterLibrary(rows, filters)).toHaveLength(1);
  expect(
    filterLibrary(rows, { ...filters, search: "", muscle: ["Legs"] }),
  ).toHaveLength(0);
  expect(
    filterLibrary(rows, { ...filters, search: "", equipment: [], muscle: [] }),
  ).toHaveLength(2);
  rows[0]!.exercise = { ...row, hidden: true };
  expect(filterLibrary(rows, filters)).toHaveLength(0);
  expect(filterLibrary(rows, { ...filters, archived: true })).toHaveLength(1);
});

it("favourites filter is independent of archive state", () => {
  const rows = libraryExercises(
    [],
    [
      { ...row, catalogKey: null, favourite: true },
      { ...row, id: "00000000-0000-4000-8000-000000000003", catalogKey: null },
    ],
  );
  const filters = {
    search: "",
    equipment: [],
    muscle: [],
    archived: false,
    favourites: true,
  };
  expect(filterLibrary(rows, filters)).toHaveLength(1);
  rows[0]!.exercise = {
    ...rows[0]!.exercise!,
    archivedAt: "2026-10-14T16:00:00Z",
  };
  expect(filterLibrary(rows, filters)).toHaveLength(0);
  expect(filterLibrary(rows, { ...filters, archived: true })).toHaveLength(1);
});

it("custom metadata participates in library filters", () => {
  const rows = libraryExercises(
    [],
    [
      {
        ...row,
        catalogKey: null,
        equipment: ["Dumbbells", "Bench"],
        muscles: ["Back"],
      },
    ],
  );
  const filters = {
    search: "",
    equipment: ["Bench"],
    muscle: ["Back"],
    archived: false,
  };
  expect(filterLibrary(rows, filters)).toHaveLength(1);
  expect(filterLibrary(rows, { ...filters, muscle: ["Chest"] })).toHaveLength(
    0,
  );
});

it("catalogue defaults remain visible for an empty private copy", () => {
  const entry = exerciseCatalogSchema.parse([
    {
      key: "bench",
      name: "Bench press",
      notes: null,
      equipment: "Barbell",
      muscles: ["Chest"],
      loggingType: "reps_load",
      exercise: { ...row, equipment: [], muscles: [] },
    },
  ]);
  const merged = libraryExercises(entry, []);
  expect(merged[0]).toMatchObject({
    equipment: ["Barbell"],
    muscles: ["Chest"],
  });
  expect(
    filterLibrary(merged, {
      search: "",
      equipment: ["Barbell"],
      muscle: ["Chest"],
      archived: false,
    }),
  ).toHaveLength(1);
});

it("matches any equipment and any muscle, combining the two groups", () => {
  const rows = libraryExercises(
    [],
    [
      { ...row, catalogKey: null, equipment: ["Barbell"], muscles: ["Chest"] },
      {
        ...row,
        id: "00000000-0000-4000-8000-000000000003",
        catalogKey: null,
        equipment: ["Cable"],
        muscles: ["Back"],
      },
    ],
  );
  const filters = {
    search: "",
    archived: false,
    equipment: ["Barbell", "Cable"],
    muscle: ["Chest", "Back"],
  };
  expect(filterLibrary(rows, filters)).toHaveLength(2);
  expect(
    filterLibrary(rows, { ...filters, equipment: ["Cable"] }).map(
      (item) => item.muscles,
    ),
  ).toEqual([["Back"]]);
  expect(
    filterLibrary(rows, {
      ...filters,
      equipment: ["Cable"],
      muscle: ["Chest"],
    }),
  ).toHaveLength(0);
});

it("sorts mixed library names and keeps recent custom creation separate from built-in preferences", () => {
  const rows = libraryExercises(
    exerciseCatalogSchema.parse([
      {
        key: "bench",
        name: "Bench press",
        notes: null,
        equipment: "Barbell",
        muscles: ["Chest"],
        loggingType: "reps_load",
        exercise: row,
      },
    ]),
    [
      {
        ...row,
        id: "00000000-0000-4000-8000-000000000002",
        catalogKey: null,
        name: "Zebra",
        createdAt: "2026-10-13T00:00:00Z",
      },
      {
        ...row,
        id: "00000000-0000-4000-8000-000000000003",
        catalogKey: null,
        name: "alpha",
        createdAt: "2026-10-12T00:00:00Z",
      },
    ],
  );
  expect(sortLibrary(rows, "name_asc").map((x) => x.name)).toEqual([
    "alpha",
    "Bench press",
    "Zebra",
  ]);
  expect(sortLibrary(rows, "name_desc").map((x) => x.name)).toEqual([
    "Zebra",
    "Bench press",
    "alpha",
  ]);
  expect(sortLibrary(rows, "recent").map((x) => x.name)).toEqual([
    "Zebra",
    "alpha",
    "Bench press",
  ]);
  expect(rows.map((x) => x.name)).toEqual(["Bench press", "Zebra", "alpha"]);
});
