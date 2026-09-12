"use client";
import { HealthPanel } from "./health-panel";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Plus, CalendarDays } from "lucide-react";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import {
  Loading,
  ErrorState,
  Empty,
  PageHeading,
} from "@/components/ui/feedback";
import { WeekSummary } from "@/features/planning/week-summary";
import { GoalCard } from "@/features/goals/goal-card";
import { formatDate, formatTime } from "@/lib/format";
export function DashboardPage() {
  const me = useMe();
  const query = useQuery({
    queryKey: ["dashboard", me.preferences],
    queryFn: api.getDashboard,
  });
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const d = query.data;
  return (
    <>
      <PageHeading
        eyebrow={formatDate(d.today, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
        title={"Hello, " + me.user.name.split(" ")[0] + "."}
        description="A little intention goes a long way."
      >
        <Link className="button primary" href="/week?add=1">
          <Plus size={17} />
          Plan a block
        </Link>
      </PageHeading>
      <div className="dashboard-grid">
        <div className="stack">
          <section className="panel">
            <div className="row between">
              <h2>Today’s plan</h2>
              <Link className="text-small row" href="/week">
                View week <ArrowUpRight size={15} />
              </Link>
            </div>
            {d.todayBlocks.length ? (
              <ol className="agenda">
                {d.todayBlocks.map((b) => (
                  <li key={b.id}>
                    <div className="agenda-time">
                      {formatTime(b.startsAt, d.week.timezone)}
                      <small>{formatTime(b.endsAt, d.week.timezone)}</small>
                    </div>
                    <div>
                      <Link href={"/week?date=" + d.today}>{b.title}</Link>
                      <small>
                        {d.week.categories.find(
                          (c) => c.categoryId === b.categoryId,
                        )?.name ?? "Uncategorized"}
                      </small>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty>
                <CalendarDays size={26} className="empty-icon" />
                An open page today.
                <br />
                Add a block, or leave some room for the unplanned.
              </Empty>
            )}
          </section>
          <WeekSummary week={d.week} />
        </div>
        <div className="stack">
          <HealthPanel data={d} />
          <section className="panel">
            <div className="row between">
              <h2>What you’re working toward</h2>
              <Link className="text-small" href="/goals">
                All goals
              </Link>
            </div>
            {d.goals.length ? (
              d.goals.map((g) => <GoalCard key={g.id} goal={g} />)
            ) : (
              <Empty>
                Give your week a little direction.
                <br />
                <Link href="/goals">Create your first goal</Link>
              </Empty>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
