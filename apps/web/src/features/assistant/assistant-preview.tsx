"use client";
import { useId, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  ArrowUp,
  ArrowUpRight,
  CalendarDays,
  Dumbbell,
  MessageSquare,
  Plus,
  Utensils,
  X,
  Move,
  MoveDiagonal2,
} from "lucide-react";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { formatDate } from "@/lib/format";
import { useAssistant } from "./assistant-state";
import { usePopupFrame } from "./use-popup-frame";
import type { ResizeEdge } from "./assistant-popup-frame";

function subscribeToMobile(change: () => void) {
  const media = window.matchMedia("(max-width: 600px)");
  media.addEventListener("change", change);
  return () => media.removeEventListener("change", change);
}
const mobileSnapshot = () => window.matchMedia("(max-width: 600px)").matches;
const serverSnapshot = () => false;

function subscribeToDialogs(change: () => void) {
  const observer = new MutationObserver(change);
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["open"],
  });
  return () => observer.disconnect();
}
const modalHost = () =>
  Array.from(
    document.querySelectorAll<HTMLDialogElement>(
      "dialog:modal:not(.assistant-popup):not(.confirmation-dialog)",
    ),
  ).at(-1) ?? null;
const noHost = () => null;

export function AssistantNavigationLink() {
  const assistant = useAssistant();
  const path = usePathname();
  return (
    <Link
      href="/assistant"
      aria-current={path === "/assistant" ? "page" : undefined}
      onNavigate={() => {
        assistant.prepare();
        assistant.closePopup();
      }}
    >
      <MessageSquare size={20} strokeWidth={1.7} aria-hidden="true" />
      <span>Assistant</span>
    </Link>
  );
}

/** Temporary quick chat; the dedicated route shares the same state and composer. */
export function AssistantLauncher() {
  const assistant = useAssistant();
  const path = usePathname();
  const id = useId();
  // Native modal editors make outside controls inert. Keep quick chat reachable
  // inside the active editor without copying its records into Assistant state.
  const host = useSyncExternalStore(subscribeToDialogs, modalHost, noHost);
  if (path === "/assistant") return null;
  const content = (
    <>
      <TooltipButton
        type="button"
        id={`${id}-launcher`}
        className="assistant-launcher"
        hidden={assistant.popupOpen}
        tooltip="Ask Assistant"
        aria-label="Ask Assistant"
        aria-haspopup="dialog"
        aria-expanded={assistant.popupOpen}
        aria-controls={assistant.popupOpen ? id : undefined}
        onClick={assistant.openPopup}
      >
        <MessageSquare size={23} strokeWidth={1.7} aria-hidden="true" />
      </TooltipButton>
      {assistant.popupOpen &&
        createPortal(
          <AssistantPopup
            id={id}
            withinDialog={!!host}
            restoreFocus={() => {
              const trigger = document.getElementById(`${id}-launcher`);
              if (trigger?.getClientRects().length)
                trigger.focus({ preventScroll: true });
            }}
          />,
          document.body,
        )}
    </>
  );
  return host ? createPortal(content, host) : content;
}

function AssistantPopup({
  id,
  restoreFocus,
  withinDialog,
}: {
  id: string;
  restoreFocus: () => void;
  withinDialog: boolean;
}) {
  const assistant = useAssistant();
  const mobile = useSyncExternalStore(
    subscribeToMobile,
    mobileSnapshot,
    serverSnapshot,
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const modal = mobile || withinDialog;
  const frame = usePopupFrame(
    dialog,
    !mobile,
    assistant.popupFrame,
    assistant.changePopupFrame,
  );
  const callbacks = useRef({ close: assistant.closePopup, restoreFocus });
  useLayoutEffect(() => {
    callbacks.current = { close: assistant.closePopup, restoreFocus };
  });
  useLayoutEffect(() => {
    const element = dialog.current!;
    const focused = document.activeElement;
    const retained =
      focused instanceof HTMLElement && element.contains(focused)
        ? focused
        : null;
    if (modal) element.showModal();
    else element.show();
    const target = retained?.isConnected
      ? retained
      : element.querySelector<HTMLElement>(
          mobile ? "[data-assistant-close]" : "textarea",
        );
    target?.focus({ preventScroll: true });
    return () => element.close();
  }, [mobile, modal]);
  useLayoutEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !document.querySelector("dialog:modal")
      ) {
        event.preventDefault();
        callbacks.current.close();
      }
    };
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("keydown", escape);
      // The launcher is unhidden during the same commit that removes this popup.
      requestAnimationFrame(() => callbacks.current.restoreFocus());
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      id={id}
      className="assistant-popup"
      style={frame.style}
      data-movable={!mobile || undefined}
      data-operation={frame.operation ?? undefined}
      {...frame.dialogEvents}
      aria-modal={modal ? true : undefined}
      aria-labelledby={`${id}-title ${id}-badge`}
      aria-describedby={`${id}-preview`}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        assistant.closePopup();
      }}
    >
      <header
        className="assistant-heading"
        onPointerDown={frame.headerPointerDown}
      >
        <div className="assistant-title">
          {mobile ? (
            <MessageSquare size={18} aria-hidden="true" />
          ) : (
            <TooltipButton
              data-popup-move
              type="button"
              className="icon-button assistant-move-control"
              aria-label="Move quick chat"
              aria-describedby={frame.hintId}
              tooltip="Drag to move · Arrow keys to move"
              onKeyDown={frame.moveKeys}
            >
              <Move size={18} aria-hidden="true" />
            </TooltipButton>
          )}
          <h2 id={`${id}-title`}>Assistant</h2>
          <span id={`${id}-badge`} className="assistant-preview-badge">
            Preview
          </span>
        </div>
        <div className="assistant-window-actions">
          <Link
            className="assistant-open-full"
            href="/assistant"
            aria-label="Open in Assistant"
            onNavigate={() => {
              assistant.prepare();
              assistant.closePopup();
            }}
          >
            <ArrowUpRight size={20} aria-hidden="true" />
            <span>Open in Assistant</span>
          </Link>
          <button
            data-assistant-close
            type="button"
            className="icon-button"
            aria-label="Close quick chat"
            onClick={assistant.closePopup}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      </header>
      <AssistantConversation id={id} compact />
      {!mobile && (
        <>
          <span id={frame.hintId} className="sr-only">
            Use arrow keys to move or resize. Hold Shift for larger steps.
            Escape cancels a drag.
          </span>
          <div className="assistant-frame-actions">
            <button
              type="button"
              className="assistant-add-context"
              aria-label="Reset quick chat position and size"
              onClick={() => assistant.changePopupFrame(null)}
            >
              Reset layout
            </button>
            <TooltipButton
              type="button"
              className="icon-button assistant-resize-control"
              aria-label="Resize quick chat"
              aria-describedby={frame.hintId}
              tooltip="Drag to resize · Arrow keys to resize"
              onPointerDown={(event) => frame.startResize(event, "se")}
              onKeyDown={frame.resizeKeys}
            >
              <MoveDiagonal2 size={18} aria-hidden="true" />
            </TooltipButton>
          </div>
          {(["n", "ne", "e", "se", "s", "sw", "w", "nw"] as ResizeEdge[]).map(
            (edge) => (
              <div
                key={edge}
                className="assistant-resize-edge"
                data-edge={edge}
                aria-hidden="true"
                onPointerDown={(event) => frame.startResize(event, edge)}
              />
            ),
          )}
        </>
      )}
    </dialog>
  );
}

export function AssistantWorkspace() {
  const assistant = useAssistant();
  const id = useId();
  return (
    <section className="assistant-workspace" aria-labelledby={`${id}-title`}>
      <header className="assistant-heading assistant-page-heading">
        <div className="assistant-title">
          <h1 id={`${id}-title`}>Assistant</h1>
          <span className="assistant-preview-badge">Preview</span>
        </div>
        {assistant.origin && (
          <Link className="assistant-return" href={assistant.origin.href}>
            <ArrowLeft size={17} aria-hidden="true" />
            {assistant.origin.returnLabel}
          </Link>
        )}
      </header>
      <AssistantConversation id={id} />
    </section>
  );
}

function AssistantConversation({
  id,
  compact = false,
}: {
  id: string;
  compact?: boolean;
}) {
  const assistant = useAssistant();
  const composer = useRef<HTMLTextAreaElement>(null);
  const workout = assistant.context?.page.startsWith("Fitness · Workout");
  const prompts = compact
    ? [
        {
          text: workout
            ? "Help me adapt this workout"
            : "Help with what I’m working on",
          icon: workout ? Dumbbell : MessageSquare,
        },
      ]
    : [
        { text: "Help me plan my week", icon: CalendarDays },
        { text: "Build a workout", icon: Dumbbell },
        { text: "Put together a meal", icon: Utensils },
      ];
  const canAttach = assistant.currentPage ?? assistant.origin;
  const differentPage =
    assistant.currentPage &&
    assistant.context &&
    assistant.currentPage.href !== assistant.context.href;
  return (
    <>
      <div className="assistant-body">
        <div className="assistant-empty">
          {!compact && (
            <span className="assistant-empty-icon" aria-hidden="true">
              <MessageSquare size={28} strokeWidth={1.5} />
            </span>
          )}
          <h2>
            {compact ? "How can I help?" : "What would you like to work on?"}
          </h2>
          <p>
            {compact
              ? "Ask a question without leaving what you’re doing."
              : "Plan, ask questions and work across your week."}
          </p>
          <div className="assistant-suggestions" aria-label="Example prompts">
            {prompts.map(({ text, icon: Icon }) => (
              <button
                key={text}
                type="button"
                onClick={() => {
                  assistant.changeDraft(
                    assistant.draft.trim()
                      ? `${assistant.draft}\n\n${text}`
                      : text,
                  );
                  composer.current?.focus({ preventScroll: true });
                }}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{text}</span>
                <Plus size={16} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </div>
      <footer className="assistant-footer">
        <div className="assistant-footer-inner">
          {(assistant.context || canAttach) && (
            <div
              className="assistant-context"
              role="group"
              aria-label="Conversation context"
            >
              {assistant.context ? (
                <>
                  <span className="assistant-context-label">
                    Conversation context
                  </span>
                  <div className="assistant-context-chips">
                    <span>{assistant.context.page}</span>
                    {assistant.context.date && (
                      <span>
                        <CalendarDays size={13} aria-hidden="true" />
                        {formatDate(assistant.context.date, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                  <TooltipButton
                    type="button"
                    className="icon-button"
                    tooltip="Remove context"
                    aria-label="Remove context"
                    onClick={assistant.removeContext}
                  >
                    <X size={15} aria-hidden="true" />
                  </TooltipButton>
                  {differentPage && (
                    <button
                      className="assistant-add-context assistant-replace-context"
                      type="button"
                      onClick={assistant.attachPage}
                    >
                      Use current page
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  className="assistant-add-context"
                  onClick={assistant.attachPage}
                >
                  <Plus size={16} aria-hidden="true" />
                  Add page context
                </button>
              )}
            </div>
          )}
          <form
            className="assistant-composer"
            onSubmit={(event) => event.preventDefault()}
          >
            <label htmlFor={`${id}-message`} className="sr-only">
              Message Assistant
            </label>
            <textarea
              id={`${id}-message`}
              ref={composer}
              rows={compact ? 2 : 3}
              value={assistant.draft}
              onChange={(event) => assistant.changeDraft(event.target.value)}
              placeholder="What would you like help with?"
              aria-describedby={`${id}-preview`}
            />
            <div className="assistant-composer-actions">
              <span>Draft kept while you browse.</span>
              <button
                className="assistant-send"
                type="submit"
                disabled
                aria-label="Send message"
                aria-describedby={`${id}-preview`}
              >
                <ArrowUp size={19} aria-hidden="true" />
              </button>
            </div>
          </form>
          <p id={`${id}-preview`} className="assistant-preview-note">
            Interface preview. AI isn’t connected and messages can’t be sent.
          </p>
        </div>
      </footer>
    </>
  );
}
