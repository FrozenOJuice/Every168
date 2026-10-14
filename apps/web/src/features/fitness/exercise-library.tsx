"use client";
import { NotesField } from "./notes-field";
import { useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { exerciseInput, type Exercise } from "@168hours/contracts";
import { api } from "@/lib/api";
import { useCommand, CommandError } from "@/lib/use-command";
import { Loading, ErrorState, Empty } from "@/components/ui/feedback";
import { Dialog } from "@/components/ui/dialog";
import { fromKilograms } from "@168hours/domain-utils";
import { useMe } from "@/features/identity/me";
import { number } from "@/lib/format";
export function ExerciseLibrary({
  onChoose,
}: {
  onChoose?: (exercise: Exercise) => void;
}) {
  const cache = useQueryClient();
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const [editing, setEditing] = useState<Exercise | "new" | null>(null);
  const [history, setHistory] = useState<Exercise | null>(null);
  const query = useInfiniteQuery({
    queryKey: ["fitness", "exercises", search, archived],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.getExercises({
        search,
        archived: archived ? "true" : "false",
        cursor: pageParam,
      }),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const archive = useCommand({
    mutationFn: (
      { item, restore }: { item: Exercise; restore: boolean },
      key: string,
    ) =>
      restore
        ? api.restoreExercise(item.id, item.version, key)
        : api.archiveExercise(item.id, item.version, key),
    onSuccess: () =>
      cache.invalidateQueries({ queryKey: ["fitness", "exercises"] }),
  });
  return (
    <div className="form-stack">
      <div className="row between">
        <label className="field">
          Find an exercise
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button className="button" onClick={() => setEditing("new")}>
          Create exercise
        </button>
      </div>
      {!onChoose && (
        <label className="fitness-check">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          Show archived exercises
        </label>
      )}
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <ul className="record-list">
          {query.data.pages
            .flatMap((p) => p.items)
            .map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  {item.notes && <small>{item.notes}</small>}
                </div>
                <div className="row">
                  {onChoose ? (
                    <button className="button" onClick={() => onChoose(item)}>
                      Add {item.name}
                    </button>
                  ) : (
                    <>
                      <button
                        className="button"
                        onClick={() => setHistory(item)}
                      >
                        History
                      </button>
                      <button
                        className="button"
                        onClick={() => setEditing(item)}
                      >
                        Edit
                      </button>
                      <button
                        className="button"
                        disabled={archive.isPending}
                        onClick={() =>
                          archive.mutate({ item, restore: archived })
                        }
                      >
                        {archived ? "Restore" : "Archive"}
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
        </ul>
      )}
      {query.data?.pages[0]?.items.length === 0 && (
        <Empty>No exercises found. Create one to get started.</Empty>
      )}
      {query.hasNextPage && (
        <button
          className="button"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          More exercises
        </button>
      )}
      <CommandError command={archive} />
      {editing && (
        <Dialog
          title={editing === "new" ? "Create exercise" : "Edit exercise"}
          onClose={() => setEditing(null)}
        >
          <ExerciseEditor
            item={editing === "new" ? undefined : editing}
            onSaved={(item) => {
              void cache.invalidateQueries({
                queryKey: ["fitness", "exercises"],
              });
              setEditing(null);
              if (onChoose) onChoose(item);
            }}
          />
        </Dialog>
      )}
      {history && (
        <Dialog
          title={`${history.name} history`}
          onClose={() => setHistory(null)}
        >
          <ExerciseHistory id={history.id} />
        </Dialog>
      )}
    </div>
  );
}
function ExerciseEditor({
  item,
  onSaved,
}: {
  item?: Exercise;
  onSaved: (item: Exercise) => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [error, setError] = useState("");
  const save = useCommand({
    mutationFn: (v: { name: string; notes: string | null }, key: string) =>
      item
        ? api.updateExercise(item.id, v, item.version, key)
        : api.createExercise(v, key),
    onSuccess: onSaved,
  });
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const v = exerciseInput.safeParse({ name, notes: notes || null });
        if (v.success) {
          setError("");
          save.mutate(v.data);
        } else setError(v.error.issues[0]!.message);
      }}
    >
      <fieldset className="form-stack" disabled={save.isPending}>
        <label>
          Exercise name
          <input
            required
            maxLength={160}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <NotesField
          label="Instructions (optional)"
          value={notes}
          onChange={(notes) => setNotes(notes ?? "")}
        />
        <button className="button primary">Save exercise</button>
      </fieldset>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <CommandError command={save} />
    </form>
  );
}
export function ExerciseHistory({ id }: { id: string }) {
  const { weightUnit: unit, timezone } = useMe().preferences;
  const query = useInfiniteQuery({
    queryKey: ["fitness", "exercise-history", id],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.getStrengthProgress(id, { cursor: pageParam }),
    getNextPageParam: (p) => p.history.nextCursor ?? undefined,
  });
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const entries = query.data.pages.flatMap((p) => p.history.items);
  return (
    <>
      <p className="muted text-small">
        Completed sets, most recently recorded first.
      </p>
      {entries.length === 0 ? (
        <Empty>No completed sets yet.</Empty>
      ) : (
        <ul className="record-list">
          {entries.map((s) => (
            <li key={s.id}>
              <a href={`/fitness/session/${s.workoutId}`}>
                {new Intl.DateTimeFormat("en", {
                  timeZone: timezone,
                  dateStyle: "medium",
                }).format(new Date(s.startedAt))}
              </a>
              <span>
                {s.reps !== null ? `${s.reps} reps` : ""}
                {s.weightKg !== null
                  ? ` · ${number(fromKilograms(s.weightKg, unit))} ${unit}`
                  : ""}
                {s.durationSeconds !== null ? ` · ${s.durationSeconds}s` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      {query.hasNextPage && (
        <button className="button" onClick={() => void query.fetchNextPage()}>
          More sets
        </button>
      )}
    </>
  );
}
