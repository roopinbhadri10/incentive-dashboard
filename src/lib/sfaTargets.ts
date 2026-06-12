// Mock SFA (Sales Force Automation) target availability check.
// In a real integration this would call the SFA backend.
// For the demo, we deterministically mark some target streams as already present.
const PRESENT = new Set<string>([
  "nsv-primary",
  "nsv-secondary",
  "phasing-secondary",
]);

export function targetsPresentInSfa(key: string): boolean {
  return PRESENT.has(key);
}
