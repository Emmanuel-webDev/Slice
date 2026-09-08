import type { ActivityKind, ExecutionPlan } from "@/lib/types/execution";

/**
 * Deliberately in-memory. No persistent database in the hackathon scope.
 * globalThis keeps plans alive across Next.js dev hot reloads.
 */
const g = globalThis as unknown as { __slicePlans?: Map<string, ExecutionPlan> };
const plans = (g.__slicePlans ??= new Map<string, ExecutionPlan>());

export function savePlan(plan: ExecutionPlan): ExecutionPlan {
  plans.set(plan.id, plan);
  return plan;
}

export function getPlan(id: string): ExecutionPlan | undefined {
  return plans.get(id);
}

export function log(plan: ExecutionPlan, kind: ActivityKind, message: string): void {
  plan.activity.push({ t: Date.now(), kind, message });
  if (plan.activity.length > 200) plan.activity.splice(0, plan.activity.length - 200);
}
