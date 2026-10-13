import type {
  CalendarActivityResult,
  Block,
  BlockInput,
  TimeEntry,
  CalendarItem,
  CalendarItemInput,
  CalendarSeries,
  SeriesInput,
  SeriesResult,
  SeriesUndoInput,
  SeriesUndoResult,
  CalendarSearchQuery,
  SearchRecord,
  Page,
  PageQuery,
  CopyInput,
  CopyUndoInput,
  CopyPreview,
  SnapshotPasteInput,
  GroupDeleteInput,
  GroupDeleteUndoInput,
  TemplateCaptureInput,
  CalendarTemplate,
} from "@168hours/contracts";
import { body, query, writeHeaders, type Http } from "./http";
export function calendarClient(http: Http) {
  const root = "/api/v1/calendar";
  return {
    getCalendarActivity: (from: string, to: string) =>
      http<CalendarActivityResult>(root + "/activity" + query({ from, to })),
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
      http<{ ok: true; undoId: string }>(root + "/series/" + id, {
        method: "DELETE",
        headers: writeHeaders(key, version),
      }),
    undoCalendarSeries: (v: SeriesUndoInput, key?: string) =>
      http<SeriesUndoResult>(root + "/series/undo", {
        method: "POST",
        body: body(v),
        headers: writeHeaders(key),
      }),
    searchCalendar: (q: Partial<CalendarSearchQuery>) =>
      http<Page<SearchRecord>>(root + "/search" + query(q)),
    previewCalendarCopy: (v: CopyInput) =>
      http<CopyPreview & { token: string }>(root + "/copy-preview" + query(v)),
    copyCalendar: (v: CopyInput & { token: string }, key?: string) =>
      http<{
        count: number;
        targetDate: string;
        createdBlocks: { id: string; version: number; title: string }[];
        createdItems: { id: string; version: number }[];
      }>(root + "/copy", {
        method: "POST",
        body: body(v),
        headers: writeHeaders(key),
      }),
    previewCalendarSnapshotPaste: (v: SnapshotPasteInput) =>
      http<CopyPreview & { token: string }>(root + "/snapshot-preview", {
        method: "POST",
        body: body(v),
      }),
    pasteCalendarSnapshot: (
      v: SnapshotPasteInput & { token: string },
      key?: string,
    ) =>
      http<{
        count: number;
        targetDate: string;
        createdBlocks: { id: string; version: number; title: string }[];
        createdItems: { id: string; version: number }[];
      }>(root + "/snapshot-copy", {
        method: "POST",
        body: body(v),
        headers: writeHeaders(key),
      }),
    undoCalendarCopy: (v: CopyUndoInput, key?: string) =>
      http<{ ok: true }>(root + "/copy/undo", {
        method: "POST",
        body: body(v),
        headers: writeHeaders(key),
      }),
    deleteCalendarSelection: (v: GroupDeleteInput, key?: string) =>
      http<{ ok: true; undoId: string }>(root + "/selection/delete", {
        method: "POST",
        body: body(v),
        headers: writeHeaders(key),
      }),
    undoCalendarSelectionDelete: (v: GroupDeleteUndoInput, key?: string) =>
      http<{
        ok: true;
        blocks: { id: string; version: number }[];
        items: { id: string; version: number }[];
      }>(root + "/selection/delete/undo", {
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
    previewCalendarTemplate: (id: string, targetDate: string, cycles = 1) =>
      http<CopyPreview & { version: number; preferencesVersion: number }>(
        root + "/templates/" + id + "/preview" + query({ targetDate, cycles }),
      ),
    applyCalendarTemplate: (
      id: string,
      targetDate: string,
      cycles: number,
      version: number,
      preferencesVersion: number,
      key?: string,
    ) =>
      http<{
        count: number;
        targetDate: string;
        createdBlocks: { id: string; version: number; title: string }[];
        createdItems: { id: string; version: number }[];
      }>(root + "/templates/" + id + "/apply", {
        method: "POST",
        body: body({ targetDate, cycles, preferencesVersion }),
        headers: writeHeaders(key, version),
      }),
  };
}
