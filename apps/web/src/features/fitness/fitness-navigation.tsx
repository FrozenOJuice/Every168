"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useIsFetching } from "@tanstack/react-query";
import type { ExerciseLoggingType } from "@168hours/contracts";
import { z } from "zod";
import { useMe } from "@/features/identity/me";
import { Loading } from "@/components/ui/feedback";
import { canNavigateAway } from "@/lib/use-unsaved-changes";
import {
  fitnessHref,
  rootPath,
  screenNode,
  exerciseNode,
  visitFitnessNode,
  navigationEntrySchema,
  type FitnessEntry,
  type FitnessNode,
  type FitnessPosition,
  type ScreenView,
  type LibraryFilters,
} from "./fitness-navigation-state";

type ExerciseVisit = {
  id?: string;
  href?: string;
  catalogKey?: string;
  mode?: ExerciseLoggingType;
  history?: boolean;
  inline?: boolean;
  compact?: boolean;
  fromLibrary?: boolean;
  view?: ScreenView;
};
type Navigation = {
  current?: FitnessNode;
  parent?: FitnessNode;
  screen?: FitnessNode;
  entryId?: string;
  openExercise: (visit: ExerciseVisit) => void;
  destination: (href: string) => string;
  openWorkout: (
    href: string,
    origin?: { exerciseId: string; mode: ExerciseLoggingType },
  ) => void;
  back: () => Promise<boolean>;
  setView: (view: ScreenView) => void;
  filters: (context?: string) => LibraryFilters | undefined;
  setFilters: (context: string | undefined, value: LibraryFilters) => void;
};
const Context = createContext<Navigation | null>(null);
const marker = "__168hoursFitnessVisit";
function location() {
  return (
    fitnessHref(window.location.pathname + window.location.search) ?? "/fitness"
  );
}
function position(): FitnessPosition {
  const active = document.activeElement;
  const reference = active?.closest<HTMLElement>("[data-workout-reference]");
  const references = reference
    ? [
        ...(
          active?.closest(".fitness-progress-page") ?? document
        ).querySelectorAll(
          `[data-workout-reference="${reference.dataset.workoutReference}"]`,
        ),
      ]
    : [];
  return {
    page: window.scrollY,
    pane: document.querySelector(".fitness-primary-pane")?.scrollTop ?? 0,
    builder: document.querySelector(".fitness-builder-scroll")?.scrollTop ?? 0,
    library: document.querySelector(".fitness-exercise-panel")?.scrollTop ?? 0,
    focus: active?.getAttribute("aria-label") ?? undefined,
    focusOccurrence: active?.hasAttribute("aria-label")
      ? [
          ...document.querySelectorAll(
            `[aria-label="${CSS.escape(active.getAttribute("aria-label")!)}"]`,
          ),
        ].indexOf(active)
      : undefined,
    focusText: active?.matches("button,a")
      ? active.textContent?.trim().slice(0, 300)
      : undefined,
    reference: reference?.dataset.workoutReference,
    sessionId:
      active?.closest<HTMLElement>("[data-session-id]")?.dataset.sessionId,
    occurrence: reference ? references.indexOf(reference) : undefined,
  };
}
function entryLocation() {
  return {
    entryKey: window.navigation?.currentEntry?.key,
    entryIndex:
      typeof window.history.state?.__168hoursIndex === "number"
        ? (window.history.state.__168hoursIndex as number)
        : undefined,
  };
}

export function FitnessNavigationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const storageKey = `168hours:fitness-navigation:${user.id}`;
  const entries = useRef<FitnessEntry[]>([]);
  const [entry, setEntry] = useState<FitnessEntry | null>(null);
  const current = useRef<FitnessEntry | null>(null);
  const pending = useRef<FitnessNode[] | null>(null);
  const restoring = useRef(false);
  const restorePosition = useRef(false);
  const fetching = useIsFetching({ queryKey: ["fitness"] });
  const save = useCallback(
    (next: FitnessEntry) => {
      current.current = next;
      entries.current = [
        ...entries.current.filter((item) => item.token !== next.token),
        next,
      ].slice(-32);
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(entries.current));
      } catch {
        /* Optional navigation recovery. */
      }
      setEntry(next);
    },
    [storageKey],
  );
  const stamp = useCallback(
    (path: FitnessNode[], token = crypto.randomUUID()) => {
      const next = {
        token,
        location: location(),
        path: path.map((node, index) =>
          index === path.length - 1 ? { ...node, ...entryLocation() } : node,
        ),
      };
      window.history.replaceState(
        { ...window.history.state, [marker]: { owner: user.id, token } },
        "",
      );
      save(next);
    },
    [save, user.id],
  );
  const sync = useCallback(() => {
    const href = location();
    if (pending.current?.at(-1)?.location === href) {
      const path = pending.current;
      pending.current = null;
      stamp(path);
      return;
    }
    const state = window.history.state?.[marker];
    const saved =
      state?.owner === user.id
        ? entries.current.find(
            (item) => item.token === state.token && item.location === href,
          )
        : undefined;
    if (saved) {
      restoring.current = true;
      restorePosition.current = true;
      current.current = saved;
      setEntry(saved);
      return;
    }
    if (current.current?.location === href) return;
    const path = rootPath(href);
    const previous = current.current?.path ?? [];
    const previousRoot = previous.find(
      (node) =>
        node.kind === "screen" &&
        node.href.split("?")[0] === path[0]?.href.split("?")[0],
    );
    if (path.length > 1 && previousRoot) path[0] = previousRoot;
    // Ordinary library links are real exercise visits too.
    if (
      path.at(-1)?.kind === "exercise" &&
      previous.at(-1)?.href.split("?")[0] === "/fitness/exercises"
    )
      path[0] = previous.at(-1)!;
    stamp(path);
  }, [stamp, user.id]);
  useLayoutEffect(() => {
    try {
      entries.current = z
        .array(navigationEntrySchema)
        .max(32)
        .parse(JSON.parse(sessionStorage.getItem(storageKey) ?? "[]"));
    } catch {
      entries.current = [];
    }
    sync();
    const pop = () => sync();
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [storageKey, sync]);
  useLayoutEffect(() => {
    sync();
  }, [pathname, search, sync]);

  const capture = useCallback(() => {
    const value = current.current;
    if (!value) return [];
    const path = value.path.map((node, index) =>
      index === value.path.length - 1
        ? { ...node, ...entryLocation(), position: position() }
        : node,
    );
    save({ ...value, path });
    return path;
  }, [save]);
  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (
        event.button === 0 &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey &&
        event.target instanceof Element &&
        event.target.closest("a[href]")
      )
        capture();
    };
    const interacted = () => {
      restorePosition.current = false;
    };
    document.addEventListener("click", click, true);
    document.addEventListener("pointerdown", interacted, true);
    document.addEventListener("keydown", interacted, true);
    document.addEventListener("wheel", interacted, {
      capture: true,
      passive: true,
    });
    return () => {
      document.removeEventListener("click", click, true);
      document.removeEventListener("pointerdown", interacted, true);
      document.removeEventListener("keydown", interacted, true);
      document.removeEventListener("wheel", interacted, true);
    };
  }, [capture]);
  const travel = useCallback(
    async (path: FitnessNode[]) => {
      const target = path.at(-1);
      if (!target) return false;
      const navigation = window.navigation;
      if (
        navigation &&
        target.entryKey &&
        navigation
          .entries()
          .some(
            (item) =>
              item.key === target.entryKey &&
              item.url ===
                new URL(target.location, window.location.origin).href,
          )
      ) {
        try {
          await navigation.traverseTo(target.entryKey).finished;
          return true;
        } catch {
          return false;
        }
      }
      const index: unknown = window.history.state?.__168hoursIndex;
      if (
        !navigation &&
        typeof index === "number" &&
        target.entryIndex !== undefined &&
        target.entryIndex !== index
      ) {
        if (target.location === location()) {
          return new Promise<boolean>((resolve) => {
            window.addEventListener("popstate", () => resolve(true), {
              once: true,
            });
            window.history.go(target.entryIndex! - index);
          });
        }
        window.history.go(target.entryIndex - index);
        return true;
      }
      if (target.location === location()) {
        stamp(path);
        restoring.current = true;
        restorePosition.current = true;
      } else {
        if (!(await canNavigateAway())) return false;
        pending.current = path;
        router.replace(target.location, { scroll: false });
      }
      return true;
    },
    [router, stamp],
  );
  const back = useCallback(
    () => travel((current.current?.path ?? []).slice(0, -1)),
    [travel],
  );
  const openExercise = useCallback(
    (visit: ExerciseVisit) => {
      const path = capture();
      if (!path.length) return;
      if (visit.view && path.at(-1)?.kind === "screen")
        path[path.length - 1] = { ...path.at(-1)!, view: visit.view };
      if (current.current) save({ ...current.current, path });
      const href =
        fitnessHref(visit.href) ??
        `/fitness/exercises/${visit.id}${visit.mode ? `?mode=${encodeURIComponent(visit.mode)}` : ""}`;
      const next: FitnessNode = {
        ...exerciseNode(href, visit.id, visit.catalogKey),
        mode: visit.mode,
        history: visit.history,
        inline: visit.inline ?? true,
        compact: visit.compact,
        fromLibrary: visit.fromLibrary,
        location: visit.inline === false ? href : location(),
      };
      const result = visitFitnessNode(path, next);
      if (result.existing) {
        travel(result.path);
        return;
      }
      if (next.inline) {
        window.history.pushState({ ...window.history.state }, "", location());
        stamp(result.path);
      } else {
        pending.current = result.path;
        router.push(href, { scroll: false });
      }
    },
    [capture, router, stamp, travel, save],
  );
  const openWorkout = useCallback(
    (
      href: string,
      origin?: { exerciseId: string; mode: ExerciseLoggingType },
    ) => {
      const safe = fitnessHref(href);
      if (!safe) return;
      let path = capture();
      const last = path.at(-1);
      if (origin && last?.kind === "exercise") {
        path = [
          ...path.slice(0, -1),
          { ...last, exerciseId: origin.exerciseId, mode: origin.mode },
        ];
        if (current.current) save({ ...current.current, path });
      }
      const result = visitFitnessNode(
        path,
        screenNode(
          safe,
          safe.startsWith("/fitness/workout/") ? "editor" : "default",
        ),
      );
      if (result.existing) {
        travel(result.path);
        return;
      }
      pending.current = result.path;
      router.push(safe, { scroll: false });
    },
    [capture, router, travel, save],
  );
  const setView = useCallback(
    (view: ScreenView) => {
      const value = current.current;
      if (!value) return;
      const index = value.path.findLastIndex(
        (node) =>
          node.kind === "screen" &&
          node.location.split("?")[0] === window.location.pathname,
      );
      const screen = value.path[index];
      if (!screen) return;
      if (
        restoring.current &&
        screen.view !== "default" &&
        screen.view !== view
      )
        return;
      restoring.current = false;
      if (screen.view === view) return;
      save({
        ...value,
        path: value.path.map((node, i) =>
          i === index ? { ...node, view } : node,
        ),
      });
    },
    [save],
  );
  const filters = useCallback(
    (context?: string) =>
      current.current?.path.findLast(
        (node) => node.href.split("?")[0] === context,
      )?.filters,
    [],
  );
  const setFilters = useCallback(
    (context: string | undefined, value: LibraryFilters) => {
      const active = current.current;
      const index =
        active?.path.findLastIndex(
          (node) => node.href.split("?")[0] === context,
        ) ?? -1;
      if (
        !active ||
        index < 0 ||
        JSON.stringify(active.path[index]?.filters) === JSON.stringify(value)
      )
        return;
      save({
        ...active,
        path: active.path.map((node, i) =>
          i === index ? { ...node, filters: value } : node,
        ),
      });
    },
    [save],
  );

  useEffect(() => {
    if (
      !entry ||
      fetching ||
      !restorePosition.current ||
      entry.location !== pathname + (search ? `?${search}` : "")
    )
      return;
    const value = entry.path.at(-1)?.position;
    if (!value) {
      restorePosition.current = false;
      return;
    }
    const first = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (current.current?.token !== entry.token || !restorePosition.current)
          return;
        window.scrollTo({ top: value.page, behavior: "instant" });
        for (const [selector, top] of [
          [".fitness-primary-pane", value.pane],
          [".fitness-builder-scroll", value.builder],
          [".fitness-exercise-panel", value.library],
        ] as const)
          document
            .querySelector(selector)
            ?.scrollTo({ top, behavior: "instant" });
        const reference = value.reference
          ? document
              .querySelectorAll<HTMLElement>(
                `[data-workout-reference="${value.reference}"]`,
              )
              [value.occurrence ?? 0]?.querySelector<HTMLElement>("a")
          : null;
        const focus =
          reference ??
          (value.focus
            ? document.querySelectorAll<HTMLElement>(
                `[aria-label="${CSS.escape(value.focus)}"]`,
              )[value.focusOccurrence ?? 0]
            : value.focusText
              ? [...document.querySelectorAll<HTMLElement>("button,a")].find(
                  (item) =>
                    item.textContent?.trim() === value.focusText &&
                    item.getClientRects().length,
                )
              : null);
        if (focus?.getClientRects().length)
          focus.focus({ preventScroll: true });
        if (
          focus?.getClientRects().length ||
          !(value.focus || value.focusText || value.reference)
        )
          restorePosition.current = false;
      });
    });
    return () => cancelAnimationFrame(first);
  }, [entry, fetching, pathname, search]);

  const path = entry?.path ?? [];
  const screen = path.findLast(
    (node) =>
      node.kind === "screen" && node.location.split("?")[0] === pathname,
  );
  const value: Navigation = {
    current: path.at(-1),
    parent: path.at(-2),
    screen,
    entryId: entry?.token,
    openExercise,
    destination: (href) =>
      path.find(
        (node) =>
          node.kind === "screen" &&
          node.href.split("?")[0] === href.split("?")[0],
      )?.location ?? href,
    openWorkout,
    back,
    setView,
    filters,
    setFilters,
  };
  return <Context value={value}>{entry ? children : <Loading />}</Context>;
}
export function useFitnessNavigation() {
  const value = useContext(Context);
  if (!value) throw new Error("FitnessNavigationProvider required");
  return value;
}
