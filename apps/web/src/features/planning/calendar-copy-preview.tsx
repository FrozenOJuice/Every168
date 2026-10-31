import type { CopyPreview } from "@168hours/contracts";
import { formatTime, formatDate } from "@/lib/format";
import { localDate } from "@168hours/domain-utils";
export function CalendarCopyPreview({ preview }: { preview: CopyPreview }) {
  const records = [
    ...preview.blocks.map((b, index) => ({
      key: `b${index}`,
      date: localDate(b.startsAt, preview.timezone),
      order: b.startsAt,
      title: b.title,
      detail: `${formatTime(b.startsAt, preview.timezone)} - ${localDate(b.startsAt, preview.timezone) !== localDate(b.endsAt, preview.timezone) ? formatDate(localDate(b.endsAt, preview.timezone)) + " " : ""}${formatTime(b.endsAt, preview.timezone)}`,
    })),
    ...preview.items.map((item, index) => ({
      key: `i${index}`,
      date: item.date ?? preview.targetDate,
      order: "",
      title: item.title,
      detail: `${item.kind === "all_day" ? "All day" : "Any time"}${item.endDate && item.endDate !== item.date ? ` through ${formatDate(item.endDate)}` : ""}`,
    })),
  ].sort(
    (a, b) => a.date.localeCompare(b.date) || a.order.localeCompare(b.order),
  );
  const dates = [...new Set(records.map((record) => record.date))];
  return (
    <div className="calendar-template-preview">
      <div className="calendar-template-preview-total">
        <strong>
          {records.length} {records.length === 1 ? "plan" : "plans"} will be
          added
        </strong>
        <span>
          Starting{" "}
          {formatDate(preview.targetDate, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>
      <p className="muted text-small">
        Existing plans stay. Copies exclude recorded activity and repeating
        rules.
      </p>
      {dates.map((date) => (
        <section key={date} className="calendar-template-preview-day">
          <h4>
            {formatDate(date, {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </h4>
          <ol>
            {records
              .filter((record) => record.date === date)
              .map((record) => (
                <li key={record.key}>
                  <strong>{record.title}</strong>
                  <span>{record.detail}</span>
                </li>
              ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
