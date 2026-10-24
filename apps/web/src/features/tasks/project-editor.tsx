"use client";
import { useRef, useState } from "react";
import {
  projectInput,
  type ProjectInput,
  type Project,
} from "@168hours/contracts";
import { api } from "@/lib/api";
import { CommandError, useCommand } from "@/lib/use-command";
import { FieldError, useTaskForm } from "./tasks-shared";
export function ProjectEditor({
  project,
  onSaved,
}: {
  project?: Omit<Project, "taskCount" | "completedCount">;
  onSaved: () => void;
}) {
  const [v, setV] = useState<ProjectInput>({
    name: project?.name ?? "",
    description: project?.description ?? null,
    targetDate: project?.targetDate ?? null,
    status: project?.status ?? "active",
    sections: project?.sections ?? [],
  });
  const [baseline] = useState(() => JSON.stringify(v));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const form = useRef<HTMLFormElement>(null);
  const save = useCommand({
    mutationFn: (value: ProjectInput, key: string) =>
      project
        ? api.saveTaskProject(project.id, value, project.version, key)
        : api.createTaskProject(value, key),
    onSuccess: onSaved,
  });
  useTaskForm(JSON.stringify(v) !== baseline, save.isPending);
  return (
    <form
      ref={form}
      className="stack task-form"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = projectInput.safeParse(v);
        if (!parsed.success) {
          setErrors(
            Object.fromEntries(
              parsed.error.issues.map((x) => [x.path.join("."), x.message]),
            ),
          );
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
          Project name
          <input
            autoFocus
            value={v.name}
            maxLength={160}
            aria-invalid={!!errors.name}
            onChange={(e) => setV({ ...v, name: e.target.value })}
          />
          <FieldError message={errors.name} />
        </label>
        <label>
          Description
          <textarea
            value={v.description ?? ""}
            onChange={(e) =>
              setV({ ...v, description: e.target.value || null })
            }
            maxLength={4000}
          />
        </label>
        <div className="task-form-pair">
          <label>
            Target date
            <input
              type="date"
              value={v.targetDate ?? ""}
              onChange={(e) =>
                setV({ ...v, targetDate: e.target.value || null })
              }
            />
          </label>
          <label>
            Project status
            <select
              value={v.status}
              onChange={(e) =>
                setV({ ...v, status: e.target.value as ProjectInput["status"] })
              }
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </label>
        </div>
        <p className="muted text-small">
          Project status is your decision. Completing a project keeps its tasks
          and their individual statuses.
        </p>
        <section className="stack">
          <div className="row between">
            <h3>Sections</h3>
            <button
              type="button"
              className="button"
              disabled={v.sections.length >= 50}
              onClick={() =>
                setV({
                  ...v,
                  sections: [
                    ...v.sections,
                    { id: crypto.randomUUID(), title: "" },
                  ],
                })
              }
            >
              Add section
            </button>
          </div>
          {v.sections.map((s, i) => (
            <div className="task-section-editor" key={s.id}>
              <label>
                Section {i + 1}
                <input
                  value={s.title}
                  maxLength={160}
                  aria-invalid={!!errors[`sections.${i}.title`]}
                  onChange={(e) =>
                    setV({
                      ...v,
                      sections: v.sections.map((x) =>
                        x.id === s.id ? { ...x, title: e.target.value } : x,
                      ),
                    })
                  }
                />
                <FieldError message={errors[`sections.${i}.title`]} />
              </label>
              <button
                type="button"
                className="icon-button"
                aria-label={`Move section ${i + 1} up`}
                disabled={!i}
                onClick={() => {
                  const sections = [...v.sections];
                  [sections[i - 1], sections[i]] = [
                    sections[i]!,
                    sections[i - 1]!,
                  ];
                  setV({ ...v, sections });
                }}
              >
                ↑
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove section ${i + 1}`}
                onClick={() =>
                  setV({
                    ...v,
                    sections: v.sections.filter((x) => x.id !== s.id),
                  })
                }
              >
                ×
              </button>
            </div>
          ))}
        </section>
        <button type="submit" className="button primary">
          {save.isPending
            ? "Saving…"
            : project
              ? "Save project"
              : "Create project"}
        </button>
      </fieldset>
      <CommandError command={save} />
    </form>
  );
}
