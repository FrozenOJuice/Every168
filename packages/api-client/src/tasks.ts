import type {
  Page,
  Project,
  ProjectInput,
  Task,
  TaskDetail,
  TaskInput,
  TaskQuery,
  TaskStateInput,
  TaskTimeInput,
  TaskTime,
} from "@168hours/contracts";
import { body, query, writeHeaders, type Http } from "./http";
export function tasksClient(http: Http) {
  return {
    getTasks: (q: Partial<TaskQuery> & { date: string }) =>
      http<Page<Task>>("/api/v1/tasks" + query(q)),
    getTask: (id: string) => http<TaskDetail>(`/api/v1/tasks/${id}`),
    createTask: (v: TaskInput, key?: string) =>
      http<Task>("/api/v1/tasks", {
        method: "POST",
        headers: writeHeaders(key),
        body: body(v),
      }),
    saveTask: (
      id: string,
      v: TaskInput,
      version: number,
      key?: string,
      future = false,
    ) =>
      http<Task>(`/api/v1/tasks/${id}${future ? "/future" : ""}`, {
        method: "PUT",
        headers: writeHeaders(key, version),
        body: body(v),
      }),
    changeTask: (
      id: string,
      v: TaskStateInput,
      version: number,
      key?: string,
    ) =>
      http<Task>(`/api/v1/tasks/${id}/state`, {
        method: "PUT",
        headers: writeHeaders(key, version),
        body: body(v),
      }),
    duplicateTask: (id: string, version: number, key?: string) =>
      http<Task>(`/api/v1/tasks/${id}/duplicate`, {
        method: "POST",
        headers: writeHeaders(key, version),
        body: "{}",
      }),
    moveTask: (
      id: string,
      direction: "up" | "down",
      version: number,
      key?: string,
    ) =>
      http<Task>(`/api/v1/tasks/${id}/move`, {
        method: "POST",
        headers: writeHeaders(key, version),
        body: body({ direction }),
      }),
    deleteTask: (id: string, version: number, key?: string) =>
      http<{ ok: true }>(`/api/v1/tasks/${id}`, {
        method: "DELETE",
        headers: writeHeaders(key, version),
        body: "{}",
      }),
    scheduleTask: (
      id: string,
      v: TaskTimeInput,
      version: number,
      key?: string,
    ) =>
      http<unknown>(`/api/v1/tasks/${id}/schedules`, {
        method: "POST",
        headers: writeHeaders(key, version),
        body: body(v),
      }),
    unscheduleTask: (id: string, version: number, key?: string) =>
      http<unknown>(`/api/v1/task-schedules/${id}`, {
        method: "DELETE",
        headers: writeHeaders(key, version),
        body: "{}",
      }),
    logTaskTime: (
      id: string,
      v: TaskTimeInput,
      version: number,
      key?: string,
    ) =>
      http<TaskTime>(`/api/v1/tasks/${id}/times`, {
        method: "POST",
        headers: writeHeaders(key, version),
        body: body(v),
      }),
    saveTaskTime: (
      id: string,
      v: TaskTimeInput,
      version: number,
      key?: string,
    ) =>
      http<TaskTime>(`/api/v1/task-times/${id}`, {
        method: "PUT",
        headers: writeHeaders(key, version),
        body: body(v),
      }),
    deleteTaskTime: (id: string, version: number, key?: string) =>
      http<unknown>(`/api/v1/task-times/${id}`, {
        method: "DELETE",
        headers: writeHeaders(key, version),
        body: "{}",
      }),
    getTaskDayLinks: (date: string) =>
      http<{ blockIds: string[] }>("/api/v1/tasks/day-links" + query({ date })),
    getTaskForTime: (id: string) =>
      http<{ taskId: string }>(`/api/v1/tasks/for-time/${id}`),
    getTaskForBlock: (id: string) =>
      http<{ taskId: string | null }>(`/api/v1/tasks/for-block/${id}`),
    getTaskProjects: (cursor?: string) =>
      http<Page<Project>>("/api/v1/task-projects" + query({ cursor })),
    getTaskProject: (id: string) =>
      http<Omit<Project, "taskCount" | "completedCount">>(
        `/api/v1/task-projects/${id}`,
      ),
    createTaskProject: (v: ProjectInput, key?: string) =>
      http<Omit<Project, "taskCount" | "completedCount">>(
        "/api/v1/task-projects",
        {
          method: "POST",
          headers: writeHeaders(key),
          body: body(v),
        },
      ),
    saveTaskProject: (
      id: string,
      v: ProjectInput,
      version: number,
      key?: string,
    ) =>
      http<Omit<Project, "taskCount" | "completedCount">>(
        `/api/v1/task-projects/${id}`,
        {
          method: "PUT",
          headers: writeHeaders(key, version),
          body: body(v),
        },
      ),
    deleteTaskProject: (id: string, version: number, key?: string) =>
      http<unknown>(`/api/v1/task-projects/${id}`, {
        method: "DELETE",
        headers: writeHeaders(key, version),
        body: "{}",
      }),
  };
}
