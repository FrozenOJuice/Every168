"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { addDays, localDate } from "@168hours/domain-utils";
import { dateSchema } from "@168hours/contracts";
import { formatDate } from "@/lib/format";

export function foodHref(date: string, tab = "log") {
  return "/food?" + new URLSearchParams({ date, tab });
}
export function FoodDateNav({
  date,
  timezone,
}: {
  date: string;
  timezone: string;
}) {
  const router = useRouter();
  return (
    <div className="food-date-nav">
      <div>
        <h2>
          {formatDate(date, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </h2>
        <small>{timezone}</small>
      </div>
      <div className="row">
        <div
          className="food-day-arrows"
          role="group"
          aria-label="Day navigation"
        >
          <Link
            className="button"
            scroll={false}
            href={foodHref(addDays(date, -1))}
            aria-label="Previous day"
          >
            <ArrowLeft size={17} aria-hidden="true" />
          </Link>
          <Link
            className="button"
            scroll={false}
            href={foodHref(localDate(new Date(), timezone))}
          >
            Today
          </Link>
          <Link
            className="button"
            scroll={false}
            href={foodHref(addDays(date, 1))}
            aria-label="Next day"
          >
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <div className="field">
          <label htmlFor="food-date">Log date</label>
          <input
            id="food-date"
            type="date"
            value={date}
            onChange={(event) => {
              const result = dateSchema.safeParse(event.target.value);
              if (result.success)
                router.push(foodHref(result.data), { scroll: false });
            }}
          />
        </div>
      </div>
    </div>
  );
}
