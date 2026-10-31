"use client";

import { useLayoutEffect, useRef } from "react";
import { Search } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState, Loading } from "@/components/ui/feedback";

/** Presentation shared by domain-owned scheduling pickers; no domain APIs here. */
export function CalendarSourcePicker({
  title,
  searchLabel,
  search,
  onSearch,
  choices,
  loading,
  error,
  onRetry,
  emptyMessage,
  onSelect,
  onClose,
  onLoadMore,
  loadingMore,
}: {
  title: string;
  searchLabel: string;
  search: string;
  onSearch: (value: string) => void;
  choices: { id: string; title: string; detail?: string }[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  emptyMessage: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  onLoadMore?: () => void;
  loadingMore?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    input.current?.focus();
  }, []);
  return (
    <Dialog title={title} onClose={onClose} className="calendar-source-picker">
      <label className="calendar-source-search">
        <span className="sr-only">{searchLabel}</span>
        <Search size={18} aria-hidden="true" />
        <input
          ref={input}
          type="search"
          maxLength={160}
          placeholder={`${searchLabel}…`}
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
      </label>
      <div className="calendar-source-list" aria-busy={loading || loadingMore}>
        {loading ? (
          <Loading />
        ) : (
          <>
            {choices.map((choice) => (
              <button
                type="button"
                className="calendar-source-choice"
                key={choice.id}
                onClick={() => onSelect(choice.id)}
              >
                <strong>{choice.title}</strong>
                {choice.detail && <small>{choice.detail}</small>}
              </button>
            ))}
            {!choices.length && !error && (
              <p className="muted">{emptyMessage}</p>
            )}
          </>
        )}
        {error && <ErrorState error={error} retry={onRetry} />}
        {onLoadMore && (
          <button
            type="button"
            className="button"
            disabled={loadingMore}
            onClick={onLoadMore}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        )}
      </div>
      <div className="calendar-source-footer">
        <button type="button" className="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Dialog>
  );
}
