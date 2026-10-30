"use client";
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ui/confirmation-provider";

const navigationEvent = "168hours:before-navigation";
type Guard = {
  dirty: boolean;
  message: string;
  blocked: boolean;
  onDiscard?: () => void;
};
const Context = createContext<((read: () => Guard) => () => void) | null>(null);

export async function canNavigateAway() {
  const detail: { request?: () => Promise<boolean> } = {};
  document.dispatchEvent(new CustomEvent(navigationEvent, { detail }));
  return detail.request ? detail.request() : true;
}

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const confirm = useConfirm();
  const router = useRouter();
  const guards = useRef(new Map<symbol, () => Guard>());
  const pending = useRef(false);
  const approvedReplay = useRef(false);
  const register = useCallback((read: () => Guard) => {
    const key = Symbol();
    guards.current.set(key, read);
    return () => {
      guards.current.delete(key);
    };
  }, []);
  const hasChanges = useCallback(
    () => [...guards.current.values()].some((read) => read().dirty),
    [],
  );
  const request = useCallback(async () => {
    if (approvedReplay.current) return true;
    if (pending.current) return false;
    const changed = [...guards.current.values()]
      .map((read) => read())
      .filter((guard) => guard.dirty);
    if (!changed.length) return true;
    if (changed.some((guard) => guard.blocked)) return false;
    pending.current = true;
    try {
      const accepted = await confirm({
        title: "Discard changes?",
        description: changed[0]!.message,
        action: "Discard changes",
        cancel: "Keep editing",
        danger: true,
      });
      if (!accepted) return false;
      const latest = [...guards.current.values()]
        .map((read) => read())
        .filter((guard) => guard.dirty);
      if (latest.some((guard) => guard.blocked)) return false;
      for (const guard of latest) guard.onDiscard?.();
      return true;
    } finally {
      pending.current = false;
    }
  }, [confirm]);

  useLayoutEffect(() => {
    let approvedKey: string | null = null;
    const beforeNavigation = (event: Event) => {
      (
        event as CustomEvent<{ request?: () => Promise<boolean> }>
      ).detail.request = request;
    };
    const click = (event: MouseEvent) => {
      if (
        approvedReplay.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !hasChanges()
      )
        return;
      const anchor =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.download ||
        (anchor.target && anchor.target !== "_self") ||
        !/^https?:$/.test(anchor.protocol)
      )
        return;
      const destination = new URL(anchor.href);
      if (
        destination.href === window.location.href ||
        (destination.hash &&
          destination.origin === window.location.origin &&
          destination.pathname === window.location.pathname &&
          destination.search === window.location.search)
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void request().then((accepted) => {
        if (!accepted) return;
        if (anchor.isConnected) {
          approvedReplay.current = true;
          try {
            anchor.click();
          } finally {
            approvedReplay.current = false;
          }
        } else if (destination.origin === window.location.origin)
          router.push(
            destination.pathname + destination.search + destination.hash,
          );
        else window.location.assign(destination.href);
      });
    };
    const traverse = (event: NavigateEvent) => {
      if (event.navigationType !== "traverse") return;
      if (approvedKey === event.destination.key) {
        approvedKey = null;
        return;
      }
      if (
        !event.cancelable ||
        !hasChanges() ||
        event.destination.url === window.location.href
      )
        return;
      event.preventDefault();
      void request().then((accepted) => {
        if (!accepted) return;
        const navigation = window.navigation;
        if (!navigation) return;
        approvedKey = event.destination.key;
        void navigation
          .traverseTo(event.destination.key)
          .finished?.catch(() => {
            approvedKey = null;
          });
      });
    };
    // Browsers without the Navigation API retain Back/Forward entries while
    // the custom confirmation runs, restoring the current entry first.
    const history = window.history;
    const originalPush = history.pushState;
    const originalReplace = history.replaceState;
    let currentHref = window.location.href;
    const key = "__168hoursIndex";
    let index = Number.isInteger(history.state?.[key])
      ? (history.state[key] as number)
      : 0;
    let restoring: (() => void) | null = null;
    let approvedIndex: number | null = null;
    const stamp = (state: unknown, at: number) => ({
      ...(state && typeof state === "object" ? state : {}),
      [key]: at,
    });
    const push: History["pushState"] = (state, unused, url) => {
      const at: unknown = history.state?.[key];
      if (typeof at === "number") index = at;
      originalPush.call(history, stamp(state, ++index), unused, url);
      currentHref = window.location.href;
    };
    const replace: History["replaceState"] = (state, unused, url) => {
      const at: unknown = history.state?.[key];
      if (typeof at === "number") index = at;
      originalReplace.call(history, stamp(state, index), unused, url);
      currentHref = window.location.href;
    };
    const pop = (event: PopStateEvent) => {
      const target: unknown = event.state?.[key];
      if (typeof target !== "number") return;
      if (restoring) {
        event.stopImmediatePropagation();
        const done = restoring;
        restoring = null;
        done();
        return;
      }
      if (
        target === approvedIndex ||
        !hasChanges() ||
        currentHref === window.location.href
      ) {
        index = target;
        currentHref = window.location.href;
        approvedIndex = null;
        return;
      }
      const delta = target - index;
      if (!delta) return;
      event.stopImmediatePropagation();
      const restored = new Promise<void>((resolve) => {
        restoring = resolve;
      });
      history.go(-delta);
      void restored.then(request).then((accepted) => {
        if (accepted) {
          approvedIndex = target;
          history.go(delta);
        }
      });
    };
    document.addEventListener(navigationEvent, beforeNavigation);
    document.addEventListener("click", click, true);
    if (window.navigation)
      window.navigation.addEventListener("navigate", traverse);
    else {
      originalReplace.call(history, stamp(history.state, index), "");
      history.pushState = push;
      history.replaceState = replace;
      window.addEventListener("popstate", pop, true);
    }
    return () => {
      document.removeEventListener(navigationEvent, beforeNavigation);
      document.removeEventListener("click", click, true);
      if (window.navigation)
        window.navigation.removeEventListener("navigate", traverse);
      else {
        window.removeEventListener("popstate", pop, true);
        if (history.pushState === push) history.pushState = originalPush;
        if (history.replaceState === replace)
          history.replaceState = originalReplace;
      }
    };
  }, [hasChanges, request, router]);
  return <Context value={register}>{children}</Context>;
}

export function useUnsavedChanges(
  dirty: boolean,
  message = "Your unsaved changes will be discarded.",
  blocked = false,
  onDiscard?: () => void,
) {
  const register = useContext(Context);
  if (!register) throw new Error("NavigationGuardProvider required");
  const latest = useRef<Guard>({ dirty, message, blocked, onDiscard });
  useLayoutEffect(() => {
    latest.current = { dirty, message, blocked, onDiscard };
  });
  useLayoutEffect(() => register(() => latest.current), [register]);
}
