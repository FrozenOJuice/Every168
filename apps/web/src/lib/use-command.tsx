"use client";
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ApiError, uncertainWrite } from "@168hours/api-client";

/** One UI intent keeps one request key until the server confirms its outcome. */
export function useCommand<T, V = void>(options: {
  mutationFn: (variables: V, key: string) => Promise<T>;
  onSuccess?: (result: T) => unknown;
  onError?: (error: Error) => unknown;
  persistence?: { key: string; parse: (value: unknown) => V };
}) {
  const [recovered] = useState(() => {
    if (!options.persistence) return null;
    try {
      const value = JSON.parse(
        sessionStorage.getItem(options.persistence.key) ?? "null",
      );
      if (
        !value ||
        typeof value.key !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(value.key)
      )
        return null;
      return {
        variables: options.persistence.parse(value.variables),
        key: value.key as string,
      };
    } catch {
      return null;
    }
  });
  const [restored, setRestored] = useState(!!recovered);
  const [storageError, setStorageError] = useState<Error | null>(null);
  const attempt = useRef<{ variables: V; key: string } | null>(recovered);
  const running = useRef(false);
  const mutation = useMutation({
    mutationFn: ({ variables, key }: { variables: V; key: string }) =>
      options.mutationFn(variables, key),
    onSuccess: options.onSuccess,
    onError: options.onError,
    retry: false,
    onSettled: (_data, error) => {
      running.current = false;
      if (!uncertainWrite(error)) {
        attempt.current = null;
        setRestored(false);
        if (options.persistence)
          try {
            sessionStorage.removeItem(options.persistence.key);
          } catch {}
      }
    },
  });
  const needsRetry = restored || uncertainWrite(mutation.error);
  return {
    recoveredVariables: recovered?.variables,
    error:
      storageError ??
      mutation.error ??
      (restored
        ? new Error("Confirm the previous change before continuing.")
        : null),
    isSuccess: mutation.isSuccess,
    isPending: mutation.isPending || needsRetry,
    needsRetry,
    retrying: mutation.isPending,
    mutate(variables: V) {
      if (running.current || attempt.current) return;
      const next = { variables, key: crypto.randomUUID() };
      if (options.persistence) {
        try {
          sessionStorage.setItem(options.persistence.key, JSON.stringify(next));
          setStorageError(null);
        } catch {
          setStorageError(
            new Error(
              "Local recovery storage is unavailable. Your change has not been sent. Enable storage and try again.",
            ),
          );
          return;
        }
      }
      running.current = true;
      attempt.current = next;
      mutation.mutate(next);
    },
    retry() {
      if (running.current || !attempt.current) return;
      running.current = true;
      mutation.mutate(attempt.current);
    },
  };
}

export function CommandError({
  command,
}: {
  command: {
    error: Error | null;
    needsRetry: boolean;
    retrying: boolean;
    retry: () => void;
  };
}) {
  if (!command.error) return null;
  return (
    <div role="alert">
      <p className="error">{command.error.message}</p>
      {command.needsRetry && (
        <button
          type="button"
          className="button"
          disabled={command.retrying}
          onClick={command.retry}
        >
          Retry same change
        </button>
      )}
      {command.error instanceof ApiError &&
        command.error.code === "STALE_REVISION" && (
          <button
            type="button"
            className="button"
            onClick={() => window.location.reload()}
          >
            Reload latest
          </button>
        )}
    </div>
  );
}
