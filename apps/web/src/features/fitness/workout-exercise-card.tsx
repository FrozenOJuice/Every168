"use client";
import { normalizeMeasurementOverride } from "@168hours/contracts";
import type { ToastNotice } from "@/components/ui/toast";
import { useSetRemovalUndo } from "./use-set-removal-undo";
import { hasCustomSetSettings } from "./workout-basic-settings";
import { ResetWorkoutExercise } from "./reset-workout-exercise";
import { TooltipButton } from "@/components/ui/tooltip-button";
import {
  Trash2,
  Plus,
  ChevronDown,
  SlidersHorizontal,
  Info,
} from "lucide-react";
import { WorkoutMeasurementsEditor } from "./workout-measurements-editor";
import { useState, useId, type CSSProperties, type ReactNode } from "react";
import { NotesEditor } from "./notes-editor";
import { useFitnessExercisePanel } from "./fitness-exercise-workspace";
import { emptySet, nextPlannedSet, type ExerciseDraft } from "./strength-draft";
import { useReorderList } from "./reorder-list";
import { exerciseTrackingFields } from "./exercise-tracking";

import { workoutCreationExperiment } from "./workout-creation-experiment";
import { WorkoutQuickTargets } from "./workout-quick-targets";
import { WorkoutSetRow } from "./workout-set-row";
import {
  actualExerciseSummary,
  summaryExerciseOutcome,
} from "./workout-review-summary";
import { workoutExerciseSummary } from "./workout-exercise-summary";
import {
  WorkoutDisplayUnitsContext,
  WorkoutUnitScope,
  setUnitKey,
  useExerciseDisplayUnits,
} from "./workout-display-units";
import { useMe } from "@/features/identity/me";

export function WorkoutExerciseCard({
  exercise,
  collapsible = false,
  initiallyCollapsed = false,
  errors = {},
  errorPrefix = "",
  session,
  sessionId,
  disabled,
  handle,
  onRest,
  onNotice,
  onChange,
  onRemove,
}: {
  exercise: ExerciseDraft;
  collapsible?: boolean;
  initiallyCollapsed?: boolean;
  errors?: Record<string, string>;
  errorPrefix?: string;
  session?: boolean;
  sessionId?: string;
  disabled: boolean;
  handle: ReactNode;
  onRest?: (seconds: number) => void;
  onNotice?: (message: string, action?: ToastNotice["action"]) => void;
  onChange: (exercise: ExerciseDraft) => void;
  onRemove: () => void;
}) {
  const quick = workoutCreationExperiment && collapsible && !session;
  const { preferences } = useMe();
  const displayUnits = useExerciseDisplayUnits(preferences);
  const custom = hasCustomSetSettings(exercise);
  const [detailed, setDetailed] = useState(() => custom);
  const [resetting, setResetting] = useState(false);
  if (quick && custom && !detailed) setDetailed(true);
  const panel = useFitnessExercisePanel();
  const [collapsed, setCollapsed] = useState(collapsible && initiallyCollapsed);
  const contentId = useId();
  const setErrorId = useId();
  const hasErrors = Object.entries(errors).some(
    ([key, error]) => error && key.startsWith(`${errorPrefix}.`),
  );
  if (collapsed && hasErrors) setCollapsed(false);
  if (quick && hasErrors && !detailed) setDetailed(true);
  const [notesOpen, setNotesOpen] = useState(!!exercise.notes);
  if (!notesOpen && errors[`${errorPrefix}.notes`]) setNotesOpen(true);
  const loggingType = exercise.loggingType ?? "reps_load";
  const mainFields = exerciseTrackingFields[loggingType];
  const {
    root: setListRef,
    rowProps,
    handle: setHandle,
    feedback,
  } = useReorderList(
    exercise.sets,
    (value) => onChange({ ...exercise, sets: value }),
    disabled,
  );
  const offerSetUndo = useSetRemovalUndo({
    exercise,
    disabled,
    enabled: quick && !sessionId,
    onChange,
    onNotice,
    onRestore: () => {
      setDetailed(true);
      setCollapsed(false);
    },
    list: setListRef,
  });
  return (
    <WorkoutDisplayUnitsContext.Provider value={displayUnits.context}>
      {resetting && (
        <ResetWorkoutExercise
          exercise={exercise}
          disabled={disabled}
          onCancel={() => setResetting(false)}
          onConfirm={(next) => {
            onChange(next);
            setResetting(false);
            setDetailed(false);
          }}
        />
      )}
      <div
        className="fitness-workout-exercise-heading"
        data-collapsible={collapsible || undefined}
        onClick={(event) => {
          if (
            collapsible &&
            event.target instanceof Element &&
            !event.target.closest(
              'button, a, input, select, textarea, [role="button"]',
            )
          )
            setCollapsed((value) => !value);
        }}
      >
        {handle}
        <div className="fitness-exercise-heading-copy">
          <h2 aria-label={exercise.name}>
            <button
              type="button"
              className={`fitness-exercise-name${collapsible ? " fitness-exercise-toggle" : ""}`}
              aria-label={
                collapsible
                  ? `${collapsed ? "Expand" : "Collapse"} ${exercise.name} exercise`
                  : `Help with ${exercise.name}`
              }
              aria-expanded={collapsible ? !collapsed : undefined}
              aria-controls={collapsible ? contentId : undefined}
              onClick={() =>
                collapsible
                  ? setCollapsed(!collapsed)
                  : panel.help(exercise.exerciseId)
              }
            >
              <span>{exercise.name}</span>
              {collapsible && <ChevronDown size={16} aria-hidden="true" />}
            </button>
          </h2>
          {session && (
            <span className="fitness-exercise-target-summary">
              {summaryExerciseOutcome(exercise) ??
                `Recorded: ${actualExerciseSummary(
                  exercise,
                  displayUnits.units,
                  exercise.sets.map(displayUnits.forSet),
                )}`}
            </span>
          )}
          {!session && (
            <>
              <span
                className={`fitness-exercise-target-summary${quick ? " fitness-summary-full" : ""}`}
              >
                {workoutExerciseSummary(
                  exercise,
                  displayUnits.units,
                  false,
                  exercise.sets.map(displayUnits.forSet),
                )}
              </span>
              {quick && (
                <span className="fitness-exercise-target-summary fitness-summary-compact">
                  {workoutExerciseSummary(
                    exercise,
                    displayUnits.units,
                    true,
                    exercise.sets.map(displayUnits.forSet),
                  )}
                </span>
              )}
            </>
          )}
        </div>
        {quick && (
          <TooltipButton
            type="button"
            className="fitness-disclosure-control fitness-advanced-editor"
            aria-label={detailed ? "Reset to basic" : "Advanced editor"}
            aria-expanded={detailed}
            disabled={disabled}
            tooltip={
              detailed ? "Reset to basic editor" : "Open advanced editor"
            }
            onClick={() => {
              setCollapsed(false);
              if (detailed && custom) setResetting(true);
              else setDetailed(!detailed);
            }}
          >
            <SlidersHorizontal size={16} aria-hidden="true" />
            <span className="fitness-advanced-editor-label">
              {detailed ? "Reset to basic" : "Advanced editor"}
            </span>
          </TooltipButton>
        )}
        {collapsible && (
          <TooltipButton
            type="button"
            className="icon-button fitness-exercise-details-control"
            aria-label={`Exercise details for ${exercise.name}`}
            tooltip="Exercise details"
            onClick={() => panel.help(exercise.exerciseId)}
          >
            <Info size={18} aria-hidden="true" />
          </TooltipButton>
        )}
        <TooltipButton
          type="button"
          className="icon-button fitness-remove-control"
          disabled={disabled}
          aria-label={`Remove ${exercise.name} exercise`}
          tooltip="Remove exercise"
          onClick={onRemove}
        >
          <Trash2 size={18} aria-hidden="true" />
        </TooltipButton>
      </div>
      <div
        id={contentId}
        className="fitness-exercise-body"
        data-collapsed={collapsed}
        aria-hidden={collapsed}
        inert={collapsed}
      >
        <div className="fitness-exercise-body-clip">
          <div
            className="fitness-exercise-fields"
            data-logging-type={loggingType}
            data-measurement-count={mainFields.length}
          >
            <div
              className="fitness-card-measurements"
              hidden={quick && !detailed}
            >
              <WorkoutMeasurementsEditor
                name={exercise.name}
                value={loggingType}
                disabled={disabled}
                onChange={(nextType) =>
                  onChange({
                    ...exercise,
                    loggingType: nextType,
                    sets: exercise.sets.map((set) => ({
                      ...set,
                      measurementOverride: normalizeMeasurementOverride(
                        normalizeMeasurementOverride(
                          set.measurementOverride,
                          loggingType,
                        ),
                        nextType,
                      ),
                    })),
                  })
                }
              />
            </div>
            {quick && !detailed && (
              <WorkoutQuickTargets
                exercise={exercise}
                disabled={disabled}
                onChange={onChange}
              />
            )}
            {(!quick || detailed) && (
              <>
                <div ref={setListRef} className="fitness-workout-set-list">
                  {exercise.sets.map((set, index) => (
                    <div
                      {...rowProps(index)}
                      style={
                        {
                          ...rowProps(index).style,
                          "--fitness-measurement-grid": exerciseTrackingFields[
                            set.measurementOverride ?? loggingType
                          ]
                            .map(() => `minmax(0, 1fr)`)
                            .join(" "),
                          "--fitness-measurement-min-columns":
                            exerciseTrackingFields[
                              set.measurementOverride ?? loggingType
                            ].length,
                        } as CSSProperties
                      }
                      key={set.clientKey ?? set.id ?? index}
                      className={`fitness-workout-set ${rowProps(index).className ?? ""}`}
                      role="group"
                      aria-label={`Set ${index + 1}`}
                      data-set-occurrence={set.clientKey}
                      tabIndex={-1}
                    >
                      <WorkoutUnitScope id={setUnitKey(set, index)}>
                        <WorkoutSetRow
                          set={set}
                          index={index}
                          loggingType={loggingType}
                          hasNextSet={index < exercise.sets.length - 1}
                          session={session}
                          disabled={disabled}
                          canRemove={exercise.sets.length > 1}
                          errors={errors}
                          errorPrefix={`${errorPrefix}.sets.${index}`}
                          handle={setHandle(
                            index,
                            `set ${index + 1}`,
                            index + 1,
                          )}
                          onRest={onRest}
                          onChange={(next) =>
                            onChange({
                              ...exercise,
                              sets: exercise.sets.map((item, i) =>
                                i === index ? next : item,
                              ),
                            })
                          }
                          onRemove={() => {
                            if (disabled || exercise.sets.length <= 1) return;
                            offerSetUndo(index);
                            onChange({
                              ...exercise,
                              sets: exercise.sets.filter((_, i) => i !== index),
                            });
                            requestAnimationFrame(() => {
                              const rows =
                                setListRef.current?.querySelectorAll<HTMLElement>(
                                  ":scope > [data-reorder-item]",
                                );
                              const row =
                                rows?.[
                                  Math.min(index, (rows?.length ?? 0) - 1)
                                ];
                              const target = Array.from(
                                row?.querySelectorAll<HTMLInputElement>(
                                  "input",
                                ) ?? [],
                              ).find(
                                (input) =>
                                  input.getClientRects().length &&
                                  !input.disabled,
                              );
                              (
                                target ??
                                setListRef.current?.parentElement?.querySelector<HTMLButtonElement>(
                                  "[data-add-set]",
                                )
                              )?.focus({ preventScroll: true });
                            });
                          }}
                        />
                      </WorkoutUnitScope>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  data-add-set
                  data-validation-error={!!errors[`${errorPrefix}.sets`]}
                  aria-describedby={
                    errors[`${errorPrefix}.sets`] ? setErrorId : undefined
                  }
                  className="button fitness-add-set"
                  disabled={disabled || exercise.sets.length >= 100}
                  onClick={() => {
                    const source = exercise.sets.at(-1);
                    const next = collapsible
                      ? nextPlannedSet(source)
                      : emptySet();
                    if (collapsible && source)
                      displayUnits.copySetUnits(
                        setUnitKey(source, exercise.sets.length - 1),
                        setUnitKey(next, exercise.sets.length),
                      );
                    onChange({ ...exercise, sets: [...exercise.sets, next] });
                  }}
                >
                  <Plus size={16} aria-hidden="true" />
                  Add set
                </button>
                {feedback}
              </>
            )}
            <div className="fitness-workout-exercise-footer">
              <NotesEditor
                label="Exercise notes"
                value={exercise.notes}
                open={notesOpen}
                onOpenChange={setNotesOpen}
                disabled={disabled}
                error={errors[`${errorPrefix}.notes`]}
                onChange={(notes) => onChange({ ...exercise, notes })}
              />
            </div>
            {errors[`${errorPrefix}.sets`] && (
              <p id={setErrorId} className="error" role="alert">
                {errors[`${errorPrefix}.sets`]}
              </p>
            )}
          </div>
        </div>
      </div>
    </WorkoutDisplayUnitsContext.Provider>
  );
}
