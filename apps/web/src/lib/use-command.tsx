"use client";
import { useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { ApiError, uncertainWrite } from "@168hours/api-client";

/** One UI intent keeps one request key until the server confirms its outcome. */
export function useCommand<T, V = void>(options: {
  mutationFn: (variables: V, key: string) => Promise<T>;
  onSuccess?: (result: T) => unknown;
}) {
  const attempt = useRef<{ variables: V; key: string } | null>(null);
  const running = useRef(false);
  const mutation = useMutation({
    mutationFn: ({ variables, key }: { variables: V; key: string }) =>
      options.mutationFn(variables, key),
    onSuccess: options.onSuccess,
    retry: false,
    onSettled: (_data, error) => {
      running.current = false;
      if (!uncertainWrite(error)) attempt.current = null;
    },
  });
  const needsRetry = uncertainWrite(mutation.error);
  return {
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    isPending: mutation.isPending || needsRetry,
    needsRetry,
    retrying: mutation.isPending,
    mutate(variables: V) {
      if (running.current || attempt.current) return;
      running.current = true;
      attempt.current = { variables, key: crypto.randomUUID() };
      mutation.mutate(attempt.current);
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
          className="button"
          disabled={command.retrying}
          onClick={command.retry}
        >
          Retry same change
        </button>
      )}
      {command.error instanceof ApiError &&
        command.error.code === "STALE_REVISION" && (
          <button className="button" onClick={() => window.location.reload()}>
            Reload latest
          </button>
        )}
    </div>
  );
}
