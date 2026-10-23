import type {
  TrainingProgram,
  ProgramSessionLink,
  TrainingProgramInput,
  TrainingProgramQuery,
  ProgramScheduleInput,
  ProgramBeginInput,
  ProgramSkipInput,
  ProgramOccurrence,
  Page,
  PageQuery,
  Workout,
} from "@168hours/contracts";
import { writeHeaders, body, query, type Http } from "./http";
export function trainingProgramsClient(http: Http) {
  const path = "/api/v1/training-programs";
  return {
    getTrainingPrograms: (q: Partial<TrainingProgramQuery> = {}) =>
      http<Page<TrainingProgram>>(path + query(q)),
    getTrainingProgram: (id: string) => http<TrainingProgram>(`${path}/${id}`),
    getProgramHistory: (id: string, q: Partial<PageQuery> = {}) =>
      http<Page<ProgramOccurrence>>(`${path}/${id}/history` + query(q)),
    getProgramForSession: (id: string) =>
      http<ProgramSessionLink>(
        `/api/v1/training-program-for-session/${id}`,
      ).then((result) => result.program),
    createTrainingProgram: (v: TrainingProgramInput, key?: string) =>
      http<TrainingProgram>(path, {
        method: "POST",
        headers: writeHeaders(key),
        body: body(v),
      }),
    updateTrainingProgram: (
      id: string,
      v: TrainingProgramInput,
      version: number,
      key?: string,
    ) =>
      http<TrainingProgram>(`${path}/${id}`, {
        method: "PUT",
        headers: writeHeaders(key, version),
        body: body(v),
      }),
    deleteTrainingProgram: (id: string, version: number, key?: string) =>
      http<{ ok: true }>(`${path}/${id}`, {
        method: "DELETE",
        headers: writeHeaders(key, version),
      }),
    pauseTrainingProgram: (
      id: string,
      paused: boolean,
      version: number,
      key?: string,
    ) =>
      http<TrainingProgram>(`${path}/${id}/paused`, {
        method: "PUT",
        headers: writeHeaders(key, version),
        body: body({ paused }),
      }),
    beginTrainingProgram: (
      id: string,
      v: ProgramBeginInput,
      version: number,
      key?: string,
    ) =>
      http<Workout>(`${path}/${id}/begin`, {
        method: "POST",
        headers: writeHeaders(key, version),
        body: body(v),
      }),
    scheduleTrainingProgram: (
      id: string,
      v: ProgramScheduleInput,
      version: number,
      key?: string,
    ) =>
      http<TrainingProgram>(`${path}/${id}/schedule`, {
        method: "POST",
        headers: writeHeaders(key, version),
        body: body(v),
      }),
    skipTrainingProgram: (
      id: string,
      v: ProgramSkipInput,
      version: number,
      key?: string,
    ) =>
      http<TrainingProgram>(`${path}/${id}/skip`, {
        method: "POST",
        headers: writeHeaders(key, version),
        body: body(v),
      }),
  };
}
