"use client";
import { useState } from "react";
import {
  instantToLocalInput,
  localInputToInstant,
} from "@168hours/domain-utils";
import {
  taskTimeInput,
  type Task,
  type TaskTime,
  type TaskTimeInput,
} from "@168hours/contracts";
import { useMe } from "@/features/identity/me";
import { api } from "@/lib/api";
import { useCommand, CommandError } from "@/lib/use-command";
import { useTaskForm } from "./tasks-shared";
export function TaskTimeForm({
  task,
  kind,
  time,
  date,
  onSaved,
  onCancel,
}: {
  task: Task;
  kind: "schedule" | "time";
  time?: TaskTime;
  date: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const {
    preferences: { timezone },
  } = useMe();
  const [start, setStart] = useState(
      time ? instantToLocalInput(time.startsAt, timezone) : date + "T09:00",
    ),
    [end, setEnd] = useState(
      time ? instantToLocalInput(time.endsAt, timezone) : date + "T10:00",
    ),
    [notes, setNotes] = useState(time?.notes ?? ""),
    [error, setError] = useState("");
  const [baseline] = useState(() => JSON.stringify({ start, end, notes }));
  const save = useCommand({
    mutationFn: (v: TaskTimeInput, key: string) =>
      kind === "schedule"
        ? api.scheduleTask(task.id, v, task.version, key)
        : time
          ? api.saveTaskTime(time.id, v, time.version, key)
          : api.logTaskTime(task.id, v, task.version, key),
    onSuccess: onSaved,
  });
  useTaskForm(
    JSON.stringify({ start, end, notes }) !== baseline,
    save.isPending,
  );
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          const a =
              time && start === instantToLocalInput(time.startsAt, timezone)
                ? time.startsAt
                : localInputToInstant(start, timezone),
            b =
              time && end === instantToLocalInput(time.endsAt, timezone)
                ? time.endsAt
                : localInputToInstant(end, timezone);
          if (!a || !b) {
            setError(
              "Choose valid, unambiguous local times in " + timezone + ".",
            );
            return;
          }
          const result = taskTimeInput.safeParse({
            startsAt: a,
            endsAt: b,
            notes: notes || null,
          });
          if (!result.success) {
            setError(result.error.issues[0]!.message);
            return;
          }
          setError("");
          save.mutate(result.data);
        } catch {
          setError(
            "Choose valid, unambiguous local times in " + timezone + ".",
          );
        }
      }}
    >
      <h3>
        {kind === "schedule"
          ? "Schedule work"
          : time
            ? "Correct recorded time"
            : "Log actual time"}
      </h3>
      <p className="muted text-small">
        Times use {timezone}.{" "}
        {kind === "schedule"
          ? "Reserve time in Calendar."
          : "Record time you actually spent."}{" "}
        This keeps the task’s completion separate.
      </p>
      <fieldset disabled={save.isPending} className="stack">
        <div className="task-form-pair">
          <label>
            Start
            <input
              type="datetime-local"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            End
            <input
              type="datetime-local"
              required
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>
        <label>
          Time notes
          <textarea
            value={notes}
            maxLength={4000}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <div className="row">
          <button type="submit" className="button primary">
            {kind === "schedule"
              ? "Schedule work"
              : time
                ? "Save correction"
                : "Save actual time"}
          </button>
          <button
            type="button"
            className="button"
            onClick={() => {
              if (
                JSON.stringify({ start, end, notes }) === baseline ||
                confirm("Discard these time changes?")
              )
                onCancel();
            }}
          >
            Cancel time entry
          </button>
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <CommandError command={save} />
    </form>
  );
}
