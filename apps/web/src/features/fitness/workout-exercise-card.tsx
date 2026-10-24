"use client";
import { normalizeMeasurementOverride } from "@168hours/contracts";
import { hasCustomSetSettings } from "./workout-basic-settings";
import { ResetWorkoutExercise } from "./reset-workout-exercise";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { copyFollowingSets } from "./copy-following-sets";
import { Trash2, Plus, ChevronDown, SlidersHorizontal } from "lucide-react";
import { WorkoutMeasurementsEditor } from "./workout-measurements-editor";
import { ExerciseRecall } from "./exercise-recall";
import { useState, useId, type CSSProperties, type ReactNode } from "react";
import { NotesEditor } from "./notes-editor";
import { useFitnessExercisePanel } from "./fitness-exercise-workspace";
import { emptySet, nextPlannedSet, type ExerciseDraft } from "./strength-draft";
import { useReorderList } from "./reorder-list";
import { exerciseTrackingFields } from "./exercise-tracking";

import { IntentTagsField } from "./intent-tags-field";
import { workoutCreationExperiment } from "./workout-creation-experiment";
import { WorkoutQuickTargets } from "./workout-quick-targets";
import { WorkoutSetRow } from "./workout-set-row";
import { workoutExerciseSummary } from "./workout-exercise-summary";
import { useMe } from "@/features/identity/me";

export function WorkoutExerciseCard({
  exercise,
  collapsible = false,
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
  errors?: Record<string, string>;
  errorPrefix?: string;
  session?: boolean;
  sessionId?: string;
  disabled: boolean;
  handle: ReactNode;
  onRest?: (seconds: number) => void;
  onNotice?: (message: string) => void;
  onChange: (exercise: ExerciseDraft) => void;
  onRemove: () => void;
}) {
  const quick = workoutCreationExperiment && collapsible && !session;
  const { preferences } = useMe();
  const custom = hasCustomSetSettings(exercise);
  const [detailed, setDetailed] = useState(() => custom);
  const [resetting, setResetting] = useState(false);
  if (quick && custom && !detailed) setDetailed(true);
  const panel = useFitnessExercisePanel();
  const [collapsed, setCollapsed] = useState(false);
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
  const measurementColumns = Math.max(
    mainFields.length,
    ...exercise.sets.map(
      (set) =>
        exerciseTrackingFields[set.measurementOverride ?? loggingType].filter(
          (field) => !mainFields.includes(field),
        ).length,
    ),
  );
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
  return (
    <>
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
      <div className="fitness-workout-exercise-heading">
        {handle}
        <div className="fitness-exercise-heading-copy">
          <h2 aria-label={exercise.name}>
            <button
              type="button"
              className="fitness-exercise-name"
              aria-label={`Help with ${exercise.name}`}
              title="Exercise details"
              onClick={() => panel.help(exercise.exerciseId)}
            >
              {exercise.name}
            </button>
          </h2>
          {!session && (
            <span className="fitness-exercise-target-summary">
              {workoutExerciseSummary(exercise, preferences)}
            </span>
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
            className="icon-button fitness-exercise-collapse"
            aria-label={`${collapsed ? "Expand" : "Collapse"} ${exercise.name} exercise`}
            aria-expanded={!collapsed}
            aria-controls={contentId}
            tooltip={collapsed ? "Expand exercise" : "Collapse exercise"}
            onClick={() => setCollapsed(!collapsed)}
          >
            <ChevronDown size={18} aria-hidden="true" />
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
            <ExerciseRecall
              quietEmpty={quick}
              id={exercise.exerciseId}
              mode={loggingType}
              excludeWorkoutId={sessionId}
              onHistory={() =>
                panel.help(exercise.exerciseId, true, loggingType)
              }
            />
            {quick && !detailed && (
              <WorkoutQuickTargets
                exercise={exercise}
                disabled={disabled}
                onChange={onChange}
              />
            )}
            {(!quick || detailed) && (
              <>
                <div
                  ref={setListRef}
                  className={`fitness-workout-set-list${session ? " is-session" : ""}`}
                  style={
                    !session
                      ? ({
                          "--fitness-measurement-columns": mainFields.length,
                          "--fitness-measurement-min-columns":
                            measurementColumns,
                        } as CSSProperties)
                      : undefined
                  }
                >
                  {exercise.sets.map((set, index) => (
                    <div
                      {...rowProps(index)}
                      key={set.id ?? set.clientKey ?? index}
                      className={`fitness-workout-set${session ? " is-session" : ""}${set.completed ? " is-complete" : ""} ${rowProps(index).className ?? ""}`}
                      role="group"
                      aria-label={`Set ${index + 1}`}
                    >
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
                          session ? `Set ${index + 1}` : index + 1,
                        )}
                        onRest={onRest}
                        canCopyTargets={
                          !session &&
                          copyFollowingSets(exercise, index, "targets").count >
                            0
                        }
                        canCopyRest={
                          !session &&
                          copyFollowingSets(exercise, index, "rest").count > 0
                        }
                        onCopy={
                          !session
                            ? (kind) => {
                                const result = copyFollowingSets(
                                  exercise,
                                  index,
                                  kind,
                                );
                                if (!result.count) return;
                                onChange(result.exercise);
                                onNotice?.(
                                  `${kind === "targets" ? "Targets" : "Rest"} applied to ${result.count} following ${result.count === 1 ? "set" : "sets"}.`,
                                );
                              }
                            : undefined
                        }
                        onChange={(next) =>
                          onChange({
                            ...exercise,
                            sets: exercise.sets.map((item, i) =>
                              i === index ? next : item,
                            ),
                          })
                        }
                        onRemove={() => {
                          if (exercise.sets.length <= 1) return;
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
                              rows?.[Math.min(index, (rows?.length ?? 0) - 1)];
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
                  className="fitness-text-action fitness-add-set"
                  disabled={disabled || exercise.sets.length >= 100}
                  onClick={() =>
                    onChange({
                      ...exercise,
                      sets: [
                        ...exercise.sets,
                        collapsible
                          ? nextPlannedSet(exercise.sets.at(-1))
                          : emptySet(),
                      ],
                    })
                  }
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
            {session && exercise.sets.length > 0 && (
              <button
                type="button"
                className="fitness-text-action"
                disabled={disabled}
                onClick={() =>
                  onChange({
                    ...exercise,
                    sets: exercise.sets.map((set) => ({
                      ...set,
                      skipped: !set.completed,
                    })),
                  })
                }
              >
                Skip remaining sets
              </button>
            )}
            {(!quick || detailed) && (
              <div className="fitness-exercise-intent">
                <IntentTagsField
                  label={`Intent for ${exercise.name}`}
                  value={exercise.intentTags ?? []}
                  disabled={disabled}
                  onChange={(intentTags) =>
                    onChange({ ...exercise, intentTags })
                  }
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
