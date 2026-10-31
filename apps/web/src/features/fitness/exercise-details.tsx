"use client";
import { ContextMenu } from "@/components/ui/context-menu";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { FitnessConfirm } from "./fitness-confirm";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import {
  type Exercise,
  type ExerciseInput,
  type ExerciseLoggingType,
} from "@168hours/contracts";
import { ExerciseEditor } from "./exercise-editor";
import { Toast, useToast } from "@/components/ui/toast";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { api } from "@/lib/api";
import { useCommand, CommandError } from "@/lib/use-command";
import { ExerciseFavourite } from "./exercise-favourite";
import { ExerciseVisual } from "./exercise-visual";
import { type LibraryExercise } from "./exercise-library-model";
import {
  ExerciseProgressPage,
  ExerciseHistoryEmpty,
} from "./exercise-progress";
import { ExerciseAddToWorkout } from "./exercise-add-to-workout";
export function ExerciseDetails({
  item,
  onChoose,
  onClose,
  onDuplicated,
  onEdit,
  workoutContext = false,
  backLabel = "Back to Exercises",
  hideBack = false,
  initialHistory = false,
  initialMode,
  standalone = false,
  reference = false,
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
  reference?: boolean;
}) {
  const SectionHeading = standalone ? "h2" : "h3";
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [copy, setCopy] = useState<ExerciseInput | null>(null);
  const toast = useToast();
  const [actionsMenu, setActionsMenu] = useState<{
    anchor: HTMLElement;
    x: number;
    y: number;
  } | null>(null);
  const closeActions = useCallback(() => setActionsMenu(null), []);
  const cache = useQueryClient();
  const panel = useRef<HTMLElement>(null);
  const emptyHistoryEntry = initialHistory && !item.exercise;
  const historyHeading = useRef<HTMLHeadingElement>(null);
  const historyFrame = useRef<number | null>(null);
  const focusHistory = useCallback(() => {
    if (!initialHistory) return;
    if (historyFrame.current !== null)
      cancelAnimationFrame(historyFrame.current);
    historyFrame.current = requestAnimationFrame(() => {
      historyHeading.current?.focus({ preventScroll: true });
      historyHeading.current?.scrollIntoView({ block: "start" });
    });
  }, [initialHistory]);
  useLayoutEffect(() => {
    if (emptyHistoryEntry) focusHistory();
    else
      panel.current?.focus({
        preventScroll:
          initialHistory || !window.matchMedia("(max-width: 1000px)").matches,
      });
    return () => {
      if (historyFrame.current !== null)
        cancelAnimationFrame(historyFrame.current);
    };
  }, [initialHistory, emptyHistoryEntry, focusHistory]);
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
    mutationFn: async (
      {
        exercise: captured,
        value,
        importKey,
      }: { exercise?: Exercise; value: boolean; importKey: string },
      key: string,
    ) => {
      const exercise =
        captured ??
        item.exercise ??
        (await api.useCatalogExercise(item.definition!.key, importKey));
      const saved = item.definition
        ? await api.hideExercise(exercise.id, value, exercise.version, key)
        : value
          ? await api.archiveExercise(exercise.id, exercise.version, key)
          : await api.restoreExercise(exercise.id, exercise.version, key);
      return { exercise: saved, value };
    },
    onSuccess: ({ exercise, value }) => {
      cache.setQueryData(["fitness", "exercise", exercise.id], exercise);
      refresh();
      toast.show({
        kind: "success",
        message: item.definition
          ? value
            ? `${item.name} hidden from library.`
            : `${item.name} shown in library.`
          : value
            ? `${item.name} archived.`
            : `${item.name} restored.`,
        action: {
          label: "Undo",
          onClick: () =>
            archive.mutate({
              exercise,
              value: !value,
              importKey: crypto.randomUUID(),
            }),
        },
      });
    },
  });
  const remove = useCommand({
    mutationFn: (_: void, key: string) =>
      api.deleteExercise(item.exercise!.id, item.exercise!.version, key),
    onSuccess: () => {
      refresh();
      setDeleted(true);
    },
  });
  const busy =
    choose.isPending || edit.isPending || archive.isPending || remove.isPending;
  useUnsavedChanges(
    busy,
    "Wait for this exercise change to finish, or retry it before leaving.",
    true,
  );
  useEffect(() => {
    if (deleted && !busy) onClose();
  }, [deleted, busy, onClose]);
  const exerciseActions = (
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
            setActionsMenu((current) =>
              current ? null : { anchor, x: rect.right, y: rect.bottom + 4 },
            );
          }}
        >
          <MoreHorizontal size={18} aria-hidden="true" />
        </TooltipButton>
      )}
    </div>
  );
  const exerciseHeading = (
    <div className="fitness-exercise-detail-heading">
      <div>
        {standalone ? <h1>{item.name}</h1> : <h2>{item.name}</h2>}
        {!item.definition && (
          <span className="fitness-custom-badge">Custom</span>
        )}
      </div>
    </div>
  );
  const exerciseAddition = onChoose ? (
    <button
      className="button primary fitness-exercise-add-trigger"
      disabled={busy || !!item.exercise?.archivedAt}
      onClick={() => choose.mutate()}
    >
      Add {item.name}
    </button>
  ) : (
    !workoutContext &&
    !item.exercise?.archivedAt && (
      <ExerciseAddToWorkout item={item} overview={standalone} />
    )
  );
  if (copy)
    return (
      <ExerciseEditor
        initialValues={copy}
        onCancel={() => {
          setCopy(null);
          requestAnimationFrame(() =>
            panel.current
              ?.querySelector<HTMLElement>('[aria-label="Exercise actions"]')
              ?.focus({ preventScroll: true }),
          );
        }}
        onSaved={(exercise) => {
          refresh();
          setCopy(null);
          onDuplicated(exercise);
        }}
      />
    );
  return (
    <section
      className={`fitness-inspector fitness-exercise-detail-page${reference ? " fitness-exercise-reference" : ""}`}
      data-history-entry={initialHistory}
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
      <div className="fitness-exercise-detail-toolbar">
        {!hideBack && (
          <button className="fitness-back" onClick={onClose} disabled={busy}>
            <ArrowLeft size={16} aria-hidden="true" />
            {backLabel}
          </button>
        )}
        {exerciseActions}
      </div>
      <div className="fitness-exercise-overview has-title">
        {exerciseHeading}
        <ExerciseVisual large />
        <div className="fitness-exercise-facts">
          <div className="fitness-exercise-equipment">
            <SectionHeading>Equipment</SectionHeading>
            {item.equipment.length ? (
              <ul>
                {item.equipment.map((equipment) => (
                  <li key={equipment}>{equipment}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">Not specified</p>
            )}
          </div>
          {item.muscles.length > 0 && (
            <div>
              <SectionHeading>Muscles worked</SectionHeading>
              <div className="fitness-muscle-tags" aria-label="Muscles worked">
                {item.muscles.map((muscle) => (
                  <span key={muscle}>{muscle}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        {exerciseAddition}
      </div>
      {item.notes && (
        <div className="fitness-exercise-instructions">
          <SectionHeading>Instructions</SectionHeading>
          <p>{item.notes || "No instructions added yet."}</p>
        </div>
      )}
      {item.definition && item.exercise?.hidden && (
        <p className="text-small">
          Hidden from your library. Existing workouts and history are unchanged.
        </p>
      )}
      {item.exercise?.archivedAt && (
        <p className="text-small">
          Archived. Restore it to use it in a workout.
        </p>
      )}
      <CommandError command={choose} />
      <CommandError command={edit} />
      <CommandError command={archive} />
      {!deleting && <CommandError command={remove} />}
      {(!reference || initialHistory) && (
        <section
          className="fitness-exercise-personal-history"
          aria-label="Your history"
        >
          <SectionHeading ref={historyHeading} tabIndex={-1}>
            Your history
          </SectionHeading>
          {item.exercise ? (
            <ExerciseProgressPage
              key={initialMode ?? "all"}
              id={item.exercise.id}
              initialMode={initialMode}
              embedded
              nested={!standalone}
              onReady={initialHistory ? focusHistory : undefined}
            />
          ) : (
            <ExerciseHistoryEmpty embedded nested={!standalone} />
          )}
        </section>
      )}
      {reference && !initialHistory && (
        <div className="fitness-exercise-reference-records">
          {item.exercise ? (
            <ExerciseProgressPage id={item.exercise.id} embedded recordsOnly />
          ) : (
            <ExerciseHistoryEmpty embedded />
          )}
        </div>
      )}
      {actionsMenu && (
        <ContextMenu
          {...actionsMenu}
          label="Exercise actions"
          anchorToggles
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
              run: () =>
                setCopy({
                  name: item.name.slice(0, 153) + " (copy)",
                  notes: item.notes,
                  equipment: item.equipment,
                  muscles: item.muscles,
                  loggingType:
                    item.exercise?.loggingType ??
                    item.definition?.loggingType ??
                    "reps_load",
                  intentTags: item.exercise?.intentTags ?? [],
                  favourite: false,
                }),
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
              run: () =>
                archive.mutate({
                  value: item.definition
                    ? !item.exercise?.hidden
                    : !item.exercise?.archivedAt,
                  importKey: crypto.randomUUID(),
                }),
            },
            ...(!item.definition
              ? [
                  { separator: true as const },
                  {
                    label: "Delete exercise",
                    disabled: busy || !item.exercise?.canDelete,
                    description: item.exercise?.canDelete
                      ? undefined
                      : "Used in workouts or history. Archive it instead.",
                    destructive: true,
                    run: () => setDeleting(true),
                  },
                ]
              : []),
          ]}
        />
      )}
      {toast.notice && (
        <Toast
          key={toast.notice.id}
          {...toast.notice}
          action={
            toast.notice.action
              ? { ...toast.notice.action, disabled: busy }
              : undefined
          }
          onDismiss={() => toast.dismiss()}
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
