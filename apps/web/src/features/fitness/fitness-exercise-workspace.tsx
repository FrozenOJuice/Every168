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
import { FitnessSectionJump } from "./fitness-section-jump";
import { restoreActionFocus } from "@/components/ui/tooltip-button";

type Choose = (exercise: Exercise) => boolean | void;
const WorkspaceContext = createContext<{
  register: (choose: Choose) => () => void;
  setSessionEditor: (path: string | null) => void;
  setRecordedSession: (path: string | null) => void;
  pick: () => void;
  help: (id: string, history?: boolean, mode?: ExerciseLoggingType) => void;
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
  const trainingView = pathname === "/fitness";
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
  const [helpId, setHelpId] = useState<string | null>(null);
  const [helpHistory, setHelpHistory] = useState(false);
  const [helpReturnsToWorkout, setHelpReturnsToWorkout] = useState(false);
  const helpScroll = useRef({ page: 0, pane: 0 });
  const [helpMode, setHelpMode] = useState<ExerciseLoggingType>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dayOpen, setDayOpen] = useState(false);
  const [exerciseEditorOpen, setExerciseEditorOpen] = useState(false);
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
    setHelpId(null);
    setDayOpen(false);
  }, []);
  const [previousPath, setPreviousPath] = useState(pathname);
  if (previousPath !== pathname) {
    setPreviousPath(pathname);
    setExerciseEditorOpen(false);
    setHelpId(null);
    setNotice("");
    setPickerOpen(false);
  }
  useLayoutEffect(() => {
    workout.current?.closest(".fitness-primary-pane")?.scrollTo({ top: 0 });
  }, [pathname]);
  const closeHelp = () => {
    setHelpId(null);
    if (helpReturnsToWorkout) {
      setPickerOpen(false);
      requestAnimationFrame(() => {
        const pane = workout.current?.closest(".fitness-primary-pane");
        if (pane) pane.scrollTop = helpScroll.current.pane;
        window.scrollTo({ top: helpScroll.current.page });
        if (opener.current?.isConnected) restoreActionFocus(opener.current);
      });
      return;
    }
    setPickerOpen(true);
    requestAnimationFrame(() => {
      library.current
        ?.querySelector<HTMLInputElement>(
          '.fitness-exercise-panel input[type="search"]',
        )
        ?.focus({ preventScroll: true });
    });
  };
  return (
    <WorkspaceContext.Provider
      value={{
        register,
        setSessionEditor,
        setRecordedSession,
        pick: () => {
          opener.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
          setHelpId(null);
          setBrowseRequest((request) => request + 1);
          setPickerOpen(true);
        },
        help: (id, history = false, mode) => {
          setHelpReturnsToWorkout(pathname.startsWith("/fitness/session/"));
          helpScroll.current = {
            page: window.scrollY,
            pane:
              workout.current?.closest(".fitness-primary-pane")?.scrollTop ?? 0,
          };
          opener.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
          setHelpId(id);
          setHelpHistory(history);
          setHelpMode(mode);
          setBrowseRequest((request) => request + 1);
          setPickerOpen(true);
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
                aria-current={!progressView ? "page" : undefined}
              >
                Training
              </Link>
              <Link
                href="/fitness/history"
                aria-current={progressView ? "page" : undefined}
              >
                History
              </Link>
            </nav>
            {trainingView && !pickerOpen && !exerciseEditorOpen && (
              <FitnessSectionJump />
            )}
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
              workoutLabel={
                recordedSessionPath === pathname
                  ? "Recorded results"
                  : "Your workout"
              }
              view={
                building
                  ? "builder"
                  : trainingView
                    ? "training"
                    : activeWorkout
                      ? "workout"
                      : "content"
              }
              resetKey={`${pathname}:${browseRequest}`}
              filterContext={
                pathname.startsWith("/fitness/exercises/")
                  ? "/fitness"
                  : pathname
              }
              onEditorOpen={() => {
                setExerciseEditorOpen(true);
                requestAnimationFrame(() =>
                  library.current
                    ?.querySelector(".fitness-primary-pane")
                    ?.scrollIntoView({ block: "start" }),
                );
              }}
              onEditorClose={() => setExerciseEditorOpen(false)}
              pickerOpen={pickerOpen}
              onShowPicker={() => setPickerOpen(true)}
              onDismissPicker={() => {
                setHelpId(null);
                setPickerOpen(false);
                requestAnimationFrame(() => {
                  if (helpId && opener.current?.isConnected) {
                    opener.current.focus({ preventScroll: true });
                    return;
                  }
                  workout.current
                    ?.querySelector<HTMLElement>("[data-add-exercise]")
                    ?.focus();
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
                        ? "Back to workout"
                        : "Back to exercises"
                    }
                    history={helpHistory}
                    mode={helpMode}
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
          <Dialog title="Your day" onClose={() => setDayOpen(false)}>
            <FitnessDayPanel onNavigate={() => setDayOpen(false)} />
          </Dialog>
        )}
      </div>
    </WorkspaceContext.Provider>
  );
}
