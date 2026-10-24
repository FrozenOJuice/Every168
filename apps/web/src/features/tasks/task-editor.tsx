"use client";
import { useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { taskInput, type Task, type TaskInput } from "@168hours/contracts";
import { api } from "@/lib/api";
import { useCommand, CommandError } from "@/lib/use-command";
import { useTaskForm, FieldError } from "./tasks-shared";
export function TaskEditor({
  task,
  initial,
  onSaved,
}: {
  task?: Task;
  initial?: Partial<TaskInput>;
  onSaved: (task: Task) => void;
}) {
  const [v, setV] = useState<TaskInput>(() => ({
    ...taskInput.parse(
      Object.fromEntries(
        Object.keys(taskInput.shape).map((key) => [
          key,
          task?.[key as keyof TaskInput] ??
            initial?.[key as keyof TaskInput] ??
            (key === "title" ? "New task" : undefined),
        ]),
      ),
    ),
    title: task?.title ?? initial?.title ?? "",
  }));
  const [baseline] = useState(() => JSON.stringify(v));
  const [tags, setTags] = useState(v.tags.join(", "));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [future, setFuture] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const projects = useInfiniteQuery({
    queryKey: ["tasks", "projects"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.getTaskProjects(pageParam),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const options = projects.data?.pages.flatMap((p) => p.items) ?? [];
  const save = useCommand({
    mutationFn: (value: TaskInput, key: string) =>
      task
        ? api.saveTask(task.id, value, task.version, key, future)
        : api.createTask(value, key),
    onSuccess: onSaved,
  });
  useTaskForm(
    JSON.stringify(v) !== baseline || tags !== v.tags.join(", "),
    save.isPending,
  );
  const patch = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) =>
    setV((old) => ({ ...old, [key]: value }));
  const sections = options.find((p) => p.id === v.projectId)?.sections ?? [];
  return (
    <form
      ref={form}
      className="stack task-form"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = taskInput.safeParse({
          ...v,
          tags: tags
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
        });
        if (!parsed.success) {
          const next = Object.fromEntries(
            parsed.error.issues.map((issue) => [
              issue.path.join("."),
              issue.message,
            ]),
          );
          setErrors(next);
          requestAnimationFrame(() =>
            form.current
              ?.querySelector<HTMLElement>("[aria-invalid=true]")
              ?.focus(),
          );
          return;
        }
        setErrors({});
        save.mutate(parsed.data);
      }}
    >
      <fieldset disabled={save.isPending} className="stack">
        <label>
          Task title
          <input
            autoFocus
            name="title"
            aria-label="Task title"
            aria-describedby={errors.title ? "task-title-error" : undefined}
            value={v.title}
            maxLength={160}
            aria-invalid={!!errors.title}
            onChange={(e) => patch("title", e.target.value)}
          />
          <span id="task-title-error">
            <FieldError message={errors.title} />
          </span>
        </label>
        <label>
          Notes
          <textarea
            value={v.notes ?? ""}
            maxLength={4000}
            onChange={(e) => patch("notes", e.target.value || null)}
          />
        </label>
        <div className="task-form-pair">
          <label>
            Project
            <select
              value={v.projectId ?? ""}
              onChange={(e) =>
                setV((old) => ({
                  ...old,
                  projectId: e.target.value || null,
                  sectionId: null,
                  inbox: false,
                }))
              }
            >
              <option value="">Standalone task</option>
              {options
                .filter((p) => p.status === "active" || p.id === v.projectId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Section
            <select
              disabled={!v.projectId}
              value={v.sectionId ?? ""}
              onChange={(e) => patch("sectionId", e.target.value || null)}
            >
              <option value="">No section</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        {projects.error && (
          <p role="alert" className="error">
            Could not load projects.{" "}
            <button
              type="button"
              className="text-button"
              onClick={() => void projects.refetch()}
            >
              Retry projects
            </button>
          </p>
        )}
        {projects.hasNextPage && (
          <button
            type="button"
            className="button"
            onClick={() => void projects.fetchNextPage()}
          >
            Load more projects
          </button>
        )}
        <div className="task-form-pair">
          <label>
            Due date
            <input
              type="date"
              aria-label="Due date"
              value={v.dueDate ?? ""}
              onChange={(e) => patch("dueDate", e.target.value || null)}
            />
            <small>When it needs to be finished.</small>
          </label>
          <label>
            Planned day
            <input
              type="date"
              aria-label="Planned day"
              value={v.plannedDate ?? ""}
              onChange={(e) => patch("plannedDate", e.target.value || null)}
            />
            <small>When you want to work on it.</small>
          </label>
        </div>
        <div className="task-form-pair">
          <label>
            Priority
            <select
              value={v.priority}
              onChange={(e) =>
                patch("priority", e.target.value as TaskInput["priority"])
              }
            >
              {["none", "low", "medium", "high"].map((x) => (
                <option key={x} value={x}>
                  {x[0]!.toUpperCase() + x.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tags
            <input
              aria-label="Tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
            <small>Separate tags with commas.</small>
            <FieldError message={errors.tags} />
          </label>
        </div>
        <label className="task-check">
          <input
            type="checkbox"
            checked={v.inbox}
            onChange={(e) => patch("inbox", e.target.checked)}
          />
          Keep in Inbox for review
        </label>
        <section className="stack" aria-label="Subtasks">
          <div className="row between">
            <h3>Subtasks</h3>
            <button
              type="button"
              className="button"
              disabled={v.subtasks.length >= 100}
              onClick={() =>
                patch("subtasks", [
                  ...v.subtasks,
                  { id: crypto.randomUUID(), title: "", completed: false },
                ])
              }
            >
              Add subtask
            </button>
          </div>
          {v.subtasks.map((s, i) => (
            <div key={s.id} className="task-subtask">
              <input
                type="checkbox"
                aria-label={`Complete subtask ${i + 1}`}
                checked={s.completed}
                onChange={(e) =>
                  patch(
                    "subtasks",
                    v.subtasks.map((x) =>
                      x.id === s.id ? { ...x, completed: e.target.checked } : x,
                    ),
                  )
                }
              />
              <label className="sr-only" htmlFor={s.id}>
                Subtask {i + 1}
              </label>
              <input
                id={s.id}
                value={s.title}
                maxLength={160}
                aria-invalid={!!errors[`subtasks.${i}.title`]}
                onChange={(e) =>
                  patch(
                    "subtasks",
                    v.subtasks.map((x) =>
                      x.id === s.id ? { ...x, title: e.target.value } : x,
                    ),
                  )
                }
              />
              <button
                type="button"
                className="icon-button"
                aria-label={`Move subtask ${i + 1} up`}
                disabled={i === 0}
                onClick={() => {
                  const a = [...v.subtasks];
                  [a[i - 1], a[i]] = [a[i]!, a[i - 1]!];
                  patch("subtasks", a);
                }}
              >
                ↑
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove subtask ${i + 1}`}
                onClick={() =>
                  patch(
                    "subtasks",
                    v.subtasks.filter((x) => x.id !== s.id),
                  )
                }
              >
                ×
              </button>
              <FieldError message={errors[`subtasks.${i}.title`]} />
            </div>
          ))}
        </section>
        <div className="task-form-pair">
          <label>
            Repeat
            <select
              value={v.repeat?.frequency ?? "none"}
              disabled={!!task?.advanced}
              onChange={(e) => {
                patch(
                  "repeat",
                  e.target.value === "none"
                    ? null
                    : {
                        frequency: e.target.value as
                          "daily" | "weekly" | "monthly",
                        until: v.repeat?.until ?? null,
                      },
                );
                if (task?.recurrenceKey) setFuture(true);
              }}
            >
              {["none", "daily", "weekly", "monthly"].map((x) => (
                <option key={x} value={x}>
                  {x[0]!.toUpperCase() + x.slice(1)}
                </option>
              ))}
            </select>
          </label>
          {v.repeat && (
            <label>
              Repeat through (optional)
              <input
                type="date"
                disabled={!!task?.advanced}
                value={v.repeat.until ?? ""}
                onChange={(e) => {
                  patch("repeat", {
                    ...v.repeat!,
                    until: e.target.value || null,
                  });
                  if (task?.recurrenceKey) setFuture(true);
                }}
              />
            </label>
          )}
        </div>
        {v.repeat && (
          <p className="muted text-small">
            Completing or skipping this occurrence creates the next. Monthly
            tasks retain their original day where possible.
          </p>
        )}
        {task?.recurrenceKey && !task.advanced && (
          <label className="task-check">
            <input
              type="checkbox"
              checked={future}
              onChange={(e) => setFuture(e.target.checked)}
            />
            Apply changes to future occurrences; keep completed history
          </label>
        )}
        <button className="button primary" type="submit">
          {save.isPending
            ? "Saving…"
            : future
              ? "Save future occurrences"
              : task
                ? "Save task"
                : "Create task"}
        </button>
      </fieldset>
      <CommandError command={save} />
    </form>
  );
}
