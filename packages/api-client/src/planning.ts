import type {
  Category,
  CategoryInput,
  Block,
  BlockInput,
  TimeEntry,
  TimeEntryInput,
  Week,
} from "@168hours/contracts";
import { writeHeaders, body, type Http } from "./http";
export function planningClient(http: Http) {
  return {
    getCategories: () => http<Category[]>("/api/v1/categories"),
    createCategory: (v: CategoryInput, key?: string) =>
      http<Category>("/api/v1/categories", {
        method: "POST",
        headers: writeHeaders(key),
        body: body(v),
      }),
    updateCategory: (
      id: string,
      v: CategoryInput,
      version: number,
      key?: string,
    ) =>
      http<Category>("/api/v1/categories/" + id, {
        method: "PUT",
        headers: writeHeaders(key, version),
        body: body(v),
      }),
    archiveCategory: (id: string, version: number, key?: string) =>
      http<Category>("/api/v1/categories/" + id + "/archive", {
        method: "POST",
        headers: writeHeaders(key, version),
        body: "{}",
      }),
    getWeek: (date: string) => http<Week>("/api/v1/weeks/" + date),
    createTimeBlock: (v: BlockInput, key?: string) =>
      http<Block>("/api/v1/time-blocks", {
        method: "POST",
        headers: writeHeaders(key),
        body: body(v),
      }),
    updateTimeBlock: (
      id: string,
      v: BlockInput,
      version: number,
      key?: string,
    ) =>
      http<Block>("/api/v1/time-blocks/" + id, {
        method: "PUT",
        headers: writeHeaders(key, version),
        body: body(v),
      }),
    deleteTimeBlock: (id: string, version: number, key?: string) =>
      http<{ ok: true }>("/api/v1/time-blocks/" + id, {
        method: "DELETE",
        headers: writeHeaders(key, version),
      }),
    createTimeEntry: (v: TimeEntryInput, key?: string) =>
      http<TimeEntry>("/api/v1/time-entries", {
        method: "POST",
        headers: writeHeaders(key),
        body: body(v),
      }),
    updateTimeEntry: (
      id: string,
      v: TimeEntryInput,
      version: number,
      key?: string,
    ) =>
      http<TimeEntry>("/api/v1/time-entries/" + id, {
        method: "PUT",
        headers: writeHeaders(key, version),
        body: body(v),
      }),
    deleteTimeEntry: (id: string, version: number, key?: string) =>
      http<{ ok: true }>("/api/v1/time-entries/" + id, {
        method: "DELETE",
        headers: writeHeaders(key, version),
      }),
  };
}
