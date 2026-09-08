import type { FillEstimate, Liquidity, MarketSnapshot } from "@/lib/types/execution";

/**
 * Every tunable number for the demo lives here. Adjust during testing
 * rather than scattering magic numbers through the engine.
 */
export const THRESHOLDS = {
  /** Spread above maxSlippage * this multiple means "wait, don't trade". */
  maxSpreadMultiple: 1.5,
  /** A slice is only scheduled if its estimate sits under this share of the limit. */
  sliceSafetyFactor: 0.9,
  high: { spreadPercent: 0.05, slippageShareOfLimit: 0.5, depthCover: 4 },
  medium: { spreadPercent: 0.15, slippageShareOfLimit: 1.0, depthCover: 2 },
  /** Minimum quote value per slice so we don't fall under exchange minimums. */
  minSliceQuote: 10,
  maxSlices: 5,
  minSlices: 2,
} as const;

/** How many times the requested size the visible book can absorb. */
export function depthCoverage(
  market: MarketSnapshot,
  side: "BUY" | "SELL",
  requestedQuote: number
): number {
  const levels = side === "BUY" ? market.asks : market.bids;
  const available = levels.reduce((sum, l) => sum + l.price * l.quantity, 0);
  if (requestedQuote <= 0) return Infinity;
  return available / requestedQuote;
}

export function classifyLiquidity(args: {
  market: MarketSnapshot;
  estimate: FillEstimate;
  maxSlippagePercent: number;
  requestedQuote: number;
  side: "BUY" | "SELL";
}): Liquidity {
  const { market, estimate, maxSlippagePercent, requestedQuote, side } = args;
  const cover = depthCoverage(market, side, requestedQuote);
  const slipShare = estimate.slippagePercent / Math.max(maxSlippagePercent, 1e-9);

  if (
    market.spreadPercent <= THRESHOLDS.high.spreadPercent &&
    slipShare <= THRESHOLDS.high.slippageShareOfLimit &&
    cover >= THRESHOLDS.high.depthCover &&
    estimate.filled
  ) {
    return "HIGH";
  }

  if (
    market.spreadPercent <= THRESHOLDS.medium.spreadPercent &&
    slipShare <= THRESHOLDS.medium.slippageShareOfLimit &&
    cover >= THRESHOLDS.medium.depthCover
  ) {
    return "MEDIUM";
  }

  return "LOW";
}

export function marketStatus(
  market: MarketSnapshot,
  maxSlippagePercent: number
): "FAVORABLE" | "CAUTION" | "UNFAVORABLE" {
  const ceiling = maxSlippagePercent * THRESHOLDS.maxSpreadMultiple;
  if (market.spreadPercent > ceiling) return "UNFAVORABLE";
  if (market.spreadPercent > maxSlippagePercent * 0.75) return "CAUTION";
  return "FAVORABLE";
}
