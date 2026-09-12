import type {
  Water,
  WaterInput,
  WaterDaily,
  Weight,
  WeightInput,
  PageQuery,
  Page,
} from "@168hours/contracts";
import { body, query, type Http } from "./http";
export function measurementsClient(http: Http) {
  return {
    getWater: (q: Partial<PageQuery> = {}) =>
      http<Page<Water>>("/api/v1/water-entries" + query(q)),
    logWater: (v: WaterInput) =>
      http<Water>("/api/v1/water-entries", { method: "POST", body: body(v) }),
    updateWater: (id: string, v: WaterInput) =>
      http<Water>("/api/v1/water-entries/" + id, {
        method: "PUT",
        body: body(v),
      }),
    deleteWater: (id: string) =>
      http<{ ok: true }>("/api/v1/water-entries/" + id, { method: "DELETE" }),
    getWaterDaily: (date: string) =>
      http<WaterDaily>("/api/v1/hydration/daily" + query({ date })),
    getWeight: (q: Partial<PageQuery> = {}) =>
      http<Page<Weight>>("/api/v1/weight-entries" + query(q)),
    logWeight: (v: WeightInput) =>
      http<Weight>("/api/v1/weight-entries", { method: "POST", body: body(v) }),
    updateWeight: (id: string, v: WeightInput) =>
      http<Weight>("/api/v1/weight-entries/" + id, {
        method: "PUT",
        body: body(v),
      }),
    deleteWeight: (id: string) =>
      http<{ ok: true }>("/api/v1/weight-entries/" + id, { method: "DELETE" }),
  };
}
