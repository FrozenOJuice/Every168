import type { CopyPreview } from "@168hours/contracts";
import { formatTime, formatDate } from "@/lib/format";
import { localDate } from "@168hours/domain-utils";
export function CalendarCopyPreview({ preview }: { preview: CopyPreview }) {
  const count = preview.blocks.length + preview.items.length;
  return (
    <div className="stack">
      <p>
        <strong>
          {count} {count === 1 ? "plan" : "plans"}
        </strong>{" "}
        will be added starting {formatDate(preview.targetDate)}.
      </p>
      <p className="muted text-small">
        Existing plans remain. Copies are independent plans; recorded activity
        and repeating rules are excluded. Times use {preview.timezone}; repeated
        clock times use the first occurrence.
      </p>
      <ol className="copy-preview-list">
        {preview.blocks.map((b, index) => (
          <li key={"b" + index}>
            <strong>{b.title}</strong>
            <small>
              {localDate(b.startsAt, preview.timezone)} ·{" "}
              {formatTime(b.startsAt, preview.timezone)} –{" "}
              {localDate(b.startsAt, preview.timezone) !==
              localDate(b.endsAt, preview.timezone)
                ? localDate(b.endsAt, preview.timezone) + " "
                : ""}
              {formatTime(b.endsAt, preview.timezone)}
            </small>
          </li>
        ))}
        {preview.items.map((i, index) => (
          <li key={"i" + index}>
            <strong>{i.title}</strong>
            <small>
              {i.date}
              {i.endDate && i.endDate !== i.date
                ? " – " + i.endDate
                : ""} · {i.kind === "all_day" ? "All day" : "Any time"}
            </small>
          </li>
        ))}
      </ol>
    </div>
  );
}
