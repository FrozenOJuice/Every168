import type {
  Water,
  WaterInput,
  WaterDaily,
  Weight,
  WeightInput,
  MeasurementHistoryQuery,
  WeightReview,
  Page,
} from "@168hours/contracts";
import { writeHeaders, body, query, type Http } from "./http";
export function measurementsClient(http: Http) {
  return {
    getWater: (q: Partial<MeasurementHistoryQuery> = {}) =>
      http<Page<Water>>("/api/v1/water-entries" + query(q)),
    logWater: (v: WaterInput, key?: string) =>
      http<Water>("/api/v1/water-entries", {
        method: "POST",
        headers: writeHeaders(key),
        body: body(v),
      }),
    updateWater: (id: string, v: WaterInput, version: number, key?: string) =>
      http<Water>("/api/v1/water-entries/" + id, {
        method: "PUT",
        headers: writeHeaders(key, version),
        body: body(v),
      }),
    deleteWater: (id: string, version: number, key?: string) =>
      http<{ ok: true }>("/api/v1/water-entries/" + id, {
        method: "DELETE",
        headers: writeHeaders(key, version),
      }),
    getWaterDaily: (date: string) =>
      http<WaterDaily>("/api/v1/hydration/daily" + query({ date })),
    getWeightReview: (date: string) =>
      http<WeightReview>("/api/v1/body/weight-review" + query({ date })),
    getWeight: (q: Partial<MeasurementHistoryQuery> = {}) =>
      http<Page<Weight>>("/api/v1/weight-entries" + query(q)),
    logWeight: (v: WeightInput, key?: string) =>
      http<Weight>("/api/v1/weight-entries", {
        method: "POST",
        headers: writeHeaders(key),
        body: body(v),
      }),
    updateWeight: (id: string, v: WeightInput, version: number, key?: string) =>
      http<Weight>("/api/v1/weight-entries/" + id, {
        method: "PUT",
        headers: writeHeaders(key, version),
        body: body(v),
      }),
    deleteWeight: (id: string, version: number, key?: string) =>
      http<{ ok: true }>("/api/v1/weight-entries/" + id, {
        method: "DELETE",
        headers: writeHeaders(key, version),
      }),
  };
}
