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
import Link from "next/link";
import type { Exercise, ExerciseLoggingType } from "@168hours/contracts";
import { ExerciseLibrary } from "./exercise-library";
import { ExerciseHelp } from "./exercise-help";
import { CalendarDays } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { workoutCreationExperiment } from "./workout-creation-experiment";
import { FitnessDayPanel } from "./fitness-day-panel";
import { useFitnessNavigation } from "./fitness-navigation";

type Choose = (exercise: Exercise) => boolean | void;
const WorkspaceContext = createContext<{
  editorNavigationTarget: HTMLDivElement | null;
  showWorkout: () => Promise<void>;
  register: (choose: Choose) => () => void;
  setSessionEditor: (path: string | null) => void;
  setRecordedSession: (path: string | null) => void;
  pick: () => void;
  help: (
    id: string,
    history?: boolean,
    mode?: ExerciseLoggingType,
    fromLibrary?: boolean,
  ) => void;
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
  const navigation = useFitnessNavigation();
  const exercisesView = pathname === "/fitness/exercises";
  const exerciseRoute = pathname.startsWith("/fitness/exercises");
  const [recordedSessionPath, setRecordedSession] = useState<string | null>(
    null,
  );
  const progressView =
    recordedSessionPath === pathname ||
    pathname.startsWith("/fitness/history") ||
    pathname.startsWith("/fitness/progress");
  const [sessionEditorPath, setSessionEditorPath] = useState<string | null>(
    null,
  );
  const editingSession = sessionEditorPath === pathname;
  const building =
    workoutCreationExperiment &&
    (pathname.startsWith("/fitness/workout/") || editingSession);
  const activeWorkout = /\/fitness\/(workout|session)\//.test(pathname);
  const [choose, setChoose] = useState<Choose | null>(null);
  const [editorNavigationTarget, setEditorNavigationTarget] =
    useState<HTMLDivElement | null>(null);
  const help =
    navigation.current?.kind === "exercise" && navigation.current.inline
      ? navigation.current
      : undefined;
  const helpId = help?.exerciseId;
  const helpHistory = help?.history ?? false;
  const helpMode = help?.mode;
  const helpReturnsToWorkout = !!help;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dayOpen, setDayOpen] = useState(false);
  const [dayBusy, setDayBusy] = useState(false);
  const [browseRequest, setBrowseRequest] = useState(0);
  const [notice, setNotice] = useState("");
  const opener = useRef<HTMLElement | null>(null);
  const library = useRef<HTMLDivElement>(null);
  const workout = useRef<HTMLElement>(null);
  const register = useCallback((next: Choose) => {
    setChoose(() => next);
    return () => setChoose(null);
  }, []);
  const setSessionEditor = useCallback((path: string | null) => {
    setSessionEditorPath(path);
    setPickerOpen(false);
    setDayOpen(false);
  }, []);
  const [previousPath, setPreviousPath] = useState(pathname);
  if (previousPath !== pathname) {
    setPreviousPath(pathname);
    setNotice("");
    setPickerOpen(false);
  }
  useLayoutEffect(() => {
    workout.current?.closest(".fitness-primary-pane")?.scrollTo({ top: 0 });
  }, [pathname]);
  const closeHelp = () => {
    setPickerOpen(false);
    void navigation.back();
  };

  return (
    <WorkspaceContext.Provider
      value={{
        editorNavigationTarget,
        showWorkout: async () => {
          if (help) await navigation.back();
          setPickerOpen(false);
        },
        register,
        setSessionEditor,
        setRecordedSession,
        pick: () => {
          opener.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
          setBrowseRequest((request) => request + 1);
          setPickerOpen(true);
        },
        help: (id, history = false, mode, fromLibrary = false) => {
          navigation.openExercise({
            id,
            history,
            mode,
            inline: activeWorkout,
            compact: building,
            fromLibrary,
            view:
              recordedSessionPath === pathname
                ? editingSession
                  ? "corrections"
                  : "summary"
                : building
                  ? "editor"
                  : "live",
          });
        },
      }}
    >
      <div
        className={`fitness-workspace fitness-library-workspace fitness-stacked-workspace domain-workspace fitness-organized-workspace${building ? " fitness-creation-experiment" : ""}${editingSession ? " fitness-session-editing-workspace" : ""}`}
      >
        <div className="domain-main fitness-domain-main">
          <h1 className="sr-only">Fitness</h1>
          <div className="domain-workspace-tools">
            <nav className="fitness-domain-nav" aria-label="Fitness views">
              <Link
                href="/fitness"
                aria-current={
                  !progressView && !exerciseRoute ? "page" : undefined
                }
              >
                Training
              </Link>
              <Link
                href="/fitness/exercises"
                aria-current={exerciseRoute ? "page" : undefined}
              >
                Exercises
              </Link>
              <Link
                href="/fitness/history"
                aria-current={progressView ? "page" : undefined}
              >
                History
              </Link>
            </nav>
            {!building && (
              <button
                className="button domain-mobile-day"
                onClick={() => setDayOpen(true)}
                aria-haspopup="dialog"
              >
                <CalendarDays size={17} aria-hidden="true" />
                Day
              </button>
            )}
          </div>
          <div ref={library} className="fitness-library-host">
            {notice && (
              <p className="fitness-panel-notice" role="status">
                {notice}
              </p>
            )}
            <ExerciseLibrary
              editorNavigationRef={setEditorNavigationTarget}
              workoutLabel={
                recordedSessionPath === pathname
                  ? "Recorded results"
                  : "Your workout"
              }
              view={
                building
                  ? "builder"
                  : exercisesView
                    ? "library"
                    : activeWorkout
                      ? "workout"
                      : "content"
              }
              resetKey={`${pathname}:${browseRequest}`}
              filterContext={exerciseRoute ? "/fitness/exercises" : pathname}
              onEditorOpen={() => {
                requestAnimationFrame(() =>
                  library.current
                    ?.querySelector(".fitness-primary-pane")
                    ?.scrollIntoView({ block: "start" }),
                );
              }}
              pickerOpen={pickerOpen || !!help}
              onShowPicker={() => setPickerOpen(true)}
              onDismissPicker={() => {
                if (help) closeHelp();
                setPickerOpen(false);
                requestAnimationFrame(() => {
                  if (helpId && opener.current?.isConnected) {
                    opener.current.focus({ preventScroll: true });
                    return;
                  }
                  const target =
                    workout.current?.querySelector<HTMLElement>(
                      "[data-add-exercise]",
                    ) ??
                    workout.current?.querySelector<HTMLElement>(
                      ".fitness-builder-setup input",
                    );
                  target?.focus({ preventScroll: true });
                });
              }}
              detailContent={
                helpId ? (
                  <ExerciseHelp
                    key={`${helpId}:${helpHistory}:${helpMode}`}
                    id={helpId}
                    onClose={closeHelp}
                    backLabel={
                      helpReturnsToWorkout
                        ? navigation.parent?.view === "summary"
                          ? "Back to summary"
                          : "Back to workout"
                        : "Back to Exercises"
                    }
                    compact={building}
                    history={helpHistory}
                    mode={helpMode}
                    onChoose={
                      help?.fromLibrary && choose
                        ? (exercise) => {
                            const accepted = choose(exercise);
                            if (accepted !== false) closeHelp();
                          }
                        : undefined
                    }
                  />
                ) : undefined
              }
              onChoose={
                choose
                  ? (exercise) => {
                      const accepted = choose(exercise);
                      if (accepted !== false) {
                        setPickerOpen(false);
                        requestAnimationFrame(() =>
                          workout.current
                            ?.querySelector<HTMLElement>("[data-add-exercise]")
                            ?.focus({ preventScroll: true }),
                        );
                      }
                      setNotice(
                        accepted === false
                          ? "Cannot add another exercise right now."
                          : "",
                      );
                      return accepted;
                    }
                  : undefined
              }
              mainContent={
                <section
                  ref={workout}
                  tabIndex={-1}
                  className="fitness-main-workspace"
                  aria-label="Workout workspace"
                >
                  {children}
                </section>
              }
            />
          </div>
        </div>
        {!building && (
          <aside
            className="domain-calendar-rail"
            aria-label="Fitness day panel"
          >
            <FitnessDayPanel onNavigate={() => setDayOpen(false)} />
          </aside>
        )}
        {!building && dayOpen && (
          <Dialog
            title="Your day"
            busy={dayBusy}
            onClose={() => setDayOpen(false)}
          >
            <FitnessDayPanel
              onBusyChange={setDayBusy}
              onNavigate={() => setDayOpen(false)}
            />
          </Dialog>
        )}
      </div>
    </WorkspaceContext.Provider>
  );
}
