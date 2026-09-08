import { simulateMarketOrder } from "@/lib/execution/slippage";
import { THRESHOLDS } from "@/lib/execution/liquidity";
import type {
  ConstraintResult,
  ExecutionPlan,
  ExecutionSlice,
  FillEstimate,
  MarketSnapshot,
} from "@/lib/types/execution";

export interface SliceAnalysis extends ConstraintResult {
  estimate: FillEstimate;
  shouldAbort: boolean;
  shouldPause: boolean;
}

/**
 * Runs immediately before each slice against a freshly fetched book.
 * The plan never executes on stale analysis.
 */
export function analyzeSlice(args: {
  plan: ExecutionPlan;
  slice: ExecutionSlice;
  market: MarketSnapshot;
  now?: number;
}): SliceAnalysis {
  const { plan, slice, market } = args;
  const now = args.now ?? Date.now();
  const { intent } = plan;

  const violations: string[] = [];
  let action: ConstraintResult["recommendedAction"] = "CONTINUE";

  const estimate = simulateMarketOrder(market, intent.side, slice.amount, intent.amountType);

  // 1. Deadline
  if (plan.deadline && now >= plan.deadline) {
    violations.push("The execution window has expired with the order unfinished.");
    action = "ABORT";
  }

  // 2. Spread ceiling
  const spreadCeiling = intent.maxSlippagePercent * THRESHOLDS.maxSpreadMultiple;
  if (market.spreadPercent > spreadCeiling) {
    violations.push(
      `Spread is ${market.spreadPercent.toFixed(3)}%, above the ${spreadCeiling.toFixed(2)}% execution threshold.`
    );
    if (action !== "ABORT") action = "PAUSE";
  }

  // 3. Depth
  if (!estimate.filled) {
    violations.push("The visible book cannot fill this slice.");
    if (action !== "ABORT") action = "REPLAN";
  }

  // 4. Slippage on this specific slice
  if (estimate.filled && estimate.slippagePercent > intent.maxSlippagePercent) {
    violations.push(
      `This slice would cost ${estimate.slippagePercent.toFixed(3)}% slippage, above your ${intent.maxSlippagePercent}% limit.`
    );
    if (action !== "ABORT") action = "PAUSE";
  }

  return {
    valid: violations.length === 0,
    violations,
    recommendedAction: action,
    estimate,
    shouldAbort: action === "ABORT",
    shouldPause: action === "PAUSE" || action === "REPLAN",
  };
}

export function remainingAmount(plan: ExecutionPlan): number {
  return plan.slices
    .filter((s) => s.status !== "FILLED" && s.status !== "CANCELLED")
    .reduce((sum, s) => sum + s.amount, 0);
}

export function executedAmount(plan: ExecutionPlan): number {
  return plan.slices.filter((s) => s.status === "FILLED").reduce((sum, s) => sum + s.amount, 0);
}
