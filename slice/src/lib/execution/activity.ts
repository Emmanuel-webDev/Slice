import type { ActivityKind, ExecutionPlan } from "../types/execution";

/** Appends an activity entry in place. Plan is expected to be a fresh working copy, not shared state. */
export function log(plan: ExecutionPlan, kind: ActivityKind, message: string): void {
  plan.activity.push({ t: Date.now(), kind, message });
  if (plan.activity.length > 200) plan.activity.splice(0, plan.activity.length - 200);
}
