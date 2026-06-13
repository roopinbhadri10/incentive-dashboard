// Tiny dot/bracket path get/set helpers for binding schema fields to a config
// value object. Supports "cap.pct", "perLine.maxLines", "slabs", "slabs.0.pct".
// `set` is immutable — it clones along the path and returns a new object.

export type AnyObj = Record<string, unknown>;

function parse(path: string): (string | number)[] {
  return path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter((p) => p !== "")
    .map((p) => (/^\d+$/.test(p) ? Number(p) : p));
}

export function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const key of parse(path)) {
    if (cur == null) return undefined;
    cur = (cur as AnyObj)[key as string];
  }
  return cur;
}

export function setPath<T>(obj: T, path: string, value: unknown): T {
  const keys = parse(path);
  if (keys.length === 0) return obj;

  const clone = (node: unknown, isArr: boolean): AnyObj | unknown[] => {
    if (Array.isArray(node)) return [...node];
    if (node && typeof node === "object") return { ...(node as AnyObj) };
    return isArr ? [] : {};
  };

  const root = clone(obj, typeof keys[0] === "number") as AnyObj;
  let cur: AnyObj | unknown[] = root;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const nextIsArr = typeof keys[i + 1] === "number";
    const child = clone((cur as AnyObj)[key as string], nextIsArr);
    (cur as AnyObj)[key as string] = child;
    cur = child as AnyObj | unknown[];
  }
  (cur as AnyObj)[keys[keys.length - 1] as string] = value;
  return root as T;
}
