"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Exercise, Cardio } from "@168hours/contracts";
import { PageHeading } from "@/components/ui/feedback";
import { Dialog } from "@/components/ui/dialog";
import { WorkoutStartForm } from "./workout-start-form";
import { WorkoutHistory } from "./workout-history";
import { CardioHistory } from "./cardio-history";
import { CardioForm } from "./cardio-form";
import { ExerciseLibrary } from "./exercise-library";
import { ExerciseForm } from "./exercise-form";
import { StrengthProgress } from "./strength-progress";
type Editor =
  | { kind: "start" }
  | { kind: "cardio"; activity?: Cardio }
  | { kind: "exercise"; exercise?: Exercise }
  | { kind: "progress"; exercise: Exercise };
export function ExercisePage({ section }: { section?: string }) {
  const router = useRouter();
  const tab =
    section === "cardio" || section === "library" ? section : "strength";
  function setTab(tab: "strength" | "cardio" | "library") {
    router.push("/exercise?tab=" + tab, { scroll: false });
  }
  const [editor, setEditor] = useState<Editor | null>(null);
  return (
    <div className="exercise-workspace">
      <PageHeading
        title="Exercise"
        description="Strength, cardio, and your training history."
      >
        <div className="row page-actions">
          <button
            className={tab === "library" ? "button primary" : "button"}
            onClick={() => setEditor({ kind: "exercise" })}
          >
            Add exercise
          </button>
          <button
            className={tab === "cardio" ? "button primary" : "button"}
            onClick={() => setEditor({ kind: "cardio" })}
          >
            Log cardio
          </button>
          <button
            className={tab === "strength" ? "button primary" : "button"}
            onClick={() => setEditor({ kind: "start" })}
          >
            Start workout
          </button>
        </div>
      </PageHeading>
      <div className="tabs" role="group" aria-label="Exercise sections">
        <button
          aria-pressed={tab === "strength"}
          onClick={() => setTab("strength")}
        >
          Strength
        </button>
        <button
          aria-pressed={tab === "cardio"}
          onClick={() => setTab("cardio")}
        >
          Cardio
        </button>
        <button
          aria-pressed={tab === "library"}
          onClick={() => setTab("library")}
        >
          Exercise library
        </button>
      </div>
      {tab === "strength" ? (
        <WorkoutHistory />
      ) : tab === "cardio" ? (
        <CardioHistory
          onEdit={(activity) => setEditor({ kind: "cardio", activity })}
        />
      ) : (
        <ExerciseLibrary
          onEdit={(exercise) => setEditor({ kind: "exercise", exercise })}
          onProgress={(exercise) => setEditor({ kind: "progress", exercise })}
        />
      )}
      {editor && (
        <Dialog
          title={
            editor.kind === "start"
              ? "Start a workout"
              : editor.kind === "progress"
                ? editor.exercise.name + " progress"
                : editor.kind === "exercise"
                  ? editor.exercise
                    ? "Edit exercise"
                    : "Add exercise"
                  : editor.activity
                    ? "Edit cardio"
                    : "Log cardio"
          }
          onClose={() => setEditor(null)}
        >
          {editor.kind === "start" ? (
            <WorkoutStartForm />
          ) : editor.kind === "progress" ? (
            <StrengthProgress id={editor.exercise.id} />
          ) : editor.kind === "exercise" ? (
            <ExerciseForm
              exercise={editor.exercise}
              onSaved={() => {
                setEditor(null);
                setTab("library");
              }}
            />
          ) : (
            <CardioForm
              activity={editor.activity}
              onSaved={() => {
                setEditor(null);
                setTab("cardio");
              }}
            />
          )}
        </Dialog>
      )}
    </div>
  );
}
