"use client";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { Weight } from "@168hours/contracts";
import { fromKilograms, localDate } from "@168hours/domain-utils";
import { useMe } from "@/features/identity/me";
import { formatDate, number } from "@/lib/format";
export function WeightChart({ entries }: { entries: Weight[] }) {
  const {
    preferences: { weightUnit, timezone },
  } = useMe();
  const data = entries
    .map((e) => ({
      at: Date.parse(e.measuredAt),
      weight: fromKilograms(e.weightKg, weightUnit),
    }))
    .sort((a, b) => a.at - b.at);
  return (
    <figure className="weight-chart">
      <figcaption>Recorded measurements ({weightUnit})</figcaption>
      <div style={{ height: 210, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ScatterChart margin={{ top: 15, right: 10, bottom: 10, left: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="at"
              type="number"
              domain={["dataMin", "dataMax"]}
              name="Date"
              tickFormatter={(v) =>
                formatDate(localDate(new Date(v), timezone))
              }
              tick={{ fontSize: 10 }}
            />
            <YAxis
              dataKey="weight"
              type="number"
              domain={["auto", "auto"]}
              name="Weight"
              unit={" " + weightUnit}
              tick={{ fontSize: 10 }}
              width={64}
            />
            <Tooltip
              formatter={(value, name) =>
                name === "Date"
                  ? [
                      formatDate(localDate(new Date(Number(value)), timezone)),
                      name,
                    ]
                  : [number(Number(value)) + " " + weightUnit, name]
              }
            />
            <Scatter data={data} fill="var(--primary)" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <small>
        Each dot is a recorded measurement. Missing days are left unmeasured.
      </small>
    </figure>
  );
}
