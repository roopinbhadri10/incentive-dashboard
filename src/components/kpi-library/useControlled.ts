import { useState } from "react";

/**
 * Lets a component work either uncontrolled (own state, defaults) or fully
 * controlled (value/onChange). Returns a setter that accepts either a value
 * or a functional updater, so existing `setCfg((c) => ...)` call-sites keep
 * working with zero edits.
 */
export function useControlled<T>(
  value: T | undefined,
  onChange: ((v: T) => void) | undefined,
  defaults: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [internal, setInternal] = useState<T>(value ?? defaults);
  const cfg = value ?? internal;
  const set = (next: T | ((prev: T) => T)) => {
    const resolved =
      typeof next === "function" ? (next as (p: T) => T)(cfg) : next;
    if (onChange) onChange(resolved);
    else setInternal(resolved);
  };
  return [cfg, set];
}
