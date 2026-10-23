"use client";
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import type { Exercise } from "@168hours/contracts";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Loading, ErrorState } from "@/components/ui/feedback";
import { ExerciseLibrary } from "./exercise-library";
import { ExerciseDetails } from "./exercise-details";
import { CalendarDays, Dumbbell, Library } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { FitnessDayPanel } from "./fitness-day-panel";

type Choose = (exercise: Exercise) => boolean | void;
const WorkspaceContext = createContext<{
  register: (choose: Choose) => () => void;
  pick: () => void;
  help: (id: string) => void;
} | null>(null);
export function useFitnessExercisePanel() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("Fitness exercise controls require a workspace.");
  return value;
}
export function FitnessExerciseWorkspace({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const activeWorkout = /\/fitness\/(workout|session)\//.test(pathname);
  const [choose, setChoose] = useState<Choose | null>(null);
  const [helpId, setHelpId] = useState<string | null>(null);
  const [mobileLibrary, setMobileLibrary] = useState(false);
  const [dayVisible, setDayVisible] = useState(!activeWorkout);
  const [dayOpen, setDayOpen] = useState(false);
  const [browseRequest, setBrowseRequest] = useState(0);
  const [notice, setNotice] = useState("");
  const opener = useRef<HTMLElement | null>(null);
  const library = useRef<HTMLDivElement>(null);
  const workout = useRef<HTMLElement>(null);
  const register = useCallback((next: Choose) => {
    setChoose(() => next);
    return () => setChoose(null);
  }, []);
  const [previousPath, setPreviousPath] = useState(pathname);
  if (previousPath !== pathname) {
    setPreviousPath(pathname);
    setHelpId(null);
    setMobileLibrary(false);
    setNotice("");
    setDayVisible(!activeWorkout);
  }
  useLayoutEffect(() => {
    workout.current?.closest(".fitness-primary-pane")?.scrollTo({ top: 0 });
  }, [pathname]);
  const closeHelp = () => {
    setHelpId(null);
    requestAnimationFrame(() => {
      if (opener.current?.isConnected)
        opener.current.focus({ preventScroll: true });
    });
  };
  return (
    <WorkspaceContext.Provider
      value={{
        register,
        pick: () => {
          setDayVisible(false);
          opener.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
          setHelpId(null);
          setBrowseRequest((request) => request + 1);
          setMobileLibrary(true);
          requestAnimationFrame(() =>
            library.current
              ?.querySelector<HTMLInputElement>(
                '.fitness-exercise-panel input[type="search"]',
              )
              ?.focus({ preventScroll: true }),
          );
        },
        help: (id) => {
          setDayVisible(false);
          opener.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
          setHelpId(id);
          setMobileLibrary(true);
        },
      }}
    >
      <div
        className={`fitness-workspace fitness-library-workspace${activeWorkout ? " has-active-workout" : ""}${mobileLibrary ? " shows-mobile-library" : ""}${dayVisible ? " has-day-panel" : ""}`}
      >
        <header className="domain-workspace-heading">
          <div>
            <Dumbbell size={20} aria-hidden="true" />
            <h1>Fitness</h1>
          </div>
          <div role="group" aria-label="Fitness side panel">
            <button
              className="button"
              aria-pressed={!dayVisible}
              onClick={() => {
                setDayVisible(false);
                setMobileLibrary(true);
                requestAnimationFrame(() =>
                  library.current
                    ?.querySelector<HTMLInputElement>('input[type="search"]')
                    ?.focus(),
                );
              }}
            >
              <Library size={17} aria-hidden="true" />
              Exercises
            </button>
            <button
              className="button"
              aria-pressed={dayVisible}
              onClick={() => {
                setDayVisible(true);
                setMobileLibrary(false);
                if (window.matchMedia("(max-width: 1150px)").matches)
                  setDayOpen(true);
              }}
            >
              <CalendarDays size={17} aria-hidden="true" />
              Day
            </button>
          </div>
        </header>
        <div ref={library} className="fitness-library-host">
          {activeWorkout && (
            <button
              type="button"
              className="fitness-text-action fitness-mobile-workout-return"
              aria-label="Back to workout"
              onClick={() => {
                setMobileLibrary(false);
                requestAnimationFrame(() =>
                  workout.current
                    ?.querySelector<HTMLButtonElement>(
                      "button[data-add-exercise]",
                    )
                    ?.focus(),
                );
              }}
            >
              ← Back to workout
            </button>
          )}
          {notice && (
            <p className="fitness-panel-notice" role="status">
              {notice}
            </p>
          )}
          <ExerciseLibrary
            sidePanel={<FitnessDayPanel onNavigate={() => setDayOpen(false)} />}
            showSidePanel={dayVisible}
            resetKey={`${pathname}:${browseRequest}`}
            onEditorOpen={() => setMobileLibrary(false)}
            onEditorClose={() =>
              setMobileLibrary(window.matchMedia("(max-width: 1000px)").matches)
            }
            exerciseDetail={
              helpId ? (
                <ExerciseHelp id={helpId} onClose={closeHelp} />
              ) : undefined
            }
            onChoose={
              choose
                ? (exercise) => {
                    const accepted = choose(exercise);
                    setNotice(
                      accepted === false
                        ? "Cannot add another exercise right now."
                        : "",
                    );
                  }
                : undefined
            }
            mainContent={
              <section
                ref={workout}
                className="fitness-main-workspace"
                aria-label="Workout workspace"
              >
                {children}
              </section>
            }
          />
        </div>
        {dayOpen && (
          <Dialog title="Your day" onClose={() => setDayOpen(false)}>
            <FitnessDayPanel onNavigate={() => setDayOpen(false)} />
          </Dialog>
        )}
      </div>
    </WorkspaceContext.Provider>
  );
}
function ExerciseHelp({ id, onClose }: { id: string; onClose: () => void }) {
  const query = useQuery({
    queryKey: ["fitness", "exercise", id],
    queryFn: () => api.getExercise(id),
  });
  const catalog = useQuery({
    queryKey: ["fitness", "catalog"],
    queryFn: api.getExerciseCatalog,
    enabled: !!query.data?.catalogKey,
  });
  if (query.isPending || (query.data?.catalogKey && catalog.isPending))
    return <Loading />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  if (query.data?.catalogKey && catalog.error)
    return (
      <ErrorState error={catalog.error} retry={() => void catalog.refetch()} />
    );
  const exercise = query.data!;
  return (
    <ExerciseDetails
      key={id}
      item={{
        key: exercise.catalogKey ?? id,
        name: exercise.name,
        notes: exercise.notes,
        equipment: exercise.equipment,
        muscles: exercise.muscles,
        exercise,
        definition: catalog.data?.find(
          (entry) => entry.key === exercise.catalogKey,
        ),
      }}
      onClose={onClose}
      onDuplicated={() => {}}
      workoutContext
    />
  );
}
