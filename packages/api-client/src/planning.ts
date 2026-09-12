import type {
  Category,
  CategoryInput,
  Block,
  BlockInput,
  TimeEntry,
  TimeEntryInput,
  Week,
} from "@168hours/contracts";
import { body, type Http } from "./http";
export function planningClient(http: Http) {
  return {
    getCategories: () => http<Category[]>("/api/v1/categories"),
    createCategory: (v: CategoryInput) =>
      http<Category>("/api/v1/categories", { method: "POST", body: body(v) }),
    updateCategory: (id: string, v: CategoryInput) =>
      http<Category>("/api/v1/categories/" + id, {
        method: "PUT",
        body: body(v),
      }),
    archiveCategory: (id: string) =>
      http<Category>("/api/v1/categories/" + id + "/archive", {
        method: "POST",
        body: "{}",
      }),
    getWeek: (date: string) => http<Week>("/api/v1/weeks/" + date),
    createTimeBlock: (v: BlockInput) =>
      http<Block>("/api/v1/time-blocks", { method: "POST", body: body(v) }),
    updateTimeBlock: (id: string, v: BlockInput) =>
      http<Block>("/api/v1/time-blocks/" + id, {
        method: "PUT",
        body: body(v),
      }),
    deleteTimeBlock: (id: string) =>
      http<{ ok: true }>("/api/v1/time-blocks/" + id, { method: "DELETE" }),
    createTimeEntry: (v: TimeEntryInput) =>
      http<TimeEntry>("/api/v1/time-entries", {
        method: "POST",
        body: body(v),
      }),
    updateTimeEntry: (id: string, v: TimeEntryInput) =>
      http<TimeEntry>("/api/v1/time-entries/" + id, {
        method: "PUT",
        body: body(v),
      }),
    deleteTimeEntry: (id: string) =>
      http<{ ok: true }>("/api/v1/time-entries/" + id, { method: "DELETE" }),
  };
}
