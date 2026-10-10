import type { CalendarActivityService } from "./calendar-activity.service.js";
import { Router } from "express";
import { z } from "zod";
import {
  blockInput,
  calendarItemInput,
  calendarRangeQuery,
  calendarSearchQuery,
  copyInput,
  copyUndoInput,
  dateSchema,
  idSchema,
  pageQuerySchema,
  seriesInput,
  templateApplyInput,
  templateCaptureInput,
  templateRenameInput,
} from "@168hours/contracts";
import { currentUser } from "../../shared/auth/middleware.js";
import { mutation, emptyInput } from "../../shared/http/mutation.js";
import type { WritesService } from "../../infrastructure/writes/writes.service.js";
import type { CalendarItemsService } from "./calendar-items.service.js";
import type { SeriesService } from "./series.service.js";
import type { TemplatesService } from "./templates.service.js";
import type { CalendarSearchService } from "./calendar-search.service.js";
export function calendarRoutes(
  items: CalendarItemsService,
  series: SeriesService,
  templates: TemplatesService,
  search: CalendarSearchService,
  writes: WritesService,
  activity: CalendarActivityService,
) {
  const r = Router();
  r.get("/calendar/activity", async (req, res) => {
    const q = calendarRangeQuery.parse(req.query);
    res.json(await activity.range(currentUser(res).id, q.from, q.to));
  });
  r.get("/calendar/search", async (req, res) =>
    res.json(
      await search.search(
        currentUser(res).id,
        calendarSearchQuery.parse(req.query),
      ),
    ),
  );
  r.get("/calendar/items", async (req, res) => {
    const q = calendarRangeQuery.parse(req.query);
    res.json(await items.range(currentUser(res).id, q.from, q.to));
  });
  r.get("/calendar/backlog", async (req, res) =>
    res.json(
      await items.backlog(
        currentUser(res).id,
        pageQuerySchema.parse(req.query),
      ),
    ),
  );
  r.get("/calendar/items/:id", async (req, res) =>
    res.json(
      await items.get(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  r.post(
    "/calendar/items",
    mutation(
      writes,
      calendarItemInput,
      ({ userId, input, context }) => items.create(userId, input, context),
      { status: 201 },
    ),
  );
  r.put(
    "/calendar/items/:id",
    mutation(
      writes,
      calendarItemInput,
      ({ userId, id, input, version, context }) =>
        items.update(userId, id, input, version, context),
      { versioned: true },
    ),
  );
  r.delete(
    "/calendar/items/:id",
    mutation(
      writes,
      emptyInput,
      ({ userId, id, version, context }) =>
        items.remove(userId, id, version, context),
      { versioned: true },
    ),
  );
  r.post(
    "/calendar/items/:id/schedule",
    mutation(
      writes,
      blockInput,
      ({ userId, id, input, version, context }) =>
        items.schedule(userId, id, input, version, context),
      { versioned: true, status: 201 },
    ),
  );
  r.get("/calendar/series/:id", async (req, res) =>
    res.json(
      await series.get(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  r.post(
    "/calendar/series",
    mutation(
      writes,
      seriesInput,
      ({ userId, input, context }) => series.create(userId, input, context),
      { status: 201 },
    ),
  );
  r.put(
    "/calendar/series/:id",
    mutation(
      writes,
      seriesInput,
      ({ userId, id, input, version, context }) =>
        series.update(userId, id, input, version, context),
      { versioned: true },
    ),
  );
  r.delete(
    "/calendar/series/:id",
    mutation(
      writes,
      emptyInput,
      ({ userId, id, version, context }) =>
        series.remove(userId, id, version, context),
      { versioned: true },
    ),
  );
  r.get("/calendar/copy-preview", async (req, res) =>
    res.json(
      await templates.copyPreview(
        currentUser(res).id,
        copyInput.parse(req.query),
      ),
    ),
  );
  r.post(
    "/calendar/copy",
    mutation(
      writes,
      copyInput.extend({ token: z.string().regex(/^[a-f0-9]{64}$/) }),
      ({ userId, input, context }) => {
        const { token, ...v } = input;
        return templates.copy(userId, v, token, context);
      },
      { status: 201 },
    ),
  );
  r.post(
    "/calendar/copy/undo",
    mutation(writes, copyUndoInput, ({ userId, input, context }) =>
      templates.undoCopy(userId, input, context),
    ),
  );
  r.get("/calendar/templates", async (req, res) =>
    res.json(
      await templates.list(
        currentUser(res).id,
        pageQuerySchema.parse(req.query),
      ),
    ),
  );
  r.get("/calendar/templates/:id", async (req, res) =>
    res.json(
      await templates.get(currentUser(res).id, idSchema.parse(req.params.id)),
    ),
  );
  r.get("/calendar/templates/:id/preview", async (req, res) =>
    res.json(
      await templates.preview(
        currentUser(res).id,
        idSchema.parse(req.params.id),
        dateSchema.parse(req.query.targetDate),
        z.coerce
          .number()
          .int()
          .min(1)
          .max(52)
          .parse(req.query.cycles ?? 1),
      ),
    ),
  );
  r.post(
    "/calendar/templates",
    mutation(
      writes,
      templateCaptureInput,
      ({ userId, input, context }) => templates.capture(userId, input, context),
      { status: 201 },
    ),
  );
  r.put(
    "/calendar/templates/:id",
    mutation(
      writes,
      templateRenameInput,
      ({ userId, id, input, version, context }) =>
        templates.rename(userId, id, input.name, version, context),
      { versioned: true },
    ),
  );
  r.delete(
    "/calendar/templates/:id",
    mutation(
      writes,
      emptyInput,
      ({ userId, id, version, context }) =>
        templates.remove(userId, id, version, context),
      { versioned: true },
    ),
  );
  r.post(
    "/calendar/templates/:id/apply",
    mutation(
      writes,
      templateApplyInput,
      ({ userId, id, input, version, context }) =>
        templates.apply(
          userId,
          id,
          input.targetDate,
          input.cycles,
          version,
          input.preferencesVersion,
          context,
        ),
      { versioned: true, status: 201 },
    ),
  );
  return r;
}
