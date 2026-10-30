"use client";
import { useConfirm } from "@/components/ui/confirmation-provider";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  idSchema,
  taskInput,
  type Task,
  type TaskInput,
  type TaskQuery,
  type Project,
} from "@168hours/contracts";
import { useDomainDay } from "@/features/workspace/domain-day-context";
import { DomainDayPanel } from "@/features/workspace/domain-day-panel";
import { Dialog } from "@/components/ui/dialog";
import { Loading, ErrorState, Empty } from "@/components/ui/feedback";
import { RoutinesPage } from "@/features/routines/routines-page";
import { api } from "@/lib/api";
import { useCommand, CommandError } from "@/lib/use-command";
import { canNavigateAway, useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { formatDate } from "@/lib/format";
import { TaskDialog, invalidateTasks } from "./tasks-shared";
import { TaskEditor } from "./task-editor";
import { TaskDetail } from "./task-detail";
import { ProjectEditor } from "./project-editor";
const views = [
  ["inbox", "Inbox"],
  ["today", "Today"],
  ["upcoming", "Upcoming"],
  ["all", "All tasks"],
  ["projects", "Projects"],
  ["routines", "Routines"],
] as const;
export function TasksPage() {
  const confirm = useConfirm();

  const params = useSearchParams(),
    router = useRouter(),
    cache = useQueryClient();
  const { date, selectDate } = useDomainDay();
  const view =
    views.find(([key]) => key === params.get("view"))?.[0] ?? "inbox";
  const selected = idSchema.safeParse(params.get("task"));
  const taskId = selected.success ? selected.data : null;
  const projectParsed = idSchema.safeParse(params.get("project"));
  const projectId = projectParsed.success ? projectParsed.data : undefined;
  const [dayBusy, setDayBusy] = useState(false);
  const [dayOpen, setDayOpen] = useState(false),
    [creating, setCreating] = useState(false),
    [projectEditor, setProjectEditor] = useState<
      Omit<Project, "taskCount" | "completedCount"> | "new" | null
    >(null);
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState<TaskQuery["status"]>(
      params.get("status") === "all" ? "all" : "active",
    ),
    [archived, setArchived] = useState(false),
    [priority, setPriority] = useState<TaskQuery["priority"]>(),
    [tag, setTag] = useState("");
  const href = (changes: Record<string, string | null>) => {
    const q = new URLSearchParams(params.toString());
    q.set("date", date);
    for (const [k, v] of Object.entries(changes))
      if (v === null) q.delete(k);
      else q.set(k, v);
    return "/tasks?" + q;
  };
  const changed = () => void invalidateTasks(cache);
  const projects = useInfiniteQuery({
    queryKey: ["tasks", "projects"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.getTaskProjects(pageParam),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
    enabled: view === "projects",
  });
  const project = useQuery({
    queryKey: ["tasks", "project", projectId],
    queryFn: () => api.getTaskProject(projectId!),
    enabled: !!projectId,
  });
  const query: Omit<TaskQuery, "cursor" | "limit"> = {
    view: projectId
      ? "all"
      : view === "projects" || view === "routines"
        ? "all"
        : view,
    date,
    q: search,
    status,
    archived: archived ? "true" : "false",
    projectId,
    priority,
    tag: tag || undefined,
  };
  const tasks = useInfiniteQuery({
    queryKey: ["tasks", "list", query],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.getTasks({ ...query, cursor: pageParam, limit: 30 }),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
    enabled: view !== "routines" && (view !== "projects" || !!projectId),
  });
  const rows = tasks.data?.pages.flatMap((p) => p.items) ?? [];
  const dayLinks = useQuery({
    queryKey: ["tasks", "day-links", date],
    queryFn: () => api.getTaskDayLinks(date),
  });
  const panel = (
    <DomainDayPanel
      domain="Tasks"
      onBusyChange={setDayBusy}
      sources={["task", "task_time", "task_completion"]}
      sourceLabels={["Tasks"]}
      date={date}
      onDate={selectDate}
      plans={{
        blockIds: dayLinks.data?.blockIds ?? [],
        pending: dayLinks.isPending,
        error: dayLinks.error,
        retry: () => void dayLinks.refetch(),
      }}
      onActivity={async (a) => {
        if (!(await canNavigateAway())) return;
        setDayOpen(false);
        router.push(a.href);
      }}
      onCalendar={async () => {
        if (!(await canNavigateAway())) return;
        setDayOpen(false);
        router.push(`/?date=${date}&view=day`);
      }}
      action={{
        label: "Add task",
        onClick: () => {
          setDayOpen(false);
          setCreating(true);
        },
      }}
    />
  );
  const removeProject = useCommand({
    mutationFn: (_: void, key: string) =>
      api.deleteTaskProject(project.data!.id, project.data!.version, key),
    onSuccess: () => {
      changed();
      router.push(href({ project: null }));
    },
  });
  return (
    <div className="tasks-workspace domain-workspace">
      <div className="tasks-main domain-main">
        <h1 className="sr-only">Tasks</h1>
        <div className="domain-workspace-tools">
          <nav className="tasks-nav" aria-label="Tasks views">
            {views.map(([key, label]) => (
              <Link
                key={key}
                aria-current={view === key ? "page" : undefined}
                href={href({ view: key, project: null, task: null })}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="domain-workspace-actions">
            <button
              className="button domain-mobile-day"
              onClick={() => setDayOpen(true)}
            >
              <CalendarDays size={17} aria-hidden="true" />
              Day
            </button>
            <button
              className="button primary"
              onClick={() => setCreating(true)}
            >
              <Plus size={17} aria-hidden="true" />
              New task
            </button>
          </div>
        </div>
        <div className="tasks-content">
          {view === "routines" ? (
            <RoutinesPage embedded />
          ) : view === "projects" && !projectId ? (
            <>
              <div className="row between">
                <h2>Projects</h2>
                <button
                  className="button"
                  onClick={() => setProjectEditor("new")}
                >
                  Create project
                </button>
              </div>
              <p className="muted">
                Bring related tasks together around something you want to
                finish.
              </p>
              {projects.isPending ? (
                <Loading />
              ) : projects.error ? (
                <ErrorState
                  error={projects.error}
                  retry={() => void projects.refetch()}
                />
              ) : (
                <>
                  <div className="tasks-project-grid">
                    {projects.data.pages
                      .flatMap((p) => p.items)
                      .map((p) => (
                        <Link
                          className="tasks-project-card"
                          key={p.id}
                          href={href({ project: p.id })}
                        >
                          <small>{p.status}</small>
                          <h3>{p.name}</h3>
                          {p.description && <p>{p.description}</p>}
                          <p>
                            {p.completedCount} of {p.taskCount} tasks completed
                          </p>
                          {p.targetDate && (
                            <small>Target {formatDate(p.targetDate)}</small>
                          )}
                        </Link>
                      ))}
                  </div>
                  {projects.data.pages[0]!.items.length === 0 && (
                    <Empty>
                      No projects yet. Create one when several tasks belong
                      together.
                    </Empty>
                  )}
                  {projects.hasNextPage && (
                    <button
                      className="button"
                      disabled={projects.isFetchingNextPage}
                      onClick={() => void projects.fetchNextPage()}
                    >
                      Load more projects
                    </button>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              {projectId ? (
                project.isPending ? (
                  <Loading />
                ) : project.error ? (
                  <ErrorState
                    error={project.error}
                    retry={() => void project.refetch()}
                  />
                ) : (
                  <>
                    <Link href={href({ project: null })}>← Projects</Link>
                    <div className="row between">
                      <h2>{project.data.name}</h2>
                      <button
                        className="button"
                        onClick={() => setProjectEditor(project.data)}
                      >
                        Edit project
                      </button>
                    </div>
                    {project.data.description && (
                      <p className="task-notes">{project.data.description}</p>
                    )}
                    <p className="muted">
                      {project.data.status}
                      {project.data.targetDate
                        ? ` · Target ${formatDate(project.data.targetDate)}`
                        : ""}
                    </p>
                  </>
                )
              ) : (
                <div>
                  <p className="tasks-eyebrow">
                    {view === "today" || view === "upcoming"
                      ? formatDate(date, {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        })
                      : "Capture, choose, make time"}
                  </p>
                  <h2>{views.find(([key]) => key === view)?.[1]}</h2>
                  {view === "today" && (
                    <p className="muted">
                      Planned or due by this day, plus scheduled work. Overdue
                      tasks stay visible.
                    </p>
                  )}
                </div>
              )}
              <QuickCapture
                initial={{
                  inbox: view === "inbox",
                  plannedDate: view === "today" ? date : null,
                  projectId: projectId ?? null,
                }}
                onSaved={changed}
              />
              <details className="tasks-filters">
                <summary>Search and filters</summary>
                <div className="tasks-filter-grid">
                  <label>
                    Search tasks
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <label>
                    Task status
                    <select
                      value={status}
                      onChange={(e) =>
                        setStatus(e.target.value as TaskQuery["status"])
                      }
                    >
                      <option value="active">To do and in progress</option>
                      <option value="done">Completed</option>
                      <option value="skipped">Skipped</option>
                      <option value="all">All statuses</option>
                    </select>
                  </label>
                  <label>
                    Priority filter
                    <select
                      value={priority ?? ""}
                      onChange={(e) =>
                        setPriority(
                          (e.target.value ||
                            undefined) as TaskQuery["priority"],
                        )
                      }
                    >
                      <option value="">All priorities</option>
                      {["none", "low", "medium", "high"].map((x) => (
                        <option value={x} key={x}>
                          {x}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Filter by tag
                    <input
                      value={tag}
                      onChange={(e) => setTag(e.target.value.toLowerCase())}
                    />
                  </label>
                  <label className="task-check">
                    <input
                      type="checkbox"
                      checked={archived}
                      onChange={(e) => setArchived(e.target.checked)}
                    />
                    Archived tasks
                  </label>
                </div>
              </details>
              {tasks.isPending ? (
                <Loading />
              ) : tasks.error ? (
                <ErrorState
                  error={tasks.error}
                  retry={() => void tasks.refetch()}
                />
              ) : (
                <>
                  {rows.length === 0 ? (
                    <Empty>
                      No matching tasks. Capture something above or adjust your
                      filters.
                    </Empty>
                  ) : projectId && project.data ? (
                    <>
                      {[null, ...project.data.sections].map((section) => {
                        const items = rows.filter(
                          (t) => t.sectionId === (section?.id ?? null),
                        );
                        return (
                          <section
                            key={section?.id ?? "none"}
                            className="task-project-section"
                          >
                            <h3>{section?.title ?? "Tasks"}</h3>
                            <TaskList
                              tasks={items}
                              date={date}
                              ordered
                              href={(id) => href({ task: id })}
                              onChanged={changed}
                            />
                          </section>
                        );
                      })}
                    </>
                  ) : (
                    <TaskList
                      tasks={rows}
                      date={date}
                      href={(id) => href({ task: id })}
                      onChanged={changed}
                    />
                  )}
                  {tasks.hasNextPage && (
                    <button
                      className="button"
                      disabled={tasks.isFetchingNextPage}
                      onClick={() => void tasks.fetchNextPage()}
                    >
                      Load more tasks
                    </button>
                  )}
                </>
              )}
              {projectId && project.data && (
                <details className="tasks-project-delete">
                  <summary>Project actions</summary>
                  <p>
                    Deleting this project keeps its tasks as standalone tasks.
                  </p>
                  <button
                    disabled={removeProject.isPending}
                    className="button danger"
                    onClick={async () => {
                      if (
                        await confirm("Delete this project and keep its tasks?")
                      )
                        removeProject.mutate();
                    }}
                  >
                    Delete project
                  </button>
                  <CommandError command={removeProject} />
                </details>
              )}
            </>
          )}
        </div>
      </div>
      <aside className="domain-calendar-rail" aria-label="Tasks day panel">
        {panel}
      </aside>
      {dayOpen && (
        <Dialog
          title="Your day"
          busy={dayBusy}
          onClose={() => setDayOpen(false)}
        >
          {panel}
        </Dialog>
      )}
      {creating && (
        <TaskDialog title="Create task" onClose={() => setCreating(false)}>
          <TaskEditor
            initial={{
              inbox: view === "inbox",
              plannedDate: view === "today" ? date : null,
              projectId: projectId ?? null,
            }}
            onSaved={() => {
              setCreating(false);
              changed();
            }}
          />
        </TaskDialog>
      )}
      {taskId && (
        <TaskDialog
          title="Task details"
          onClose={() => router.push(href({ task: null }))}
        >
          <TaskDetail
            id={taskId}
            date={date}
            onChanged={changed}
            onClose={() => router.push(href({ task: null }))}
          />
        </TaskDialog>
      )}
      {projectEditor && (
        <TaskDialog
          title={projectEditor === "new" ? "Create project" : "Edit project"}
          onClose={() => setProjectEditor(null)}
        >
          <ProjectEditor
            project={projectEditor === "new" ? undefined : projectEditor}
            onSaved={() => {
              setProjectEditor(null);
              changed();
            }}
          />
        </TaskDialog>
      )}
    </div>
  );
}
function QuickCapture({
  initial,
  onSaved,
}: {
  initial: Partial<TaskInput>;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const create = useCommand({
    mutationFn: (v: TaskInput, key: string) => api.createTask(v, key),
    onSuccess: () => {
      setTitle("");
      onSaved();
    },
  });
  useUnsavedChanges(
    !!title.trim() || create.isPending,
    "Your unsaved task capture will be discarded.",
    create.isPending,
  );
  return (
    <form
      className="tasks-capture"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = taskInput.safeParse({ title, ...initial });
        if (parsed.success) create.mutate(parsed.data);
      }}
    >
      <label htmlFor="capture-task" className="sr-only">
        Quick task title
      </label>
      <input
        id="capture-task"
        value={title}
        maxLength={160}
        required
        placeholder="What needs doing?"
        disabled={create.isPending}
        onChange={(e) => setTitle(e.target.value)}
      />
      <button
        className="button primary"
        disabled={create.isPending || !title.trim()}
      >
        {create.isPending ? "Adding…" : "Add task"}
      </button>
      <CommandError command={create} />
    </form>
  );
}
function TaskList({
  tasks,
  date,
  href,
  onChanged,
  ordered = false,
}: {
  tasks: Task[];
  date: string;
  href: (id: string) => string;
  onChanged: () => void;
  ordered?: boolean;
}) {
  return (
    <ul className="tasks-list">
      {tasks.map((t) => (
        <TaskRow
          key={`${t.id}:${t.version}`}
          task={t}
          date={date}
          href={href(t.id)}
          ordered={ordered}
          onChanged={onChanged}
        />
      ))}
    </ul>
  );
}
function TaskRow({
  task: t,
  date,
  href,
  ordered,
  onChanged,
}: {
  task: Task;
  date: string;
  href: string;
  ordered: boolean;
  onChanged: () => void;
}) {
  const command = useCommand({
    mutationFn: (direction: "up" | "down" | "complete", key: string) =>
      direction === "complete"
        ? api.changeTask(
            t.id,
            { status: t.status === "done" ? "todo" : "done" },
            t.version,
            key,
          )
        : api.moveTask(t.id, direction, t.version, key),
    onSuccess: onChanged,
  });
  return (
    <li className="tasks-row">
      <button
        className="icon-button task-complete"
        aria-label={`${t.status === "done" ? "Reopen" : "Complete"} ${t.title}`}
        disabled={command.isPending}
        onClick={() => command.mutate("complete")}
      >
        {t.status === "done" ? "✓" : "○"}
      </button>
      <Link href={href} className="tasks-row-content">
        <strong>{t.title}</strong>
        <span>
          {t.status === "in_progress" ? "In progress · " : ""}
          {t.dueDate
            ? `${t.dueDate < date && t.status !== "done" ? "Overdue · " : ""}Due ${formatDate(t.dueDate)} · `
            : ""}
          {t.plannedDate ? `Planned ${formatDate(t.plannedDate)} · ` : ""}
          {t.priority !== "none" ? `${t.priority} priority · ` : ""}
          {t.subtasks.length
            ? `${t.subtasks.filter((s) => s.completed).length}/${t.subtasks.length} subtasks · `
            : ""}
          {t.repeat ? `Repeats ${t.repeat.frequency}` : ""}
        </span>
        {t.tags.length > 0 && <small>{t.tags.join(" · ")}</small>}
      </Link>
      {ordered && (
        <div>
          <button
            disabled={command.isPending}
            className="icon-button"
            aria-label={`Move ${t.title} up`}
            onClick={() => command.mutate("up")}
          >
            ↑
          </button>
          <button
            disabled={command.isPending}
            className="icon-button"
            aria-label={`Move ${t.title} down`}
            onClick={() => command.mutate("down")}
          >
            ↓
          </button>
        </div>
      )}
      <CommandError command={command} />
    </li>
  );
}
