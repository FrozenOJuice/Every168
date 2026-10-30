"use client";
import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { api } from "@/lib/api";

export function useWorkoutSearch(
  enabled = true,
  pageSize = 12,
  readyOnly = false,
) {
  const [search, setSearch] = useState("");
  const query = useInfiniteQuery({
    queryKey: [
      "fitness",
      "plans",
      "workout",
      search.trim(),
      pageSize,
      readyOnly,
    ],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.getStrengthPlans({
        kind: "workout",
        readyOnly: readyOnly ? "true" : undefined,
        search,
        cursor: pageParam,
        limit: pageSize,
      }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled,
  });
  return { search, setSearch, query };
}

export function WorkoutSearch({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="fitness-workout-search">
      <span className="sr-only">Search workouts</span>
      <Search size={18} aria-hidden="true" />
      <input
        type="search"
        placeholder="Search workouts…"
        maxLength={160}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    </label>
  );
}
