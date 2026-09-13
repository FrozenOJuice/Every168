import type {
  Block,
  BlockInput,
  TimeEntry,
  CalendarItem,
  CalendarItemInput,
  CalendarSeries,
  SeriesInput,
  SeriesResult,
  CalendarSearchQuery,
  SearchRecord,
  Page,
  PageQuery,
  CopyInput,
  CopyPreview,
  TemplateCaptureInput,
  CalendarTemplate,
} from "@168hours/contracts";
import { body, query, writeHeaders, type Http } from "./http";
export function calendarClient(http: Http) {
  const root = "/api/v1/calendar";
  return {
    getTimeBlock: (id: string) => http<Block>("/api/v1/time-blocks/" + id),
    getTimeEntry: (id: string) => http<TimeEntry>("/api/v1/time-entries/" + id),
    getCalendarItems: (from: string, to: string) =>
      http<CalendarItem[]>(root + "/items" + query({ from, to })),
    getCalendarItem: (id: string) => http<CalendarItem>(root + "/items/" + id),
    getCalendarBacklog: (q: Partial<PageQuery> = {}) =>
      http<Page<CalendarItem>>(root + "/backlog" + query(q)),
    createCalendarItem: (v: CalendarItemInput, key?: string) =>
      http<CalendarItem>(root + "/items", {
        method: "POST",
        body: body(v),
        headers: writeHeaders(key),
      }),
    updateCalendarItem: (
      id: string,
      v: CalendarItemInput,
      version: number,
      key?: string,
    ) =>
      http<CalendarItem>(root + "/items/" + id, {
        method: "PUT",
        body: body(v),
        headers: writeHeaders(key, version),
      }),
    deleteCalendarItem: (id: string, version: number, key?: string) =>
      http<{ ok: true }>(root + "/items/" + id, {
        method: "DELETE",
        headers: writeHeaders(key, version),
      }),
    scheduleCalendarItem: (
      id: string,
      v: BlockInput,
      version: number,
      key?: string,
    ) =>
      http<Block>(root + "/items/" + id + "/schedule", {
        method: "POST",
        body: body(v),
        headers: writeHeaders(key, version),
      }),
    getCalendarSeries: (id: string) =>
      http<CalendarSeries>(root + "/series/" + id),
    createCalendarSeries: (v: SeriesInput, key?: string) =>
      http<SeriesResult>(root + "/series", {
        method: "POST",
        body: body(v),
        headers: writeHeaders(key),
      }),
    updateCalendarSeries: (
      id: string,
      v: SeriesInput,
      version: number,
      key?: string,
    ) =>
      http<SeriesResult>(root + "/series/" + id, {
        method: "PUT",
        body: body(v),
        headers: writeHeaders(key, version),
      }),
    deleteCalendarSeries: (id: string, version: number, key?: string) =>
      http<{ ok: true }>(root + "/series/" + id, {
        method: "DELETE",
        headers: writeHeaders(key, version),
      }),
    searchCalendar: (q: Partial<CalendarSearchQuery>) =>
      http<Page<SearchRecord>>(root + "/search" + query(q)),
    previewCalendarCopy: (v: CopyInput) =>
      http<CopyPreview & { token: string }>(root + "/copy-preview" + query(v)),
    copyCalendar: (v: CopyInput & { token: string }, key?: string) =>
      http<{ count: number; targetDate: string }>(root + "/copy", {
        method: "POST",
        body: body(v),
        headers: writeHeaders(key),
      }),
    getCalendarTemplates: (q: Partial<PageQuery> = {}) =>
      http<Page<Omit<CalendarTemplate, "entries">>>(
        root + "/templates" + query(q),
      ),
    getCalendarTemplate: (id: string) =>
      http<CalendarTemplate>(root + "/templates/" + id),
    captureCalendarTemplate: (v: TemplateCaptureInput, key?: string) =>
      http<CalendarTemplate>(root + "/templates", {
        method: "POST",
        body: body(v),
        headers: writeHeaders(key),
      }),
    renameCalendarTemplate: (
      id: string,
      name: string,
      version: number,
      key?: string,
    ) =>
      http<Omit<CalendarTemplate, "entries">>(root + "/templates/" + id, {
        method: "PUT",
        body: body({ name }),
        headers: writeHeaders(key, version),
      }),
    deleteCalendarTemplate: (id: string, version: number, key?: string) =>
      http<{ ok: true }>(root + "/templates/" + id, {
        method: "DELETE",
        headers: writeHeaders(key, version),
      }),
    previewCalendarTemplate: (id: string, targetDate: string) =>
      http<CopyPreview & { version: number; preferencesVersion: number }>(
        root + "/templates/" + id + "/preview" + query({ targetDate }),
      ),
    applyCalendarTemplate: (
      id: string,
      targetDate: string,
      version: number,
      preferencesVersion: number,
      key?: string,
    ) =>
      http<{ count: number; targetDate: string }>(
        root + "/templates/" + id + "/apply",
        {
          method: "POST",
          body: body({ targetDate, preferencesVersion }),
          headers: writeHeaders(key, version),
        },
      ),
  };
}
