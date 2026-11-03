"use client";
import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  useRef,
  Fragment,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { localDate } from "@168hours/domain-utils";
import { useMe } from "@/features/identity/me";
import { api } from "@/lib/api";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import {
  foodApi,
  foodWriteEvent,
  foodWriteRunning,
  foodWriteStorageError,
  pendingFoodWrite,
  retryFoodWrite,
  setFoodWriteOwner,
} from "./food-write-recovery";

const Context = createContext(false);
export function useFoodWritePending() {
  return useContext(Context);
}
// Measurement components also serve Calendar. Only Food opts into this journal.
const ApiContext = createContext(api);
export function useMeasurementApi() {
  return useContext(ApiContext);
}

export function FoodWriteProvider({ children }: { children: ReactNode }) {
  const {
    user,
    preferences: { timezone },
  } = useMe();
  const router = useRouter();
  const params = useSearchParams();
  const cache = useQueryClient();
  const [pending, setPending] = useState(false),
    [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recovered, setRecovered] = useState(false),
    [generation, setGeneration] = useState(0);
  const [host, setHost] = useState<Element | null>(null);
  const retry = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    setFoodWriteOwner(user.id);
    const sync = () => {
      try {
        setPending(!!pendingFoodWrite());
        setError(foodWriteStorageError());
      } catch {
        setPending(true);
        setError(
          "Saved Food recovery could not be read. Keep this tab open and restore browser storage before continuing.",
        );
      }
      setRunning(foodWriteRunning());
      setHost(document.querySelector("dialog[open]"));
    };
    sync();
    try {
      // Hydrate the account-scoped external receipt before interaction.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecovered(!!pendingFoodWrite());
    } catch {
      setRecovered(true);
    }
    window.addEventListener(foodWriteEvent, sync);
    return () => {
      window.removeEventListener(foodWriteEvent, sync);
      setFoodWriteOwner(null);
    };
  }, [user.id]);
  useUnsavedChanges(
    pending,
    "Confirm the previous Food change before leaving.",
    pending,
  );
  useLayoutEffect(() => {
    if (recovered) retry.current?.focus();
  }, [recovered, host]);
  const notice =
    (pending && (recovered || (!host && !running))) || error ? (
      <section className="notice" role="alert" aria-label="Food save recovery">
        <p>
          {error ??
            "A Food change still needs confirmation. Retry the saved change before continuing."}
        </p>
        {pending && (
          <button
            ref={retry}
            className="button primary"
            disabled={running}
            onClick={async () => {
              try {
                const result = await retryFoodWrite();
                setPending(!!pendingFoodWrite());
                setRecovered(false);
                setError(null);
                setGeneration((v) => v + 1);
                await Promise.all(
                  [
                    "food",
                    "nutrition",
                    "water",
                    "weight",
                    "calendar-activity",
                    "dashboard",
                  ].map((key) => cache.invalidateQueries({ queryKey: [key] })),
                );
                if (result) {
                  const next = new URLSearchParams(params.toString());
                  next.set("view", result.view);
                  if (result.at)
                    next.set("date", localDate(result.at, timezone));
                  router.replace(`/food?${next}`);
                }
              } catch (e) {
                setError((e as Error).message);
                try {
                  if (!pendingFoodWrite()) {
                    setPending(false);
                    setGeneration((v) => v + 1);
                    await cache.invalidateQueries();
                  }
                } catch {
                  /* Keep unreadable recovery blocked. */
                }
              }
            }}
          >
            Retry saved change
          </button>
        )}
      </section>
    ) : null;
  return (
    <ApiContext.Provider value={foodApi}>
      <Context.Provider value={pending}>
        {notice && (host?.isConnected ? createPortal(notice, host) : notice)}
        <Fragment key={generation}>{children}</Fragment>
      </Context.Provider>
    </ApiContext.Provider>
  );
}
