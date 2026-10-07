import Link from "next/link";
import {
  Activity,
  CircleDot,
  Droplet,
  Dumbbell,
  Scale,
  Utensils,
} from "lucide-react";
import type {
  CalendarActivity,
  CalendarActivityResult,
  CalendarItem,
  Week,
} from "@168hours/contracts";
import { formatDate, formatTime } from "@/lib/format";
import { CalendarRecord } from "./calendar-record";
import { CalendarItemButton } from "./calendar-item-button";
import { dayRecords } from "./calendar-layout";
import {
  itemsOnDate,
  type CalendarDisplayRecord,
  type CalendarFilter,
} from "./calendar-filters";
import { activityOnDate } from "./calendar-activity";
const icons = {
  activity: Activity,
  droplet: Droplet,
  dumbbell: Dumbbell,
  scale: Scale,
  utensils: Utensils,
};
export function ActivityIcon({ name }: { name: string }) {
  const Icon = icons[name as keyof typeof icons] ?? CircleDot;
  return <Icon size={16} aria-hidden="true" />;
}
export function ActivityLink({
  entry,
  timezone,
}: {
  entry: CalendarActivity;
  timezone: string;
}) {
  return (
    <Link className="calendar-record activity-record" href={entry.href}>
      <span className="activity-record-heading">
        <ActivityIcon name={entry.icon} />
        <strong>{entry.title}</strong>
      </span>
      <span>
        {formatTime(entry.occurredAt, timezone, true)}
        {entry.endsAt ? " – " + formatTime(entry.endsAt, timezone, true) : ""}
      </span>
      <span>{entry.summary}</span>
      <small>
        {entry.domain} ·{" "}
        {entry.kind === "moment"
          ? "Moment"
          : entry.status === "draft"
            ? "Draft session"
            : "Recorded session"}
      </small>
    </Link>
  );
}
export function CalendarDayFeed({
  date,
  week,
  items,
  activity,
  filter,
  now,
  onOpen,
  onAdd,
}: {
  date: string;
  week: Week;
  items: CalendarItem[];
  activity: CalendarActivityResult;
  filter: CalendarFilter;
  now: string;
  onOpen: (record: CalendarDisplayRecord, date: string) => void;
  onAdd: (date: string) => void;
}) {
  const domain = activityOnDate(activity.entries, date, week.timezone, filter);
  // A domain session and its accounting ledger are one activity, even when linked to a plan.
  const sourceKeys = new Set(
    domain.map((entry) => entry.source.type + ":" + entry.source.id),
  );
  const timed = dayRecords(week, date, filter).filter(
    (record) =>
      record.kind !== "entry" ||
      !record.item.sourceId ||
      !sourceKeys.has(record.item.sourceType + ":" + record.item.sourceId),
  );
  const feed = [
    ...timed.map((record) => ({
      key: record.kind + record.item.id,
      at: record.item.startsAt,
      end: record.item.endsAt,
      record,
      activity: null as CalendarActivity | null,
    })),
    ...domain.map((entry) => ({
      key: entry.source.type + entry.source.id,
      at: entry.occurredAt,
      end: entry.endsAt,
      record: null,
      activity: entry,
    })),
  ].sort(
    (a, b) => Date.parse(a.at) - Date.parse(b.at) || a.key.localeCompare(b.key),
  );
  const anytime = itemsOnDate(items, date, filter);
  const groups = [
    {
      title: "Earlier",
      entries: feed.filter(
        (entry) => Date.parse(entry.end ?? entry.at) <= Date.parse(now),
      ),
    },
    {
      title: "Now",
      entries: feed.filter(
        (entry) =>
          Date.parse(entry.at) <= Date.parse(now) &&
          !!entry.end &&
          Date.parse(entry.end) > Date.parse(now),
      ),
    },
    {
      title: "Coming up",
      entries: feed.filter((entry) => Date.parse(entry.at) > Date.parse(now)),
    },
  ];
  return (
    <section className="calendar-day-feed" aria-label="Day activity">
      <div className="row between">
        <h2>Your day</h2>
        <button className="text-button" onClick={() => onAdd(date)}>
          Add to day
        </button>
      </div>
      <p className="muted text-small">
        {formatDate(date, { weekday: "long", month: "short", day: "numeric" })}{" "}
        · Plans stay planned until you record activity.
      </p>
      {(groups[1]!.entries.length > 0 || groups[2]!.entries.length > 0) && (
        <div className="day-at-a-glance">
          {groups[1]!.entries.map((entry) => (
            <p key={entry.key}>
              <strong>Now</strong> ·{" "}
              {entry.record?.kind === "block" ? "Planned: " : "Recorded: "}
              {entry.record?.item.title ?? entry.activity?.title}
            </p>
          ))}
          {groups[2]!.entries[0] && (
            <p>
              <strong>
                Next · {formatTime(groups[2]!.entries[0].at, week.timezone)}
              </strong>
              <br />
              {groups[2]!.entries[0].record?.kind === "block"
                ? "Planned: "
                : "Recorded: "}
              {groups[2]!.entries[0].record?.item.title ??
                groups[2]!.entries[0].activity?.title}
            </p>
          )}
        </div>
      )}
      {anytime.length > 0 && (
        <>
          <h3>Any time</h3>
          <ol className="day-records">
            {anytime.map((item) => (
              <li key={item.id}>
                <CalendarItemButton
                  item={item}
                  onOpen={() => onOpen({ kind: "item", item }, date)}
                />
              </li>
            ))}
          </ol>
        </>
      )}
      {groups.map(
        (group) =>
          group.entries.length > 0 && (
            <div key={group.title}>
              <h3>{group.title}</h3>
              <ol className="day-records">
                {group.entries.map((entry, index, entries) => {
                  const moment =
                    entry.activity?.kind === "moment" ? entry.activity : null;
                  const bucket = moment
                    ? moment.source.type +
                      Math.floor(Date.parse(moment.occurredAt) / 3600000)
                    : null;
                  const sameBucket = (candidate: typeof entry) =>
                    candidate.activity?.kind === "moment" &&
                    candidate.activity.source.type +
                      Math.floor(Date.parse(candidate.at) / 3600000) ===
                      bucket;
                  if (bucket && entries.slice(0, index).some(sameBucket))
                    return null;
                  const clustered = bucket ? entries.filter(sameBucket) : [];
                  return (
                    <li key={entry.key}>
                      {clustered.length > 1 ? (
                        <details className="moment-cluster">
                          <summary>
                            {clustered.length} {moment!.domain} moments ·{" "}
                            {formatTime(entry.at, week.timezone)}
                          </summary>
                          {clustered.map((child) => (
                            <ActivityLink
                              key={child.key}
                              entry={child.activity!}
                              timezone={week.timezone}
                            />
                          ))}
                        </details>
                      ) : entry.activity ? (
                        <ActivityLink
                          entry={entry.activity}
                          timezone={week.timezone}
                        />
                      ) : (
                        entry.record && (
                          <div className="feed-time-record">
                            {entry.record.kind === "block" && (
                              <small>Planned</small>
                            )}
                            <CalendarRecord
                              record={entry.record}
                              week={week}
                              onOpen={() => onOpen(entry.record!, date)}
                            />
                          </div>
                        )
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          ),
      )}
      {!feed.length && !anytime.length && (
        <p className="empty">No plans or activity for this day yet.</p>
      )}
      {activity.truncatedSources.map((source, index) => (
        <p className="notice" key={source.label + index}>
          Showing up to 200 records from {source.label} in this range.{" "}
          <Link href={source.href}>Open full history</Link>
        </p>
      ))}
    </section>
  );
}
