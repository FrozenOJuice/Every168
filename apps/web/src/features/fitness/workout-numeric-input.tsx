"use client";
import { useRef, type InputHTMLAttributes } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "onChange"
> & {
  controlLabel: string;
  steppers?: boolean;
  onValueChange: (value: string) => void;
  onStep?: (value: string) => void;
};

export function WorkoutNumericInput({
  controlLabel,
  steppers = false,
  onValueChange,
  onStep,
  ...props
}: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const input = (
    <input
      {...props}
      ref={ref}
      type="number"
      onChange={(event) => onValueChange(event.target.value)}
    />
  );
  if (!steppers) return input;
  const minimum = props.min === undefined ? -Infinity : Number(props.min);
  const maximum = props.max === undefined ? Infinity : Number(props.max);
  const value = props.value === "" ? NaN : Number(props.value);
  const step = props.step === "any" ? 1 : Number(props.step ?? 1);
  const change = (direction: number) => {
    const current = ref.current?.valueAsNumber ?? NaN;
    const next = Number.isFinite(current)
      ? current + direction * step
      : Math.max(Number.isFinite(minimum) ? minimum : 0, direction * step);
    (onStep ?? onValueChange)(
      String(Number(Math.min(maximum, Math.max(minimum, next)).toFixed(6))),
    );
  };
  return (
    <div className="fitness-number-control">
      {input}
      <div className="fitness-number-arrows">
        {([1, -1] as const).map((direction) => {
          const Icon = direction === 1 ? ChevronUp : ChevronDown;
          return (
            <button
              key={direction}
              type="button"
              tabIndex={-1}
              aria-label={`${direction === 1 ? "Increase" : "Decrease"} ${controlLabel}`}
              disabled={
                props.disabled ||
                (Number.isFinite(value) &&
                  (direction === 1 ? value >= maximum : value <= minimum))
              }
              // Keep typing focus and the normal input-to-input Tab order;
              // keyboard users can also step with the input's arrow keys.
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => change(direction)}
            >
              <Icon size={18} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
