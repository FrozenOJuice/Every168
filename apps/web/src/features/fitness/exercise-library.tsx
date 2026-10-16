"use client";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Plus } from "lucide-react";
import {
  type Exercise,
  type ExerciseLibraryQuery,
  type ExerciseSort,
} from "@168hours/contracts";
import { api } from "@/lib/api";
import { ErrorState, Loading } from "@/components/ui/feedback";
import { ExerciseMuscleTags } from "./exercise-muscle-tags";
import { ExerciseLibraryControls } from "./exercise-library-controls";
import { ExerciseLibraryCard } from "./exercise-library-card";
import { ExerciseDetails, ExerciseEditor } from "./exercise-details";
import {
  libraryExercises,
  filterLibrary,
  sortLibrary,
} from "./exercise-library-model";
export function ExerciseLibrary({
  onChoose,
  mainContent,
  exerciseDetail,
  resetKey,
  onEditorOpen,
  onEditorClose,
}: {
  onChoose?: (exercise: Exercise) => void;
  mainContent?: ReactNode;
  exerciseDetail?: ReactNode;
  resetKey?: string;
  onEditorOpen: () => void;
  onEditorClose: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const gridScroll = useRef(0);
  const pageScroll = useRef(0);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const cache = useQueryClient();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ExerciseSort>("name_asc");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [muscle, setMuscle] = useState<string[]>([]);
  const [favourites, setFavourites] = useState(false);
  const [archived, setArchived] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const catalog = useQuery({
    queryKey: ["fitness", "catalog"],
    queryFn: api.getExerciseCatalog,
  });
  const custom = useInfiniteQuery({
    queryKey: [
      "fitness",
      "exercises",
      search,
      archived,
      favourites,
      equipment,
      muscle,
      sort,
    ],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.getExercises({
        sort,
        search,
        equipment: (equipment.length
          ? equipment
          : undefined) as ExerciseLibraryQuery["equipment"],
        muscle: (muscle.length
          ? muscle
          : undefined) as ExerciseLibraryQuery["muscle"],
        favourites: favourites ? "true" : undefined,
        archived: archived ? "true" : "false",
        cursor: pageParam,
      }),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const rows = libraryExercises(
    catalog.data ?? [],
    custom.data?.pages.flatMap((p) => p.items) ?? [],
  );
  const filtered = sortLibrary(
    filterLibrary(rows, {
      search,
      equipment,
      muscle,
      archived,
      favourites,
    }),
    sort,
  );
  const item = rows.find((row) => row.key === selected);
  const close = () => {
    setSelected(null);
    requestAnimationFrame(() => {
      const target = opener.current?.isConnected
        ? opener.current
        : root.current?.querySelector<HTMLInputElement>(
            '.fitness-exercise-panel input[type="search"]',
          );
      target?.focus({
        preventScroll: true,
      });
      if (grid.current) grid.current.scrollTop = gridScroll.current;
      if (window.matchMedia("(max-width: 1000px)").matches)
        window.scrollTo(0, pageScroll.current);
    });
  };
  const clearFilters = () => {
    setSearch("");
    setEquipment([]);
    setMuscle([]);
    setArchived(false);
    setFavourites(false);
  };
  const captureScroll = () => {
    if (grid.current?.getClientRects().length)
      gridScroll.current = grid.current.scrollTop;
    pageScroll.current = window.scrollY;
  };
  const [lastContext, setLastContext] = useState(resetKey);
  const choosing = !!onChoose;
  const [wasChoosing, setWasChoosing] = useState(choosing);
  if (lastContext !== resetKey) {
    setLastContext(resetKey);
    setSelected(null);
    setCreating(false);
    setEditingExercise(null);
  }
  if (wasChoosing !== choosing) {
    setWasChoosing(choosing);
    if (choosing) setArchived(false);
  }
  const externalHelp = !!exerciseDetail;
  const [hadExternalHelp, setHadExternalHelp] = useState(externalHelp);
  if (hadExternalHelp !== externalHelp) {
    setHadExternalHelp(externalHelp);
    if (externalHelp) {
      setSelected(null);
      setCreating(false);
      setEditingExercise(null);
    }
  }
  const closeEditor = () => {
    setCreating(false);
    setEditingExercise(null);
    onEditorClose();
    requestAnimationFrame(() => {
      const target =
        opener.current?.isConnected && opener.current.getClientRects().length
          ? opener.current
          : root.current?.querySelector<HTMLElement>(
              ".fitness-library-focus .fitness-inspector",
            );
      target?.focus({ preventScroll: true });
      if (window.matchMedia("(max-width: 1000px)").matches)
        window.scrollTo(0, pageScroll.current);
    });
  };
  const editor =
    creating || editingExercise ? (
      <section
        className="fitness-inspector"
        aria-label={creating ? "Create exercise" : "Edit exercise"}
      >
        <ExerciseEditor
          key={editingExercise?.id ?? "new"}
          item={editingExercise ?? undefined}
          onCancel={closeEditor}
          onSaved={(exercise) => {
            void cache.invalidateQueries({
              queryKey: ["fitness", "exercises"],
            });
            void cache.invalidateQueries({ queryKey: ["fitness", "catalog"] });
            if (creating) {
              clearFilters();
              onChoose?.(exercise);
            }
            setCreating(false);
            setEditingExercise(null);
            setSelected(exercise.id);
            onEditorClose();
          }}
        />
      </section>
    ) : null;
  const details =
    exerciseDetail ??
    (item ? (
      <ExerciseDetails
        key={item.key}
        item={item}
        onClose={close}
        onChoose={onChoose}
        workoutContext={!!editor}
        onEdit={(exercise) => {
          opener.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
          captureScroll();
          setCreating(false);
          setEditingExercise(exercise);
          onEditorOpen();
        }}
        onDuplicated={(exercise) => {
          captureScroll();
          setSearch("");
          setEquipment([]);
          setMuscle([]);
          setArchived(false);
          setFavourites(false);
          setCreating(false);
          setSelected(exercise.id);
          setEditingExercise(exercise);
          onEditorOpen();
        }}
      />
    ) : null);
  const showingDetails = !!details;
  useLayoutEffect(() => {
    if (!showingDetails && grid.current)
      grid.current.scrollTop = gridScroll.current;
  }, [showingDetails]);
  return (
    <div
      ref={root}
      className={`fitness-library${editor ? " has-editor" : ""}${details ? " has-detail" : ""}`}
    >
      <div className="fitness-library-layout">
        <div className="fitness-primary-pane">
          <div className="fitness-primary-content" hidden={!!editor}>
            {mainContent}
          </div>
          <div className="fitness-primary-editor" hidden={!editor}>
            {editor}
          </div>
        </div>
        <aside
          className="fitness-exercise-panel"
          aria-label="Exercise library panel"
        >
          <section
            hidden={!!details}
            className="fitness-library-main"
            aria-labelledby={
              onChoose ? "fitness-picker-heading" : "fitness-library-heading"
            }
          >
            <div className="fitness-section-heading">
              <div>
                <h2
                  id={
                    onChoose
                      ? "fitness-picker-heading"
                      : "fitness-library-heading"
                  }
                >
                  Exercise library
                </h2>
              </div>
              <button
                type="button"
                className="fitness-text-action"
                onClick={(e) => {
                  opener.current = e.currentTarget;
                  captureScroll();
                  setCreating(true);
                  setEditingExercise(null);
                  onEditorOpen();
                }}
              >
                <Plus size={16} aria-hidden="true" />
                Create exercise
              </button>
            </div>
            <ExerciseLibraryControls
              resultCount={filtered.length}
              hasMore={!!custom.hasNextPage}
              sort={sort}
              onSort={setSort}
              search={search}
              equipment={equipment}
              muscle={muscle}
              favourites={favourites}
              archived={archived}
              allowArchived={!onChoose}
              onSearch={(value) => {
                setSearch(value);
                setSelected(null);
              }}
              onClear={clearFilters}
              onEquipment={setEquipment}
              onMuscle={setMuscle}
              onFavourites={setFavourites}
              onArchived={(value) => {
                setArchived(value);
                setSelected(null);
              }}
            />
            {catalog.isPending || custom.isPending ? (
              <Loading />
            ) : catalog.error || custom.error ? (
              <ErrorState
                error={(catalog.error ?? custom.error)!}
                retry={() => {
                  void catalog.refetch();
                  void custom.refetch();
                }}
              />
            ) : (
              <div
                ref={grid}
                className="fitness-exercise-grid"
                onScroll={(event) => {
                  if (!showingDetails)
                    gridScroll.current = event.currentTarget.scrollTop;
                }}
              >
                {filtered.map((exercise) => (
                  <ExerciseLibraryCard
                    key={exercise.key}
                    item={exercise}
                    selected={item?.key === exercise.key}
                    onChoose={onChoose}
                    onDetails={(target) => {
                      opener.current = target;
                      captureScroll();
                      setSelected(exercise.key);
                    }}
                  >
                    <span
                      className="fitness-library-card-meta"
                      title={
                        exercise.equipment.join(", ") ||
                        "No equipment specified"
                      }
                    >
                      {exercise.equipment.join(", ") ||
                        "No equipment specified"}
                    </span>
                    <ExerciseMuscleTags muscles={exercise.muscles} />
                  </ExerciseLibraryCard>
                ))}
              </div>
            )}
            {!catalog.isPending &&
              !custom.isPending &&
              !catalog.error &&
              !custom.error &&
              !filtered.length && (
                <div className="fitness-quiet-empty">
                  <h3>No matching exercises</h3>
                  <p>Try another name or clear the filters.</p>
                </div>
              )}
            {custom.hasNextPage && (
              <button
                type="button"
                className="fitness-text-action"
                disabled={custom.isFetchingNextPage}
                onClick={() => void custom.fetchNextPage()}
              >
                More of your exercises
              </button>
            )}
          </section>
          <div className="fitness-library-focus" hidden={!details}>
            {details}
          </div>
        </aside>
      </div>
    </div>
  );
}
