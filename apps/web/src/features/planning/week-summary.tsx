import type { Week } from "@168hours/contracts";
import { hours } from "@/lib/format";
export function WeekSummary({ week }: { week: Week }) {
  return (
    <section className="panel week-summary">
      <div className="row between">
        <div>
          <p className="eyebrow">Room for your whole week</p>
          <h2>168 hours, thoughtfully spent</h2>
        </div>
        <span className="muted text-small">{week.timezone}</span>
      </div>
      <div className="stat-grid">
        <div>
          <strong>{hours(week.coverageSeconds)}</strong>
          <span>Calendar allocated</span>
        </div>
        <div>
          <strong>{hours(week.unallocatedSeconds)}</strong>
          <span>Unallocated · room to breathe</span>
        </div>
        <div>
          <strong>
            {week.recordedSeconds === null
              ? "No entries yet"
              : hours(week.recordedSeconds)}
          </strong>
          <span>Recorded time</span>
        </div>
      </div>
      <div
        className="coverage-track"
        role="meter"
        aria-label="Calendar allocated"
        aria-valuemin={0}
        aria-valuemax={week.calendarSeconds}
        aria-valuenow={week.coverageSeconds}
      >
        <span
          style={{
            width: (100 * week.coverageSeconds) / week.calendarSeconds + "%",
          }}
        />
      </div>
      {week.calendarSeconds !== 604800 && (
        <p className="text-small muted">
          This local calendar week contains {hours(week.calendarSeconds)}{" "}
          because of a daylight-saving change.
        </p>
      )}
      {week.overlapPairs.length > 0 && (
        <p className="notice" role="status">
          {week.overlapPairs.length} overlapping pair
          {week.overlapPairs.length === 1 ? "" : "s"} ·{" "}
          {hours(week.overlapSeconds)} of duplicated scheduled time. Coverage
          counts each moment once.
        </p>
      )}
      {week.categories.length > 0 && (
        <div className="allocation-list">
          <div className="allocation-row table-label">
            <span>Category</span>
            <span>Planned</span>
            <span>Recorded</span>
          </div>
          {week.categories.map((c) => (
            <div className="allocation-row" key={c.categoryId ?? "none"}>
              <span className="category-label">
                <span
                  className="dot"
                  style={{ background: c.color ?? "var(--primary)" }}
                />
                {c.name}
              </span>
              <span>{hours(c.plannedSeconds)}</span>
              <span>
                {c.recordedSeconds === null ? "—" : hours(c.recordedSeconds)}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="text-small muted summary-foot">
        Scheduled: {hours(week.plannedSeconds)}. Recorded time reflects only
        what you log.
      </p>
    </section>
  );
}
