"use client";

/** Later-page and refresh failures must not replace already loaded records. */
export function RetainedReadError({
  query,
  label,
}: {
  label: string;
  query: {
    error: Error | null;
    data?: unknown;
    isFetchNextPageError: boolean;
    isFetching: boolean;
    fetchNextPage: () => unknown;
    refetch: () => unknown;
  };
}) {
  if (!query.error || !query.data) return null;
  const more = query.isFetchNextPageError;
  return (
    <div role="alert">
      <p className="error">
        {more ? `Couldn’t load more ${label}.` : `Couldn’t refresh ${label}.`}{" "}
        Your loaded results are still available.
      </p>
      <button
        type="button"
        className="button"
        disabled={query.isFetching}
        onClick={() => {
          if (more) void query.fetchNextPage();
          else void query.refetch();
        }}
      >
        {more ? `Retry loading ${label}` : `Retry refreshing ${label}`}
      </button>
    </div>
  );
}
