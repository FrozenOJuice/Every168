"use client";
import { useEffect, useRef, type RefObject } from "react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { idSchema } from "@168hours/contracts";
import { useMe } from "@/features/identity/me";
import { exerciseReturnPositionKey } from "./exercise-workout-return";

const position = z.object({
  pathname: z.string().max(300),
  page: z.number().finite().min(0).max(100000000),
  pane: z.number().finite().min(0).max(100000000),
  reference: z.number().int().min(0).max(10000),
});
export function saveExerciseWorkoutPosition(
  userId: string,
  exerciseId: string,
  workoutId: string,
  link: HTMLElement,
  pathname: string,
) {
  const references = Array.from(
    (
      link.closest(".fitness-progress-page") ?? document
    ).querySelectorAll<HTMLElement>(`[data-workout-reference="${workoutId}"]`),
  );
  const reference = references.indexOf(
    link.closest<HTMLElement>("[data-workout-reference]")!,
  );
  try {
    sessionStorage.setItem(
      exerciseReturnPositionKey(userId, exerciseId, workoutId),
      JSON.stringify({
        pathname,
        page: window.scrollY,
        pane: link.closest(".fitness-primary-pane")?.scrollTop ?? 0,
        reference: Math.max(0, reference),
      }),
    );
  } catch {
    /* Navigation still works when optional position storage is unavailable. */
  }
}
export function useRestoreExerciseWorkoutPosition(
  id: string,
  ready: boolean,
  root: RefObject<HTMLDivElement | null>,
) {
  const { user } = useMe();
  const cache = useQueryClient();
  const fetchingWeights = useIsFetching({
    queryKey: ["fitness", "weight-records", id],
  });
  const restored = useRef("");
  useEffect(() => {
    if (
      !ready ||
      fetchingWeights ||
      cache.isFetching({ queryKey: ["fitness", "weight-records", id] })
    )
      return;
    const workoutId = new URLSearchParams(window.location.search).get(
      "restoreWorkout",
    );
    if (!idSchema.safeParse(workoutId).success) return;
    const key = exerciseReturnPositionKey(user.id, id, workoutId!);
    if (restored.current === key) return;
    try {
      const saved = position.safeParse(
        JSON.parse(sessionStorage.getItem(key) ?? "null"),
      );
      if (!saved.success || saved.data.pathname !== window.location.pathname)
        return;
      let second = 0;
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => {
          restored.current = key;
          root.current
            ?.closest(".fitness-primary-pane")
            ?.scrollTo({ top: saved.data.pane, behavior: "instant" });
          window.scrollTo({ top: saved.data.page, behavior: "instant" });
          const references = root.current?.querySelectorAll<HTMLElement>(
            `[data-workout-reference="${workoutId}"]`,
          );
          references?.[saved.data.reference]
            ?.querySelector<HTMLElement>("a")
            ?.focus({ preventScroll: true });
          try {
            sessionStorage.removeItem(key);
          } catch {
            /* Optional position storage. */
          }
        });
      });
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
      };
    } catch {
      /* Ignore unavailable or invalid optional position storage. */
    }
  }, [cache, fetchingWeights, id, ready, root, user.id]);
}
