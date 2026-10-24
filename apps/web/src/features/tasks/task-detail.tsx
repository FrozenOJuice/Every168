"use client";
import Link from "next/link";
import { localDate } from "@168hours/domain-utils";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  TaskDetail as Detail,
  TaskStateInput,
  TaskTime,
} from "@168hours/contracts";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { Loading, ErrorState } from "@/components/ui/feedback";
import { useCommand, CommandError } from "@/lib/use-command";
import { formatDate, formatTime } from "@/lib/format";
import { TaskEditor } from "./task-editor";
import { TaskTimeForm } from "./task-time-form";
export function TaskDetail({
  id,
  date,
  onChanged,
  onClose,
}: {
  id: string;
  date: string;
  onChanged: () => void;
  onClose: () => void;
}) {
  const query = useQuery({
    queryKey: ["tasks", "detail", id],
    queryFn: () => api.getTask(id),
  });
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  return (
    <Contents
      key={`${id}:${query.data.task.version}`}
      data={query.data}
      date={date}
      onChanged={onChanged}
      onClose={onClose}
    />
  );
}
type Action =
  | { type: "state"; input: TaskStateInput }
  | { type: "duplicate" }
  | { type: "delete" }
  | { type: "unschedule"; id: string; version: number }
  | { type: "deleteTime"; id: string; version: number };
function Contents({
  data,
  date,
  onChanged,
  onClose,
}: {
  data: Detail;
  date: string;
  onChanged: () => void;
  onClose: () => void;
}) {
  const { task, times, schedules } = data;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<"schedule" | "time" | null>(null);
  const [editTime, setEditTime] = useState<TaskTime>();
  const {
    preferences: { timezone },
  } = useMe();
  const command = useCommand({
    mutationFn: async (action: Action, key: string) => {
      if (action.type === "state")
        return api.changeTask(task.id, action.input, task.version, key);
      if (action.type === "duplicate")
        return api.duplicateTask(task.id, task.version, key);
      if (action.type === "delete")
        return api.deleteTask(task.id, task.version, key);
      if (action.type === "unschedule")
        return api.unscheduleTask(action.id, action.version, key);
      return api.deleteTaskTime(action.id, action.version, key);
    },
    onSuccess: () => {
      onChanged();
      if (commandAction === "delete") onClose();
    },
  });
  const [commandAction, setCommandAction] = useState("");
  const act = (action: Action) => {
    setCommandAction(action.type);
    command.mutate(action);
  };
  if (editing)
    return (
      <div className="stack">
        <h2>Edit task</h2>
        <TaskEditor
          task={task}
          onSaved={() => {
            onChanged();
            setEditing(false);
          }}
        />
      </div>
    );
  if (form)
    return (
      <TaskTimeForm
        task={task}
        kind={form}
        time={editTime}
        date={date}
        onSaved={() => {
          setForm(null);
          setEditTime(undefined);
          onChanged();
        }}
        onCancel={() => {
          setForm(null);
          setEditTime(undefined);
        }}
      />
    );
  return (
    <div className="stack task-details">
      <div>
        <h2>{task.title}</h2>
        <p className="muted">
          {task.status.replaceAll("_", " ")} {task.archived ? "· Archived" : ""}
          {task.inbox ? " · Inbox" : ""}
        </p>
      </div>
      {task.notes && <p className="task-notes">{task.notes}</p>}
      <dl className="task-metadata">
        {task.dueDate && (
          <div>
            <dt>Due</dt>
            <dd>{formatDate(task.dueDate)}</dd>
          </div>
        )}
        {task.plannedDate && (
          <div>
            <dt>Planned day</dt>
            <dd>{formatDate(task.plannedDate)}</dd>
          </div>
        )}
        <div>
          <dt>Priority</dt>
          <dd>{task.priority}</dd>
        </div>
        {task.tags.length > 0 && (
          <div>
            <dt>Tags</dt>
            <dd>{task.tags.join(", ")}</dd>
          </div>
        )}
        {task.repeat && (
          <div>
            <dt>Repeat</dt>
            <dd>
              {task.repeat.frequency}
              {task.repeat.until ? ` through ${task.repeat.until}` : ""}
            </dd>
          </div>
        )}
        {task.completedAt && (
          <div>
            <dt>{task.status === "skipped" ? "Skipped" : "Completed"}</dt>
            <dd>
              {formatDate(localDate(task.completedAt, timezone))} ·{" "}
              {formatTime(task.completedAt, timezone)}
            </dd>
          </div>
        )}
      </dl>
      {task.subtasks.length > 0 && (
        <section>
          <h3>Subtasks</h3>
          <ul className="task-checklist">
            {task.subtasks.map((s) => (
              <li key={s.id}>
                {s.completed ? "✓" : "○"} {s.title}
              </li>
            ))}
          </ul>
          <p className="muted text-small">
            Edit this task to update its checklist.
          </p>
        </section>
      )}
      <fieldset disabled={command.isPending} className="task-actions">
        <button
          className="button primary"
          onClick={() =>
            act({
              type: "state",
              input: {
                status:
                  task.status === "done" || task.status === "skipped"
                    ? "todo"
                    : "done",
              },
            })
          }
        >
          {task.status === "done" || task.status === "skipped"
            ? "Reopen task"
            : "Complete task"}
        </button>
        {task.status === "todo" && (
          <button
            className="button"
            onClick={() =>
              act({ type: "state", input: { status: "in_progress" } })
            }
          >
            Mark in progress
          </button>
        )}
        {task.status === "in_progress" && (
          <button
            className="button"
            onClick={() => act({ type: "state", input: { status: "todo" } })}
          >
            Mark to do
          </button>
        )}
        {task.inbox && (
          <button
            className="button"
            onClick={() => act({ type: "state", input: { inbox: false } })}
          >
            Move out of Inbox
          </button>
        )}
        <button className="button" onClick={() => setEditing(true)}>
          Edit task
        </button>
        {task.repeat && !task.advanced && (
          <button
            className="button"
            onClick={() => {
              if (confirm("Skip this occurrence and create the next?"))
                act({ type: "state", input: { status: "skipped" } });
            }}
          >
            Skip occurrence
          </button>
        )}
        <button className="button" onClick={() => act({ type: "duplicate" })}>
          Duplicate task
        </button>
        <button
          className="button"
          onClick={() =>
            act({ type: "state", input: { archived: !task.archived } })
          }
        >
          {task.archived ? "Restore task" : "Archive task"}
        </button>
        <button
          className="button danger"
          onClick={() => {
            if (
              confirm(
                "Delete this task, its scheduled blocks and its recorded time? Repeating tasks will not advance from a deleted occurrence.",
              )
            )
              act({ type: "delete" });
          }}
        >
          Delete task
        </button>
      </fieldset>
      <CommandError command={command} />
      <section className="stack">
        <div className="row between">
          <h3>Scheduled work</h3>
          <button
            disabled={command.isPending || task.archived}
            className="button"
            onClick={() => setForm("schedule")}
          >
            Schedule work
          </button>
        </div>
        {schedules.length === 0 ? (
          <p className="muted">No time reserved yet.</p>
        ) : (
          schedules.map((s) => (
            <div key={s.id} className="task-time-row">
              <Link href={`/?date=${localDate(s.startsAt, timezone)}&view=day`}>
                {formatDate(localDate(s.startsAt, timezone))} ·{" "}
                {formatTime(s.startsAt, timezone)} –{" "}
                {formatTime(s.endsAt, timezone)}
              </Link>
              <small>{s.title}</small>
              <button
                disabled={command.isPending}
                className="button"
                onClick={() => {
                  if (
                    confirm(
                      "Remove this scheduled work block? The task will stay.",
                    )
                  )
                    act({ type: "unschedule", id: s.id, version: s.version });
                }}
              >
                Remove scheduled block
              </button>
              <small>Open Calendar to move or edit this block.</small>
            </div>
          ))
        )}
      </section>
      <section className="stack">
        <div className="row between">
          <h3>Actual time</h3>
          <button
            disabled={command.isPending}
            className="button"
            onClick={() => setForm("time")}
          >
            Log actual time
          </button>
        </div>
        {times.length === 0 ? (
          <p className="muted">No actual time recorded.</p>
        ) : (
          times.map((t) => (
            <div key={t.id} className="task-time-row">
              <strong>
                {formatDate(localDate(t.startsAt, timezone))} ·{" "}
                {formatTime(t.startsAt, timezone)} –{" "}
                {formatTime(t.endsAt, timezone)}
              </strong>
              <span>
                {Math.round(
                  (Date.parse(t.endsAt) - Date.parse(t.startsAt)) / 60000,
                )}{" "}
                minutes{t.notes ? ` · ${t.notes}` : ""}
              </span>
              <div className="row">
                <button
                  disabled={command.isPending}
                  className="button"
                  onClick={() => {
                    setEditTime(t);
                    setForm("time");
                  }}
                >
                  Correct time
                </button>
                <button
                  disabled={command.isPending}
                  className="button danger"
                  onClick={() => {
                    if (confirm("Delete this actual time record?"))
                      act({ type: "deleteTime", id: t.id, version: t.version });
                  }}
                >
                  Delete time
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
