import * as React from "react";

import { Input } from "@/components/ui/input";

type BaseProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "type"
>;

export interface NumberInputProps extends BaseProps {
  /** Current numeric value (or null/undefined for an empty field). */
  value: number | null | undefined;
  /** Called with the committed number whenever the value changes. */
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
}

/**
 * A controlled numeric input that keeps an internal text draft so the field can
 * be cleared and retyped. A plain `<input type="number" value={n}>` snaps an
 * empty string back to its number on every keystroke, which shows up as a stuck
 * "0" the user can't delete — this decouples what's on screen from the committed
 * number to avoid that.
 *
 * Behaviour:
 *  • Empty / intermediate text ("", "-", ".") stays visible without committing.
 *  • `max` rejects an over-limit keystroke (the prior text is kept).
 *  • `min`/`max` clamp on blur; an empty field commits `min ?? 0` on blur.
 *  • Wheel-scroll never mutates the value (handled by the base Input).
 */
export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onValueChange, onFocus, onBlur, min, max, ...props }, ref) => {
    const toText = (v: number | null | undefined) =>
      v == null || Number.isNaN(v) ? "" : String(v);

    const [draft, setDraft] = React.useState<string>(() => toText(value));
    const editing = React.useRef(false);

    // Reflect external value changes (resets, programmatic updates, clone-fill)
    // into the field — but not while the user is mid-edit, so their typing wins.
    React.useEffect(() => {
      if (!editing.current) setDraft(toText(value));
    }, [value]);

    return (
      <Input
        {...props}
        ref={ref}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        value={draft}
        onFocus={(e) => {
          editing.current = true;
          onFocus?.(e);
        }}
        onChange={(e) => {
          const raw = e.target.value;
          // Let the field sit empty / partial so a "0" can be cleared and retyped.
          if (raw === "" || raw === "-" || raw === ".") {
            setDraft(raw);
            return;
          }
          const n = Number(raw);
          if (Number.isNaN(n)) return;
          // Reject keystrokes that would exceed max rather than snapping down.
          if (max != null && n > max) return;
          setDraft(raw);
          onValueChange(n);
        }}
        onBlur={(e) => {
          editing.current = false;
          let n = Number(draft);
          if (draft === "" || Number.isNaN(n)) n = min ?? 0;
          if (min != null && n < min) n = min;
          if (max != null && n > max) n = max;
          setDraft(String(n));
          onValueChange(n);
          onBlur?.(e);
        }}
      />
    );
  },
);
NumberInput.displayName = "NumberInput";
