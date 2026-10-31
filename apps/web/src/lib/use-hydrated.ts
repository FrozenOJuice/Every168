"use client";
import { useSyncExternalStore } from "react";
const subscribe = () => () => {};
/** Delay interactive controls until client hydration has installed their handlers. */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
