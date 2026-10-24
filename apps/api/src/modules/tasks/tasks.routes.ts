import { Router } from "express";
import { z } from "zod";
import {
  dateSchema,
  idSchema,
  projectInput,
  taskInput,
  taskMoveInput,
  taskStateInput,
  taskTimeInput,
  tasksQuery,
} from "@168hours/contracts";
import { currentUser } from "../../shared/auth/middleware.js";
import { emptyInput, mutation } from "../../shared/http/mutation.js";
import type { WritesService } from "../../infrastructure/writes/writes.service.js";
import type { TasksService } from "./tasks.service.js";
export function tasksRoutes(service: TasksService, writes: WritesService) {
  const r = Router();
  r.get("/tasks", async (req, res) =>
    res.json(
      await service.list(currentUser(res).id, tasksQuery.parse(req.query)),
    ),
  );
  r.get("/tasks/day-links", async (req, res) =>
    res.json(
      await service.dayLinks(
        currentUser(res).id,
        dateSchema.parse(req.query.date),
      ),
    ),
  );
  r.get("/tasks/for-block/:id", async (req, res) =>
    res.json({
      taskId: await service.forBlock(
        currentUser(res).id,
        idSchema.parse(req.params.id),
      ),
    }),
  );
  r.get("/tasks/for-time/:id", async (req, res) =>
    res.json(
      await service.forTime(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  r.get("/tasks/:id", async (req, res) =>
    res.json(
      await service.get(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  r.post(
    "/tasks",
    mutation(
      writes,
      taskInput,
      ({ userId, input, context }) => service.create(userId, input, context),
      { status: 201 },
    ),
  );
  r.put(
    "/tasks/:id",
    mutation(
      writes,
      taskInput,
      ({ userId, id, input, version, context }) =>
        service.update(userId, id, input, version, context),
      { versioned: true },
    ),
  );
  r.put(
    "/tasks/:id/future",
    mutation(
      writes,
      taskInput,
      ({ userId, id, input, version, context }) =>
        service.update(userId, id, input, version, context, true),
      { versioned: true },
    ),
  );
  r.put(
    "/tasks/:id/state",
    mutation(
      writes,
      taskStateInput,
      ({ userId, id, input, version, context }) =>
        service.state(userId, id, input, version, context),
      { versioned: true },
    ),
  );
  r.post(
    "/tasks/:id/duplicate",
    mutation(
      writes,
      emptyInput,
      ({ userId, id, version, context }) =>
        service.duplicate(userId, id, version, context),
      { versioned: true, status: 201 },
    ),
  );
  r.post(
    "/tasks/:id/move",
    mutation(
      writes,
      taskMoveInput,
      ({ userId, id, input, version, context }) =>
        service.move(userId, id, input.direction, version, context),
      { versioned: true },
    ),
  );
  r.delete(
    "/tasks/:id",
    mutation(
      writes,
      emptyInput,
      ({ userId, id, version, context }) =>
        service.remove(userId, id, version, context),
      { versioned: true },
    ),
  );
  r.post(
    "/tasks/:id/schedules",
    mutation(
      writes,
      taskTimeInput,
      ({ userId, id, input, version, context }) =>
        service.schedule(userId, id, input, version, context),
      { versioned: true, status: 201 },
    ),
  );
  r.delete(
    "/task-schedules/:id",
    mutation(
      writes,
      emptyInput,
      ({ userId, id, version, context }) =>
        service.unschedule(userId, id, version, context),
      { versioned: true },
    ),
  );
  r.post(
    "/tasks/:id/times",
    mutation(
      writes,
      taskTimeInput,
      ({ userId, id, input, version, context }) =>
        service.logTime(userId, id, input, version, context),
      { versioned: true, status: 201 },
    ),
  );
  r.put(
    "/task-times/:id",
    mutation(
      writes,
      taskTimeInput,
      ({ userId, id, input, version, context }) =>
        service.updateTime(userId, id, input, version, context),
      { versioned: true },
    ),
  );
  r.delete(
    "/task-times/:id",
    mutation(
      writes,
      emptyInput,
      ({ userId, id, version, context }) =>
        service.removeTime(userId, id, version, context),
      { versioned: true },
    ),
  );
  r.get("/task-projects", async (req, res) =>
    res.json(
      await service.projects(
        currentUser(res).id,
        z.string().optional().parse(req.query.cursor),
      ),
    ),
  );
  r.get("/task-projects/:id", async (req, res) =>
    res.json(
      await service.project(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  r.post(
    "/task-projects",
    mutation(
      writes,
      projectInput,
      ({ userId, input, context }) =>
        service.createProject(userId, input, context),
      { status: 201 },
    ),
  );
  r.put(
    "/task-projects/:id",
    mutation(
      writes,
      projectInput,
      ({ userId, id, input, version, context }) =>
        service.updateProject(userId, id, input, version, context),
      { versioned: true },
    ),
  );
  r.delete(
    "/task-projects/:id",
    mutation(
      writes,
      emptyInput,
      ({ userId, id, version, context }) =>
        service.removeProject(userId, id, version, context),
      { versioned: true },
    ),
  );
  return r;
}
