"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ConfirmationDialog } from "./confirmation-dialog";
import { Dialog } from "./dialog";

type Options = {
  title: string;
  description?: string;
  action?: string;
  cancel?: string;
  danger?: boolean;
};
type Confirm = (message: string | Options) => Promise<boolean>;
type TextPrompt = (
  title: string,
  initialValue: string,
) => Promise<string | null>;
type Request =
  | { kind: "confirm"; options: Options; resolve: (value: boolean) => void }
  | {
      kind: "text";
      title: string;
      initial: string;
      resolve: (value: string | null) => void;
    };
const Context = createContext<{ confirm: Confirm; text: TextPrompt } | null>(
  null,
);

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);
  const current = useRef<Request | null>(null);
  const confirm = useCallback<Confirm>((message) => {
    if (current.current) return Promise.resolve(false);
    const question = typeof message === "string" ? message.indexOf("?") : -1;
    const options =
      typeof message === "string"
        ? {
            title: question >= 0 ? message.slice(0, question + 1) : message,
            description:
              question >= 0
                ? message.slice(question + 1).trim() || undefined
                : undefined,
          }
        : message;
    return new Promise<boolean>((resolve) => {
      const next: Request = { kind: "confirm", options, resolve };
      current.current = next;
      setRequest(next);
    });
  }, []);
  const text = useCallback<TextPrompt>((title, initial) => {
    if (current.current) return Promise.resolve(null);
    return new Promise<string | null>((resolve) => {
      const next: Request = { kind: "text", title, initial, resolve };
      current.current = next;
      setRequest(next);
    });
  }, []);
  const finish = (accepted: boolean, value?: string) => {
    const pending = current.current;
    current.current = null;
    setRequest(null);
    if (pending?.kind === "confirm") pending.resolve(accepted);
    else if (pending) pending.resolve(accepted ? (value ?? null) : null);
  };
  useEffect(
    () => () => {
      const pending = current.current;
      if (pending?.kind === "confirm") pending.resolve(false);
      else pending?.resolve(null);
    },
    [],
  );
  const options = request?.kind === "confirm" ? request.options : null;
  const verb = options?.title.match(
    /^(Delete|Remove|Archive|Skip|Discard)\b/,
  )?.[1];
  return (
    <Context value={{ confirm, text }}>
      {children}
      {request?.kind === "confirm" && options && (
        <ConfirmationDialog
          title={options.title}
          description={options.description}
          action={options.action ?? verb ?? "Continue"}
          cancel={
            options.cancel ?? (verb === "Discard" ? "Keep editing" : "Cancel")
          }
          danger={
            options.danger ?? /^(Delete|Remove|Discard)\b/.test(options.title)
          }
          onCancel={() => finish(false)}
          onConfirm={() => finish(true)}
        />
      )}
      {request?.kind === "text" && (
        <TextDialog
          title={request.title}
          initial={request.initial}
          onCancel={() => finish(false)}
          onSave={(value) => finish(true, value)}
        />
      )}
    </Context>
  );
}
function TextDialog({
  title,
  initial,
  onCancel,
  onSave,
}: {
  title: string;
  initial: string;
  onCancel: () => void;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <Dialog title={title} className="confirmation-dialog" onClose={onCancel}>
      <form
        noValidate
        className="form-stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (value.trim()) onSave(value.trim());
        }}
      >
        <label className="field">
          Template name
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            required
            maxLength={160}
          />
        </label>
        <div className="fitness-confirm-actions">
          <button type="button" className="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={!value.trim()}
          >
            Rename
          </button>
        </div>
      </form>
    </Dialog>
  );
}
export function useConfirm() {
  const context = useContext(Context);
  if (!context) throw new Error("ConfirmationProvider required");
  return context.confirm;
}
export function useTextPrompt() {
  const context = useContext(Context);
  if (!context) throw new Error("ConfirmationProvider required");
  return context.text;
}
