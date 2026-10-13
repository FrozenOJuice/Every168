"use client";
import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";
import { ApiError } from "@168hours/api-client";
import { clearCalendarHistory } from "@/features/planning/calendar-history-store";
function handleError(error: Error) {
  if (
    error instanceof ApiError &&
    error.status === 401 &&
    !window.location.pathname.startsWith("/login")
  ) {
    clearCalendarHistory();
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Clear the document and router cache across account changes.
    window.location.assign("/login");
  }
}
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError: handleError }),
        mutationCache: new MutationCache({ onError: handleError }),
        defaultOptions: {
          queries: {
            staleTime: 30000,
            retry: (count, error) =>
              !(error instanceof ApiError && error.status < 500) && count < 1,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
