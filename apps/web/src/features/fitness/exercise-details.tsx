"use client";
import { ContextMenu } from "@/components/ui/context-menu";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { FitnessConfirm } from "./fitness-confirm";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import { type Exercise, type ExerciseLoggingType } from "@168hours/contracts";
import { api } from "@/lib/api";
import { useCommand, CommandError } from "@/lib/use-command";
import { ExerciseFavourite } from "./exercise-favourite";
import { ExerciseVisual } from "./exercise-visual";
import { type LibraryExercise } from "./exercise-library-model";
import { ExerciseProgressPage } from "./exercise-progress";
import { ExerciseRecall } from "./exercise-recall";
import { ExerciseAddToWorkout } from "./exercise-add-to-workout";
export function ExerciseDetails({
  item,
  onChoose,
  onClose,
  onDuplicated,
  onEdit,
  workoutContext = false,
  backLabel = "Back to exercises",
  hideBack = false,
  initialHistory = false,
  initialMode,
  standalone = false,
}: {
  item: LibraryExercise;
  onChoose?: (exercise: Exercise) => void;
  onClose: () => void;
  onDuplicated: (exercise: Exercise) => void;
  onEdit?: (exercise: Exercise) => void;
  workoutContext?: boolean;
  backLabel?: string;
  hideBack?: boolean;
  initialHistory?: boolean;
  initialMode?: ExerciseLoggingType;
  standalone?: boolean;
}) {
  const SectionHeading = standalone ? "h2" : "h3";
  const [deleting, setDeleting] = useState(false);
  const [actionsMenu, setActionsMenu] = useState<{
    anchor: HTMLElement;
    x: number;
    y: number;
  } | null>(null);
  const closeActions = useCallback(() => setActionsMenu(null), []);
  const [history, setHistory] = useState(initialHistory);
  const cache = useQueryClient();
  const panel = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    panel.current?.focus({
      preventScroll: !window.matchMedia("(max-width: 1000px)").matches,
    });
  }, []);
  const refresh = () => {
    void cache.invalidateQueries({ queryKey: ["fitness", "exercises"] });
    void cache.invalidateQueries({ queryKey: ["fitness", "catalog"] });
    void cache.invalidateQueries({ queryKey: ["fitness", "exercise"] });
  };
  const choose = useCommand({
    mutationFn: (_: void, key: string) =>
      item.definition
        ? api.useCatalogExercise(item.definition.key, key)
        : Promise.resolve(item.exercise!),
    onSuccess: (exercise) => {
      refresh();
      onChoose?.(exercise);
    },
  });
  const edit = useCommand({
    mutationFn: (_: void, key: string) =>
      item.exercise
        ? Promise.resolve(item.exercise)
        : api.useCatalogExercise(item.definition!.key, key),
    onSuccess: (exercise) => {
      refresh();
      onEdit?.(exercise);
    },
  });
  const archive = useCommand({
    mutationFn: async ({ importKey }: { importKey: string }, key: string) => {
      const exercise =
        item.exercise ??
        (await api.useCatalogExercise(item.definition!.key, importKey));
      return item.definition
        ? api.hideExercise(exercise.id, !exercise.hidden, exercise.version, key)
        : exercise.archivedAt
          ? api.restoreExercise(exercise.id, exercise.version, key)
          : api.archiveExercise(exercise.id, exercise.version, key);
    },
    onSuccess: refresh,
  });
  const duplicate = useCommand({
    mutationFn: (_: void, key: string) =>
      api.duplicateExercise(
        item.definition
          ? { catalogKey: item.definition.key }
          : { exerciseId: item.exercise!.id, version: item.exercise!.version },
        key,
      ),
    onSuccess: (exercise) => {
      refresh();
      onDuplicated(exercise);
    },
  });
  const remove = useCommand({
    mutationFn: (_: void, key: string) =>
      api.deleteExercise(item.exercise!.id, item.exercise!.version, key),
    onSuccess: () => {
      refresh();
      onClose();
    },
  });
  const busy =
    choose.isPending ||
    edit.isPending ||
    archive.isPending ||
    duplicate.isPending ||
    remove.isPending;
  return (
    <section
      className={`fitness-inspector${standalone ? " fitness-exercise-detail-page" : ""}`}
      aria-label={`${item.name} details`}
      tabIndex={-1}
      ref={panel}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !busy) {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      {!hideBack && (
        <button
          className="fitness-text-action"
          onClick={onClose}
          disabled={busy}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {backLabel}
        </button>
      )}
      <>
        <div className="fitness-exercise-detail-heading">
          <div>
            {standalone ? <h1>{item.name}</h1> : <h2>{item.name}</h2>}
            {!item.definition && (
              <span className="fitness-custom-badge">Custom</span>
            )}
          </div>
          <div className="fitness-exercise-detail-actions">
            <ExerciseFavourite item={item} iconOnly />
            {!workoutContext && (
              <TooltipButton
                type="button"
                className="icon-button"
                tooltip="Exercise actions"
                aria-label="Exercise actions"
                aria-haspopup="menu"
                aria-expanded={!!actionsMenu}
                disabled={busy}
                onClick={(event) => {
                  const anchor = event.currentTarget;
                  const rect = anchor.getBoundingClientRect();
                  setActionsMenu({ anchor, x: rect.right, y: rect.bottom + 4 });
                }}
              >
                <MoreHorizontal size={18} aria-hidden="true" />
              </TooltipButton>
            )}
          </div>
        </div>
        {!standalone && (
          <div
            className="fitness-detail-tabs"
            role="group"
            aria-label="Exercise information"
          >
            <button
              type="button"
              aria-pressed={!history}
              onClick={() => setHistory(false)}
            >
              Details
            </button>
            <button
              type="button"
              aria-pressed={history}
              onClick={() => setHistory(true)}
            >
              History
            </button>
          </div>
        )}
        {history && !standalone ? (
          item.exercise ? (
            <ExerciseProgressPage
              id={item.exercise.id}
              initialMode={initialMode}
              embedded
            />
          ) : (
            <p>No finished sessions for this exercise yet.</p>
          )
        ) : (
          <>
            <div className="fitness-exercise-overview">
              <ExerciseVisual large />
              <div className="fitness-exercise-facts">
                {!!item.exercise?.intentTags.length && (
                  <p className="muted text-small">
                    Default intent: {item.exercise.intentTags.join(", ")}
                  </p>
                )}
                <div className="fitness-exercise-equipment">
                  <SectionHeading>Equipment</SectionHeading>
                  <ul>
                    {(item.equipment.length
                      ? item.equipment
                      : ["Not specified"]
                    ).map((equipment) => (
                      <li key={equipment}>{equipment}</li>
                    ))}
                  </ul>
                </div>
                {item.muscles.length > 0 && (
                  <div>
                    <SectionHeading>Muscles worked</SectionHeading>
                    <div
                      className="fitness-muscle-tags"
                      aria-label="Muscles worked"
                    >
                      {item.muscles.map((muscle) => (
                        <span key={muscle}>{muscle}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="fitness-exercise-instructions">
              <SectionHeading>How it works</SectionHeading>
              <p>{item.notes || "No instructions added yet."}</p>
            </div>
            {!standalone && item.exercise && (
              <ExerciseRecall
                id={item.exercise.id}
                mode={initialMode ?? item.exercise.loggingType}
                onHistory={() => setHistory(true)}
              />
            )}
            {item.definition && item.exercise?.hidden && (
              <p className="text-small">
                Hidden from your library. Existing workouts and history are
                unchanged.
              </p>
            )}
            {item.exercise?.archivedAt && (
              <p className="text-small">
                Archived. Restore it to use it in a workout.
              </p>
            )}
            {onChoose ? (
              <button
                className="button primary"
                disabled={busy || !!item.exercise?.archivedAt}
                onClick={() => choose.mutate()}
              >
                Add {item.name}
              </button>
            ) : (
              !workoutContext &&
              !item.exercise?.archivedAt && <ExerciseAddToWorkout item={item} />
            )}
            <CommandError command={choose} />
            <CommandError command={edit} />
            <CommandError command={archive} />
            <CommandError command={duplicate} />
            {!deleting && <CommandError command={remove} />}
            {standalone && (
              <section
                className="fitness-exercise-personal-history"
                aria-label="Your history"
              >
                <h2>Your history</h2>
                {item.exercise ? (
                  <ExerciseProgressPage
                    id={item.exercise.id}
                    initialMode={initialMode}
                    embedded
                  />
                ) : (
                  <p className="muted">
                    No finished sessions for this exercise yet.
                  </p>
                )}
              </section>
            )}
          </>
        )}
      </>
      {actionsMenu && (
        <ContextMenu
          {...actionsMenu}
          label="Exercise actions"
          portalContainer={actionsMenu.anchor.closest("main") ?? undefined}
          onClose={closeActions}
          actions={[
            ...(!item.definition && onEdit
              ? [
                  {
                    label: "Edit exercise",
                    disabled: busy,
                    run: () => edit.mutate(),
                  },
                ]
              : []),
            {
              label: "Duplicate exercise",
              disabled: busy,
              run: () => duplicate.mutate(),
            },
            {
              label: item.definition
                ? item.exercise?.hidden
                  ? "Show in library"
                  : "Hide from library"
                : item.exercise?.archivedAt
                  ? "Restore exercise"
                  : "Archive exercise",
              disabled: busy,
              run: () => archive.mutate({ importKey: crypto.randomUUID() }),
            },
            ...(!item.definition && item.exercise?.canDelete
              ? [
                  { separator: true as const },
                  {
                    label: "Delete exercise",
                    disabled: busy,
                    destructive: true,
                    run: () => setDeleting(true),
                  },
                ]
              : []),
          ]}
        />
      )}
      {deleting && (
        <FitnessConfirm
          title="Delete exercise?"
          description="This permanently removes the unused custom exercise."
          action="Delete exercise"
          cancel="Cancel"
          danger
          busy={busy}
          onCancel={() => setDeleting(false)}
          onConfirm={() => remove.mutate()}
        >
          <CommandError command={remove} />
        </FitnessConfirm>
      )}
    </section>
  );
}
