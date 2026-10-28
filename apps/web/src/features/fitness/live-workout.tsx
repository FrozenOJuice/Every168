"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Check,
  CircleCheck,
  ChevronDown,
  Info,
  Pencil,
  SkipForward,
  Undo2,
} from "lucide-react";
import { measurementsFor } from "@168hours/contracts";
import { fromKilograms, fromMeters } from "@168hours/domain-utils";
import { useMe } from "@/features/identity/me";
import { ContextMenu } from "@/components/ui/context-menu";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { useFitnessExercisePanel } from "./fitness-exercise-workspace";
import {
  WorkoutDisplayUnitsContext,
  WorkoutUnitScope,
  setUnitKey,
  useExerciseDisplayUnits,
} from "./workout-display-units";
import { restSource, type RestSource } from "./session-rest-state";
import { WorkoutNumberField } from "./workout-number-field";
import { RestBetweenSets } from "./rest-between-sets";
import { ExerciseRecall } from "./exercise-recall";
import { formatFitnessDuration } from "./rest-duration";
import { workoutExerciseSummary } from "./workout-exercise-summary";
import { useReorderList } from "./reorder-list";
import {
  actualKeys,
  canCompleteLiveSet,
  liveSetResults,
} from "./live-set-results";
import type { ExerciseDraft, SetDraft } from "./strength-draft";

function focusLiveStep(element: HTMLElement | null) {
  if (!element) return;
  element.focus({ preventScroll: true });
  const target = element.closest(".fitness-live-set") ?? element;
  const bounds = target.getBoundingClientRect();
  const status = document.querySelector(".fitness-live-status");
  const top = Math.max(12, (status?.getBoundingClientRect().bottom ?? 0) + 12);
  if (bounds.top < top || bounds.bottom > window.innerHeight - 90)
    window.scrollBy({ top: bounds.top - top, behavior: "instant" });
}

type Props = {
  value: ExerciseDraft[];
  onChange: (value: ExerciseDraft[]) => void;
  disabled: boolean;
  sessionId: string;
  onRest: (
    seconds: number | null,
    exercise: string,
    source: RestSource,
  ) => void;
  onUndoRest: (source: RestSource) => void;
  errors?: Record<string, string>;
};

export function LiveWorkout({
  value,
  onChange,
  disabled,
  sessionId,
  onRest,
  onUndoRest,
  errors = {},
}: Props) {
  const [requested, setRequested] = useState({ key: "", sequence: 0 });
  const keyFor = (exercise: ExerciseDraft) =>
    exercise.clientKey ?? exercise.id ?? "";
  const { root, rowProps, handle, feedback } = useReorderList(
    value,
    onChange,
    disabled,
  );
  return (
    <div className="fitness-live-workout">
      {!value.length && (
        <p className="muted">No exercises yet. Use Edit workout to add some.</p>
      )}
      <div className="fitness-live-exercise-list" ref={root}>
        {value.map((exercise, index) => (
          <section
            {...rowProps(index)}
            key={exercise.clientKey ?? exercise.id ?? index}
            className={`fitness-live-exercise panel ${rowProps(index).className ?? ""}`}
            aria-label={`${exercise.name} exercise ${index + 1}`}
          >
            <LiveExercise
              initiallyOpen={
                index ===
                value.findIndex((item) =>
                  item.sets.some((set) => !set.completed && !set.skipped),
                )
              }
              openRequest={
                requested.key === keyFor(exercise) ? requested.sequence : 0
              }
              hasCompletedSets={value.some((item) =>
                item.sets.some((set) => set.completed),
              )}
              unfinishedExercises={value.filter(
                (item) =>
                  item !== exercise &&
                  item.sets.some((set) => !set.completed && !set.skipped),
              )}
              nextExercise={[
                ...value.slice(index + 1),
                ...value.slice(0, index),
              ].find((item) =>
                item.sets.some((set) => !set.completed && !set.skipped),
              )}
              onNext={(next) =>
                setRequested((previous) => ({
                  key: keyFor(next),
                  sequence: previous.sequence + 1,
                }))
              }
              exercise={exercise}
              errors={errors}
              errorPrefix={`exercises.${index}`}
              disabled={disabled}
              sessionId={sessionId}
              onRest={onRest}
              onUndoRest={onUndoRest}
              handle={handle(index, `exercise ${index + 1}: ${exercise.name}`)}
              onChange={(next) =>
                onChange(value.map((item, i) => (i === index ? next : item)))
              }
            />
          </section>
        ))}
      </div>
      {feedback}
    </div>
  );
}

function LiveExercise({
  initiallyOpen,
  openRequest,
  hasCompletedSets,
  nextExercise,
  unfinishedExercises,
  onNext,
  exercise,
  onChange,
  disabled,
  sessionId,
  onRest,
  onUndoRest,
  handle,
  errors,
  errorPrefix,
}: {
  initiallyOpen: boolean;
  openRequest: number;
  hasCompletedSets: boolean;
  nextExercise?: ExerciseDraft;
  unfinishedExercises: ExerciseDraft[];
  onNext: (exercise: ExerciseDraft) => void;
  exercise: ExerciseDraft;
  onChange: (exercise: ExerciseDraft) => void;
  disabled: boolean;
  sessionId: string;
  onRest: Props["onRest"];
  onUndoRest: Props["onUndoRest"];
  handle: ReactNode;
  errors: Record<string, string>;
  errorPrefix: string;
}) {
  const { preferences } = useMe();
  const displayUnits = useExerciseDisplayUnits(preferences);
  const panel = useFitnessExercisePanel();
  const contentId = useId();
  const setHeading = useRef<HTMLHeadingElement>(null);
  const doneMessage = useRef<HTMLDivElement>(null);
  const [choosing, setChoosing] = useState<{
    anchor: HTMLButtonElement;
    x: number;
    y: number;
  } | null>(null);
  const closeChoices = useCallback(() => setChoosing(null), [setChoosing]);
  const [open, setOpen] = useState(initiallyOpen);
  const [handledRequest, setHandledRequest] = useState(openRequest);
  if (openRequest && openRequest !== handledRequest) {
    setHandledRequest(openRequest);
    setOpen(true);
  }
  useEffect(() => {
    if (!openRequest) return;
    let cancelled = false;
    const frame = requestAnimationFrame(async () => {
      const list = setHeading.current?.closest(".fitness-live-exercise-list");
      await Promise.allSettled(
        (list?.getAnimations({ subtree: true }) ?? []).map(
          (animation) => animation.finished,
        ),
      );
      if (!cancelled) focusLiveStep(setHeading.current);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [openRequest]);
  const firstUnfinished = exercise.sets.findIndex(
    (set) => !set.completed && !set.skipped,
  );
  const [correcting, setCorrecting] = useState<string | null>(null);
  const correctionIndex = exercise.sets.findIndex(
    (item) => (item.clientKey ?? item.id) === correcting,
  );
  const invalidCompleted = exercise.sets.find(
    (item, index) =>
      item.completed &&
      Object.entries(errors).some(
        ([key, error]) =>
          error &&
          (key === `${errorPrefix}.sets.${index}` ||
            key.startsWith(`${errorPrefix}.sets.${index}.`)),
      ),
  );
  if (correctionIndex < 0 && invalidCompleted)
    setCorrecting(invalidCompleted.clientKey ?? invalidCompleted.id ?? null);
  const correctingResult = correctionIndex >= 0;
  const active = correctingResult
    ? correctionIndex
    : firstUnfinished < 0
      ? null
      : firstUnfinished;
  const set = active === null ? undefined : exercise.sets[active];
  if (
    !open &&
    Object.entries(errors).some(
      ([key, error]) => error && key.startsWith(`${errorPrefix}.`),
    )
  )
    setOpen(true);
  const mode = exercise.loggingType ?? "reps_load";
  const fields = set ? measurementsFor(set.measurementOverride ?? mode) : [];
  const results = set ? liveSetResults(set, mode) : undefined;
  const canComplete = !!results && canCompleteLiveSet(results);
  const completed = exercise.sets.filter((item) => item.completed).length;
  const skipped = exercise.sets.filter((item) => item.skipped).length;
  const labels = {
    reps: "Reps",
    load: `Load (${preferences.weightUnit})`,
    duration: "Time",
    distance: `Distance (${preferences.distanceUnit})`,
    laps: "Laps",
  };
  function update(next: SetDraft) {
    onChange({
      ...exercise,
      sets: exercise.sets.map((item, index) =>
        index === active ? next : item,
      ),
    });
  }
  function advance(skip: boolean) {
    if (!set || !results || active === null) return;
    // Skipping never records unconfirmed planned values.
    update({ ...(skip ? set : results), completed: !skip, skipped: skip });
    const after = exercise.sets.findIndex(
      (item, i) => i > active && !item.completed && !item.skipped,
    );
    if (!skip)
      onRest(
        after >= 0 ? set.restSeconds : null,
        exercise.name,
        restSource(exercise, set),
      );
    requestAnimationFrame(() =>
      focusLiveStep(
        setHeading.current ??
          doneMessage.current ??
          document.querySelector<HTMLButtonElement>("[data-finish-workout]"),
      ),
    );
  }
  function undo(index: number) {
    setCorrecting(null);
    onChange({
      ...exercise,
      sets: exercise.sets.map((item, i) =>
        i === index ? { ...item, completed: false, skipped: false } : item,
      ),
    });
    onUndoRest(restSource(exercise, exercise.sets[index]!));
    requestAnimationFrame(() => focusLiveStep(setHeading.current));
  }
  const activeEditor =
    set && results && active !== null ? (
      <WorkoutUnitScope id={setUnitKey(set, active)}>
        <section className="fitness-live-set" aria-label="Current set">
          <div className="fitness-live-set-heading">
            <h3 ref={setHeading} tabIndex={-1}>
              Set {active + 1} <span>of {exercise.sets.length}</span>
            </h3>
            <span className="fitness-live-current-label">
              {correctingResult ? "Correct recorded set" : "Current set"}
            </span>
          </div>
          <p className="fitness-live-target">
            Planned:{" "}
            {workoutExerciseSummary(
              { ...exercise, sets: [set] },
              displayUnits.forSet(set, active),
            )}
          </p>
          <div className="fitness-live-fields">
            {fields.map((field) => (
              <WorkoutNumberField
                key={`${set.clientKey ?? set.id ?? active}-${field}`}
                label={`Actual ${field === "load" ? `load (${preferences.weightUnit})` : field === "distance" ? `distance (${preferences.distanceUnit})` : field === "duration" ? "duration (seconds)" : field}`}
                displayLabel={field === "duration" ? "Duration" : labels[field]}
                value={results[actualKeys[field]]}
                error={
                  errors[`${errorPrefix}.sets.${active}.${actualKeys[field]}`]
                }
                weight={field === "load"}
                distance={field === "distance"}
                duration={field === "duration"}
                disabled={disabled}
                onChange={(value) =>
                  update({
                    ...results,
                    [actualKeys[field]]: value,
                    resultsEdited: true,
                  })
                }
              />
            ))}
          </div>
          <div className="fitness-live-step-actions">
            {correctingResult ? (
              <button
                type="button"
                className="button primary"
                disabled={disabled || !canComplete}
                onClick={() => {
                  setCorrecting(null);
                  requestAnimationFrame(() =>
                    (setHeading.current ?? doneMessage.current)?.focus({
                      preventScroll: true,
                    }),
                  );
                }}
              >
                Done correcting
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="button"
                  disabled={disabled}
                  aria-label="Skip set"
                  onClick={() => advance(true)}
                >
                  Skip set
                </button>
                <button
                  type="button"
                  className="button primary"
                  disabled={disabled || !canComplete}
                  aria-label="Complete set"
                  onClick={() => advance(false)}
                >
                  <Check size={18} aria-hidden="true" /> Complete set
                </button>
              </>
            )}
          </div>
          {!canComplete && (
            <p className="fitness-live-hint">
              Enter at least one valid measurement.
            </p>
          )}
        </section>
      </WorkoutUnitScope>
    ) : null;
  return (
    <WorkoutDisplayUnitsContext.Provider value={displayUnits.context}>
      <header className="fitness-live-exercise-header">
        {handle}
        <h2 aria-label={exercise.name}>
          <button
            className="fitness-live-exercise-toggle"
            type="button"
            aria-label={`${open ? "Collapse" : "Expand"} ${exercise.name} exercise`}
            aria-expanded={open}
            aria-controls={contentId}
            aria-describedby={`${contentId}-summary ${contentId}-progress`}
            onClick={() => setOpen(!open)}
          >
            <span className="fitness-live-exercise-title">
              <span className="fitness-live-exercise-name">
                <span>{exercise.name}</span>
                <ChevronDown size={16} aria-hidden="true" />
              </span>{" "}
              <span
                id={`${contentId}-summary`}
                className="fitness-exercise-target-summary"
              >
                Planned:{" "}
                {workoutExerciseSummary(
                  exercise,
                  displayUnits.units,
                  false,
                  exercise.sets.map(displayUnits.forSet),
                )}
              </span>
            </span>
            <span
              id={`${contentId}-progress`}
              className="fitness-live-exercise-progress"
              aria-label={`${completed} completed, ${skipped} skipped, ${exercise.sets.length - completed - skipped} remaining`}
            >
              {completed}/{exercise.sets.length} done
              {skipped > 0 ? ` · ${skipped} skipped` : ""}
            </span>
          </button>
        </h2>
        <TooltipButton
          type="button"
          className="icon-button"
          tooltip="Exercise details"
          aria-label={`Help with ${exercise.name}`}
          onClick={() => panel.help(exercise.exerciseId)}
        >
          <Info size={18} aria-hidden="true" />
        </TooltipButton>
      </header>
      <div
        id={contentId}
        className="fitness-exercise-body"
        data-collapsed={!open}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="fitness-exercise-body-clip">
          <div className="fitness-live-exercise-content">
            {exercise.notes && (
              <p className="fitness-live-note">{exercise.notes}</p>
            )}
            <ol
              className="fitness-live-set-stack"
              aria-label={`${exercise.name} sets`}
            >
              {exercise.sets.map((item, index) => {
                const units = displayUnits.forSet(item, index);
                const rowLabels = {
                  ...labels,
                  load: `Load (${units.weightUnit})`,
                  distance: `Distance (${units.distanceUnit})`,
                };
                const status = item.completed
                  ? "Completed"
                  : item.skipped
                    ? "Skipped"
                    : index === active
                      ? "Current"
                      : "Upcoming";
                const displayed = item.completed
                  ? item
                  : liveSetResults(item, mode);
                const summary = measurementsFor(
                  item.measurementOverride ?? mode,
                )
                  .map((field) => {
                    const value = displayed[actualKeys[field]];
                    if (value === null) return `${rowLabels[field]} —`;
                    if (field === "load")
                      return `${Number(fromKilograms(value, units.weightUnit).toFixed(2))} ${units.weightUnit}`;
                    if (field === "distance")
                      return `${Number(fromMeters(value, units.distanceUnit).toFixed(3))} ${units.distanceUnit}`;
                    if (field === "duration")
                      return formatFitnessDuration(value, units.durationUnit);
                    return `${value} ${field}`;
                  })
                  .join(" | ");
                return (
                  <li
                    key={item.clientKey ?? item.id ?? index}
                    className="fitness-live-stack-item"
                    aria-current={index === active ? "step" : undefined}
                  >
                    <div
                      className="fitness-live-stack-row"
                      data-state={status.toLowerCase()}
                    >
                      {index === active ? (
                        activeEditor
                      ) : (
                        <div className="fitness-live-stack-summary">
                          <div>
                            <h3>
                              {item.completed ? (
                                <CircleCheck
                                  className="fitness-live-set-status-icon"
                                  size={18}
                                  aria-hidden="true"
                                />
                              ) : item.skipped ? (
                                <SkipForward
                                  className="fitness-live-set-status-icon"
                                  size={18}
                                  aria-hidden="true"
                                />
                              ) : null}
                              Set {index + 1} <span>{status}</span>
                            </h3>
                            {!item.skipped && <p>{summary}</p>}
                          </div>
                          {item.completed && (
                            <button
                              type="button"
                              className="button fitness-live-undo"
                              disabled={disabled}
                              aria-label={`Edit results of set ${index + 1}`}
                              onClick={() => {
                                setCorrecting(
                                  item.clientKey ?? item.id ?? null,
                                );
                                requestAnimationFrame(() =>
                                  setHeading.current?.focus({
                                    preventScroll: true,
                                  }),
                                );
                              }}
                            >
                              <Pencil size={15} aria-hidden="true" /> Edit
                            </button>
                          )}
                          {(item.completed || item.skipped) && (
                            <button
                              type="button"
                              className="button fitness-live-undo"
                              aria-label={`Undo ${item.completed ? "completion" : "skip"} of set ${index + 1}`}
                              disabled={disabled}
                              onClick={() => undo(index)}
                            >
                              <Undo2 size={15} aria-hidden="true" />
                              Undo
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {index < exercise.sets.length - 1 && (
                      <RestBetweenSets
                        index={index}
                        value={item.restSeconds}
                        disabled={disabled}
                        onChange={(restSeconds) =>
                          onChange({
                            ...exercise,
                            sets: exercise.sets.map((entry, i) =>
                              i === index ? { ...entry, restSeconds } : entry,
                            ),
                          })
                        }
                      />
                    )}
                  </li>
                );
              })}
            </ol>
            {active === null &&
              (nextExercise || !exercise.sets.length || !hasCompletedSets) && (
                <div
                  className="fitness-live-handoff"
                  ref={doneMessage}
                  tabIndex={-1}
                  role="group"
                  aria-label="Exercise actions"
                >
                  {!nextExercise &&
                    (!exercise.sets.length || !hasCompletedSets) && (
                      <p className="fitness-live-exercise-done" role="status">
                        {!exercise.sets.length
                          ? "Use Edit workout to add sets."
                          : "Undo a skipped set and complete it to finish this workout."}
                      </p>
                    )}
                  {nextExercise && exercise.sets.length > 0 && (
                    <>
                      <div className="fitness-live-handoff-actions">
                        <button
                          type="button"
                          className="button"
                          disabled={disabled}
                          aria-expanded={!!choosing}
                          aria-haspopup="menu"
                          onClick={(event) => {
                            if (choosing) {
                              closeChoices();
                              return;
                            }
                            const anchor = event.currentTarget;
                            const rect = anchor.getBoundingClientRect();
                            setChoosing({
                              anchor,
                              x: rect.left,
                              y: rect.bottom + 4,
                            });
                          }}
                        >
                          Choose exercise{" "}
                          <ChevronDown size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="button primary"
                          disabled={disabled}
                          onClick={() => {
                            setChoosing(null);
                            setOpen(false);
                            onNext(nextExercise);
                          }}
                        >
                          Next exercise: {nextExercise.name}
                        </button>
                      </div>
                      {choosing && !disabled && (
                        <ContextMenu
                          {...choosing}
                          anchorToggles
                          portalContainer={
                            choosing.anchor.closest("main") ?? undefined
                          }
                          label="Choose next exercise"
                          className="fitness-live-exercise-menu"
                          onClose={closeChoices}
                          actions={unfinishedExercises.map((item) => ({
                            label: item.name,
                            description: `Planned: ${workoutExerciseSummary(item, preferences)}`,
                            run: () => {
                              setOpen(false);
                              onNext(item);
                            },
                          }))}
                        />
                      )}
                    </>
                  )}
                </div>
              )}
            {open && (
              <ExerciseRecall
                quietEmpty
                id={exercise.exerciseId}
                mode={set?.measurementOverride ?? mode}
                excludeWorkoutId={sessionId}
                onHistory={() =>
                  panel.help(
                    exercise.exerciseId,
                    true,
                    set?.measurementOverride ?? mode,
                  )
                }
              />
            )}
          </div>
        </div>
      </div>
    </WorkoutDisplayUnitsContext.Provider>
  );
}
