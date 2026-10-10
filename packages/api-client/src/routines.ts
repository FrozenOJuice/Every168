import type {
  Routine,
  RoutineInput,
  RoutineProgressInput,
} from "@168hours/contracts";
import { body, writeHeaders, type Http } from "./http";

export function routinesClient(http: Http) {
  const root = "/api/v1/routines";
  return {
    getRoutines: () => http<Routine[]>(root),
    createRoutine: (input: RoutineInput, key?: string) =>
      http<Routine>(root, {
        method: "POST",
        headers: writeHeaders(key),
        body: body(input),
      }),
    updateRoutine: (
      id: string,
      input: RoutineInput,
      version: number,
      key?: string,
    ) =>
      http<Routine>(root + "/" + id, {
        method: "PUT",
        headers: writeHeaders(key, version),
        body: body(input),
      }),
    updateRoutineProgress: (
      id: string,
      input: RoutineProgressInput,
      version: number,
      key?: string,
    ) =>
      http<Routine>(root + "/" + id + "/progress", {
        method: "PUT",
        headers: writeHeaders(key, version),
        body: body(input),
      }),
    completeRoutine: (id: string, version: number, key?: string) =>
      http<Routine>(root + "/" + id + "/complete", {
        method: "POST",
        headers: writeHeaders(key, version),
        body: "{}",
      }),
    deleteRoutine: (id: string, version: number, key?: string) =>
      http<{ ok: true }>(root + "/" + id, {
        method: "DELETE",
        headers: writeHeaders(key, version),
      }),
  };
}
