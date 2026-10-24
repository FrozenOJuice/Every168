"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import {
  useAssistantPageContext,
  type AssistantPageContext,
} from "./assistant-page-context";
import type { PopupFrame } from "./assistant-popup-frame";

type PreviewState = {
  draft: string;
  initialized: boolean;
  context: AssistantPageContext | null;
  origin: AssistantPageContext | null;
  popupOpen: boolean;
  popupFrame: PopupFrame | null;
};
type AssistantState = PreviewState & {
  currentPage: AssistantPageContext | null;
  prepare: () => void;
  openPopup: () => void;
  closePopup: () => void;
  changeDraft: (text: string) => void;
  removeContext: () => void;
  attachPage: () => void;
  changePopupFrame: (frame: PopupFrame | null) => void;
};
const Context = createContext<AssistantState | null>(null);

/** Account-scoped, in-memory preview only. No persisted chats or AI operations. */
export function AssistantProvider({ children }: { children: ReactNode }) {
  const currentPage = useAssistantPageContext();
  const [state, setState] = useState<PreviewState>({
    draft: "",
    initialized: false,
    context: null,
    origin: null,
    popupOpen: false,
    popupFrame: null,
  });
  const initialize = (value: PreviewState) =>
    value.initialized || !currentPage
      ? value
      : {
          ...value,
          initialized: true,
          context: currentPage,
          origin: currentPage,
        };
  return (
    <Context.Provider
      value={{
        ...state,
        changePopupFrame: (popupFrame) =>
          setState((value) => ({ ...value, popupFrame })),
        currentPage,
        prepare: () => setState(initialize),
        openPopup: () =>
          setState((value) => ({ ...initialize(value), popupOpen: true })),
        closePopup: () => setState((value) => ({ ...value, popupOpen: false })),
        changeDraft: (draft) =>
          setState((value) => ({ ...value, initialized: true, draft })),
        removeContext: () =>
          setState((value) => ({ ...value, initialized: true, context: null })),
        attachPage: () =>
          setState((value) => {
            const page = currentPage ?? value.origin;
            return page
              ? { ...value, initialized: true, context: page, origin: page }
              : value;
          }),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAssistant() {
  const value = useContext(Context);
  if (!value)
    throw new Error("Assistant requires the authenticated workspace.");
  return value;
}
