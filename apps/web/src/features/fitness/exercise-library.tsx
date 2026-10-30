"use client";
import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ArrowLeft, Plus } from "lucide-react";
import { Toast, useToast } from "@/components/ui/toast";
import { useRecoverExerciseEditor } from "./exercise-editor-recovery";
import { useFitnessNavigation } from "./fitness-navigation";
import type { LibraryFilters } from "./fitness-navigation-state";
import { useFitnessExercisePanel } from "./fitness-exercise-workspace";
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
import { ExerciseDetails } from "./exercise-details";
import { ExerciseEditor } from "./exercise-editor";
import {
  libraryExercises,
  filterLibrary,
  libraryWindow,
  libraryEmptyState,
} from "./exercise-library-model";
export function ExerciseLibrary({
  view = "workout",
  onChoose,
  mainContent,
  detailContent,
  resetKey,
  filterContext,
  onEditorOpen,
  onEditorClose,
  workoutLabel = "Your workout",
  pickerOpen = false,
  onDismissPicker,
  onShowPicker,
  editorNavigationRef,
}: {
  view?: "library" | "workout" | "content" | "builder";
  onChoose?: (exercise: Exercise) => boolean | void;
  mainContent?: ReactNode;
  detailContent?: ReactNode;
  resetKey?: string;
  filterContext?: string;
  onEditorOpen: () => void;
  onEditorClose?: () => void;
  workoutLabel?: string;
  pickerOpen?: boolean;
  onDismissPicker?: () => void;
  onShowPicker?: () => void;
  editorNavigationRef?: Ref<HTMLDivElement>;
}) {
  const navigation = useFitnessNavigation();
  const workspace = useFitnessExercisePanel();
  const savedFilters: LibraryFilters = navigation.filters(filterContext) ?? {
    search: "",
    sort: "name_asc",
    equipment: [],
    muscle: [],
    favourites: false,
    archived: false,
  };
  const { pages: savedPages = 1, ...savedFilterFields } = savedFilters;
  const [restoredWindow, setRestoredWindow] = useState(() => ({
    filters: JSON.stringify(savedFilterFields),
    pages: savedPages,
  }));
  const returnToLibrary = useRef(false);
  const returnExerciseName = useRef("");
  const root = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const panelScroll = useRef(0);
  const gridScroll = useRef(0);
  const pageScroll = useRef(0);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const toast = useToast();
  const cache = useQueryClient();
  const [search, setSearch] = useState(savedFilters?.search ?? "");
  const [sort, setSort] = useState<ExerciseSort>(
    savedFilters?.sort ?? "name_asc",
  );
  const [equipment, setEquipment] = useState<string[]>(
    savedFilters?.equipment ?? [],
  );
  const [muscle, setMuscle] = useState<string[]>(savedFilters?.muscle ?? []);
  const [favourites, setFavourites] = useState(
    savedFilters?.favourites ?? false,
  );
  const [archived, setArchived] = useState(savedFilters?.archived ?? false);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  useRecoverExerciseEditor((attempt) => {
    if (view === "content") return;
    setEditingExercise(attempt.item ?? null);
    setCreating(!attempt.item);
    onEditorOpen();
  });

  const opener = useRef<HTMLElement | null>(null);
  const browsing =
    view === "library" ||
    view === "builder" ||
    (view === "workout" && pickerOpen);
  const catalog = useQuery({
    enabled: browsing,
    queryKey: ["fitness", "catalog"],
    queryFn: api.getExerciseCatalog,
  });
  const custom = useInfiniteQuery({
    enabled: browsing,
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
  const fetched = custom.data?.pages.flatMap((p) => p.items) ?? [];
  const initialReadError =
    (catalog.error && !catalog.data ? catalog.error : null) ??
    (custom.error && !custom.data ? custom.error : null);
  const refreshError =
    !initialReadError && !custom.isFetchNextPageError
      ? (catalog.error ?? custom.error)
      : null;
  const rows = libraryExercises(catalog.data ?? [], fetched);
  const emptyState = libraryEmptyState({
    search,
    equipment,
    muscle,
    favourites,
    archived,
  });
  const filtered = libraryWindow(
    filterLibrary(rows, {
      search,
      equipment,
      muscle,
      archived,
      favourites,
    }),
    fetched,
    sort,
    !!custom.hasNextPage,
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
  const [lastFilterContext, setLastFilterContext] = useState(filterContext);
  if (lastFilterContext !== filterContext) {
    setLastFilterContext(filterContext);
    setRestoredWindow({
      filters: JSON.stringify(savedFilterFields),
      pages: savedPages,
    });
    setSearch(savedFilters?.search ?? "");
    setEquipment(savedFilters?.equipment ?? []);
    setMuscle(savedFilters?.muscle ?? []);
    setFavourites(savedFilters?.favourites ?? false);
    setArchived(savedFilters?.archived ?? false);
    setSort(savedFilters?.sort ?? "name_asc");
  }
  const filterSignature = JSON.stringify({
    search,
    sort,
    equipment,
    muscle,
    favourites,
    archived,
  });
  const requestedPages =
    restoredWindow.filters === filterSignature ? restoredWindow.pages : 1;
  const {
    data: libraryData,
    isFetching: libraryFetching,
    error: libraryError,
    hasNextPage: libraryHasMore,
    fetchNextPage: fetchLibraryPage,
  } = custom;
  const loadedPages = libraryData?.pages.length ?? 1;
  useLayoutEffect(() => {
    if (
      browsing &&
      libraryData &&
      !libraryFetching &&
      !libraryError &&
      libraryHasMore &&
      loadedPages < requestedPages
    )
      void fetchLibraryPage();
  }, [
    browsing,
    libraryData,
    libraryFetching,
    libraryError,
    libraryHasMore,
    loadedPages,
    requestedPages,
    fetchLibraryPage,
  ]);
  const { setFilters } = navigation;
  useLayoutEffect(() => {
    setFilters(filterContext, {
      search,
      sort,
      equipment,
      muscle,
      favourites,
      archived,
      pages: Math.max(loadedPages, requestedPages),
    });
  }, [
    setFilters,
    loadedPages,
    requestedPages,
    filterContext,
    search,
    sort,
    equipment,
    muscle,
    favourites,
    archived,
  ]);
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
  const closeEditor = () => {
    setCreating(false);
    setEditingExercise(null);
    onEditorClose?.();
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
          addToWorkout={creating && !!onChoose}
          onCancel={closeEditor}
          onSaved={(exercise) => {
            void cache.invalidateQueries({
              queryKey: ["fitness", "exercises"],
            });
            void cache.invalidateQueries({ queryKey: ["fitness", "catalog"] });
            if (creating) {
              clearFilters();
              const accepted = onChoose?.(exercise);
              toast.show({
                kind: accepted === false ? "info" : "success",
                message: onChoose
                  ? accepted === false
                    ? "Exercise created, but it couldn’t be added to the workout."
                    : "Created and added to workout."
                  : "Exercise created.",
              });
            } else
              toast.show({ kind: "success", message: "Exercise updated." });
            setCreating(false);
            setEditingExercise(null);
            setSelected(exercise.id);
            onEditorClose?.();
          }}
        />
      </section>
    ) : null;
  const details =
    detailContent ??
    (item ? (
      <ExerciseDetails
        key={item.key}
        item={item}
        onClose={
          view === "builder" || view === "workout"
            ? () => {
                setSelected(null);
                onDismissPicker?.();
              }
            : close
        }
        backLabel={
          view === "builder" || view === "workout"
            ? "Back to workout"
            : "Back to Exercises"
        }
        onChoose={
          onChoose
            ? (exercise) => {
                const accepted = onChoose(exercise);
                if (accepted !== false) setSelected(null);
              }
            : undefined
        }
        workoutContext={view === "builder" || view === "workout" || !!editor}
        standalone={view !== "builder"}
        reference={view === "builder"}
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
          setEditingExercise(null);
          onEditorClose?.();
        }}
      />
    ) : null);
  const showingDetails = !!details;
  useLayoutEffect(() => {
    if (panel.current) {
      if (showingDetails) {
        panelScroll.current = panel.current.scrollTop;
        panel.current.scrollTop = 0;
      } else panel.current.scrollTop = panelScroll.current;
    }
    if (!showingDetails && grid.current)
      grid.current.scrollTop = gridScroll.current;
  }, [showingDetails]);
  useLayoutEffect(() => {
    if (!pickerOpen || showingDetails) return;
    const frame = requestAnimationFrame(() =>
      root.current
        ?.querySelector<HTMLInputElement>(
          '.fitness-exercise-panel input[type="search"]',
        )
        ?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [pickerOpen, showingDetails]);
  useLayoutEffect(() => {
    if (view !== "library" || !returnToLibrary.current) return;
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: pageScroll.current });
      const target = Array.from(
        root.current?.querySelectorAll<HTMLButtonElement>(
          ".fitness-library-card",
        ) ?? [],
      ).find(
        (button) =>
          button.getAttribute("aria-label") === returnExerciseName.current,
      );
      target?.focus({ preventScroll: true });
      returnToLibrary.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [view]);
  const exercisePanel = (
    <aside
      ref={panel}
      id="exercises"
      tabIndex={-1}
      className="fitness-exercise-panel"
      aria-label="Exercise library panel"
      hidden={!!editor}
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
                onChoose ? "fitness-picker-heading" : "fitness-library-heading"
              }
            >
              {onChoose ? "Choose an exercise" : "Exercise library"}
            </h2>
          </div>
          <button
            type="button"
            className={`button${view === "library" ? " primary" : ""}`}
            disabled={!!editor}
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
        {archived && (
          <p className="muted text-small">
            Showing hidden built-ins and archived custom exercises. Turn off
            Hidden to return to your active library.
          </p>
        )}
        {catalog.isPending || custom.isPending ? (
          <Loading />
        ) : initialReadError ? (
          <ErrorState
            error={initialReadError}
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
                  if (view === "library") {
                    returnToLibrary.current = true;
                    returnExerciseName.current = exercise.name;
                    navigation.openExercise({
                      id: exercise.exercise?.id,
                      catalogKey: exercise.definition?.key,
                      href: exercise.definition
                        ? `/fitness/exercises/catalog/${encodeURIComponent(exercise.definition.key)}`
                        : `/fitness/exercises/${exercise.exercise!.id}`,
                      inline: false,
                    });
                    return;
                  }
                  if (exercise.exercise)
                    workspace.help(
                      exercise.exercise.id,
                      false,
                      undefined,
                      true,
                    );
                  else setSelected(exercise.key);
                }}
              >
                <span
                  className="fitness-library-card-meta"
                  title={
                    exercise.equipment.join(", ") || "No equipment specified"
                  }
                >
                  {exercise.equipment.join(", ") || "No equipment specified"}
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
          !filtered.length &&
          !custom.hasNextPage && (
            <div className="fitness-quiet-empty">
              <h3>{emptyState.title}</h3>
              <p>{emptyState.description}</p>
            </div>
          )}
        {refreshError && (
          <ErrorState
            error={refreshError}
            retry={() => {
              void catalog.refetch();
              void custom.refetch();
            }}
          />
        )}
        {custom.isFetchNextPageError && (
          <div className="fitness-library-load-error" role="alert">
            <p className="error">Couldn’t load more exercises.</p>
            <button
              type="button"
              className="button"
              disabled={custom.isFetchingNextPage}
              onClick={() => void custom.fetchNextPage()}
            >
              {custom.isFetchingNextPage
                ? "Loading exercises…"
                : "Retry loading exercises"}
            </button>
          </div>
        )}
        {custom.hasNextPage &&
          !custom.isFetchNextPageError &&
          !initialReadError && (
            <button
              type="button"
              className="fitness-text-action"
              disabled={custom.isFetchingNextPage}
              onClick={() => void custom.fetchNextPage()}
            >
              {custom.isFetchingNextPage
                ? "Loading exercises…"
                : "Show more exercises"}
            </button>
          )}
      </section>
      <div className="fitness-library-focus" hidden={!details}>
        {details}
      </div>
    </aside>
  );
  return (
    <div
      ref={root}
      data-picker-open={pickerOpen}
      className={`fitness-library fitness-library-view-${view}${editor ? " has-editor" : ""}${details ? " has-detail" : ""}`}
    >
      {view === "builder" && !editor && !details && (
        <div
          ref={editorNavigationRef}
          className="fitness-creation-mobile-navigation"
        />
      )}
      {view === "builder" && !editor && !details && (
        <div
          className="fitness-creation-mobile-tabs"
          role="group"
          aria-label="Workout creation view"
        >
          <button
            type="button"
            aria-pressed={!pickerOpen}
            onClick={onDismissPicker}
          >
            {workoutLabel}
          </button>
          <button
            type="button"
            aria-pressed={pickerOpen}
            onClick={onShowPicker}
          >
            {detailContent ? "Exercise details" : "Add exercises"}
          </button>
        </div>
      )}
      {toast.notice && (
        <Toast
          key={toast.notice.id}
          {...toast.notice}
          onDismiss={() => toast.dismiss()}
          durationMs={5000}
        />
      )}
      <div className="fitness-library-layout">
        <div
          className="fitness-primary-pane"
          hidden={view === "workout" && pickerOpen && !editor}
        >
          <div
            className="fitness-primary-content"
            hidden={!!editor || (view === "workout" && pickerOpen)}
          >
            {mainContent}
          </div>
          <div className="fitness-primary-editor" hidden={!editor}>
            {editor}
          </div>
        </div>
        {(view === "library" ||
          view === "builder" ||
          (view === "workout" && pickerOpen)) && (
          <>
            {view === "workout" && !editor && !detailContent && (
              <button
                type="button"
                className="fitness-back"
                onClick={onDismissPicker}
              >
                <ArrowLeft size={16} aria-hidden="true" /> Back to workout
              </button>
            )}
            {exercisePanel}
          </>
        )}
      </div>
    </div>
  );
}
