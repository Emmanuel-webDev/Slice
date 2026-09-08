import { simulateMarketOrder } from "./slippage";
import { classifyLiquidity, THRESHOLDS, depthCoverage } from "./liquidity";
import { buildSlices } from "./slicing";
import type {
  ExecutionIntent,
  ExecutionPlan,
  ExecutionMode,
  MarketSnapshot,
  Strategy,
} from "../types/execution";

function quoteValue(intent: ExecutionIntent, market: MarketSnapshot): number {
  return intent.amountType === "QUOTE" ? intent.amount : intent.amount * market.midPrice;
}

/**
 * Chooses the smallest slice count whose per-slice estimate sits safely
 * under the user's limit. Splits `amountToSplit` — the plannable amount,
 * not necessarily the full requested amount — so a count is never accepted
 * on the strength of a per-slice size the book cannot actually absorb.
 * Returns null when no supported count works.
 */
function findSliceCount(
  amountToSplit: number,
  intent: ExecutionIntent,
  market: MarketSnapshot
): { count: number; slippagePercent: number } | null {
  const ceiling = intent.maxSlippagePercent * THRESHOLDS.sliceSafetyFactor;

  for (let count = THRESHOLDS.minSlices; count <= THRESHOLDS.maxSlices; count++) {
    const per = amountToSplit / count;
    const perQuote =
      intent.amountType === "QUOTE" ? per : per * market.midPrice;
    if (perQuote < THRESHOLDS.minSliceQuote) break;

    const est = simulateMarketOrder(market, intent.side, per, intent.amountType);
    if (est.filled && est.slippagePercent <= ceiling) {
      return { count, slippagePercent: est.slippagePercent };
    }
  }
  return null;
}

export function createPlan(args: {
  intent: ExecutionIntent;
  market: MarketSnapshot;
  mode: ExecutionMode;
}): ExecutionPlan {
  const { intent, market, mode } = args;
  const now = Date.now();

  const fullOrderEstimate = simulateMarketOrder(
    market,
    intent.side,
    intent.amount,
    intent.amountType
  );

  // The book may not hold enough depth to fill the full request right now.
  // Everything downstream — slice count, slice sizes, reasoning — plans
  // against what is actually there, not against the number the user typed.
  const plannableAmount = fullOrderEstimate.filled
    ? intent.amount
    : Math.max(0, intent.amount - fullOrderEstimate.unfilled);
  const unfillableAmount = intent.amount - plannableAmount;

  const requestedQuote = quoteValue(intent, market);
  const liquidity = classifyLiquidity({
    market,
    estimate: fullOrderEstimate,
    maxSlippagePercent: intent.maxSlippagePercent,
    requestedQuote,
    side: intent.side,
  });
  const depthCoverRequested = depthCoverage(market, intent.side, requestedQuote);

  const spreadCeiling = intent.maxSlippagePercent * THRESHOLDS.maxSpreadMultiple;
  const reasoning: string[] = [];
  let strategy: Strategy;
  let estimatedSlippagePercent = fullOrderEstimate.slippagePercent;
  let sliceCount = 1;

  const addShortfallReasoning = () => {
    reasoning.push(
      `The visible book covers ${Math.round(plannableAmount).toLocaleString("en-US")} of your ${Math.round(
        intent.amount
      ).toLocaleString("en-US")} request. Slice will plan against what is available and re-check as depth replenishes.`
    );
    reasoning.push(`Visible depth covers ${depthCoverRequested.toFixed(2)}x the requested size.`);
  };

  if (market.spreadPercent > spreadCeiling) {
    strategy = "WAIT";
    reasoning.push(
      `The spread is ${market.spreadPercent.toFixed(3)}%, above the ${spreadCeiling.toFixed(
        2
      )}% ceiling implied by your ${intent.maxSlippagePercent}% limit.`
    );
    reasoning.push("Slice will re-check the book rather than pay the current spread.");
  } else if (fullOrderEstimate.filled && fullOrderEstimate.slippagePercent <= intent.maxSlippagePercent) {
    strategy = "IMMEDIATE";
    reasoning.push(
      `Executing the full order now costs about ${fullOrderEstimate.slippagePercent.toFixed(
        3
      )}% slippage, inside your ${intent.maxSlippagePercent}% limit.`
    );
    reasoning.push(`Visible depth covers ${depthCoverRequested.toFixed(1)}x the requested size.`);
  } else {
    const split = findSliceCount(plannableAmount, intent, market);
    if (split) {
      strategy = "SPLIT";
      sliceCount = split.count;
      estimatedSlippagePercent = split.slippagePercent;
      reasoning.push(
        fullOrderEstimate.filled
          ? `Executing everything at once would cost about ${fullOrderEstimate.slippagePercent.toFixed(
              3
            )}% slippage, over your ${intent.maxSlippagePercent}% limit.`
          : "The visible book cannot absorb the full order at once."
      );
      if (unfillableAmount > 0) {
        addShortfallReasoning();
      }
      reasoning.push(
        `Splitting into ${split.count} orders brings the estimate to ${split.slippagePercent.toFixed(
          3
        )}% per slice.`
      );
      reasoning.push(
        `Your ${intent.executionWindowMinutes}-minute window leaves room to re-check the market between slices.`
      );
    } else {
      strategy = "WAIT";
      reasoning.push(
        "Even the smallest supported slice would breach your slippage limit at current depth."
      );
      if (unfillableAmount > 0) {
        addShortfallReasoning();
      }
      reasoning.push("Slice will hold and re-check rather than execute outside your constraints.");
    }
  }

  const reference = intent.side === "BUY" ? market.bestAsk : market.bestBid;
  const slices =
    strategy === "IMMEDIATE"
      ? buildSlices(intent.amount, 1, liquidity, reference)
      : strategy === "SPLIT"
        ? buildSlices(plannableAmount, sliceCount, liquidity, reference)
        : buildSlices(plannableAmount, Math.max(2, sliceCount), liquidity, reference);

  return {
    id: `plan_${now.toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    intent,
    market,
    strategy,
    estimatedSlippagePercent,
    fullOrderEstimate,
    liquidity,
    plannableAmount,
    unfillableAmount,
    slices,
    reasoning,
    status: "PLANNED",
    mode,
    createdAt: now,
    activity: [],
  };
}
