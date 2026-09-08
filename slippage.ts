import type {
  AmountType,
  FillEstimate,
  MarketSnapshot,
  TradeSide,
} from "@/lib/types/execution";

/**
 * Walks the real order book and reports what an immediate market order
 * would actually cost. Pure arithmetic — no model, no LLM.
 *
 * BUY  consumes asks from the lowest price upward.
 * SELL consumes bids from the highest price downward.
 */
export function simulateMarketOrder(
  market: MarketSnapshot,
  side: TradeSide,
  amount: number,
  amountType: AmountType
): FillEstimate {
  const levels = side === "BUY" ? market.asks : market.bids;
  const reference = side === "BUY" ? market.bestAsk : market.bestBid;

  let remaining = amount;
  let totalBase = 0;
  let totalQuote = 0;
  let worstPrice = reference;
  let levelsConsumed = 0;

  for (const level of levels) {
    if (remaining <= 1e-12) break;

    const levelBase = level.quantity;
    const levelQuote = level.price * level.quantity;

    let takeBase: number;
    if (amountType === "BASE") {
      takeBase = Math.min(remaining, levelBase);
      remaining -= takeBase;
    } else {
      const takeQuote = Math.min(remaining, levelQuote);
      takeBase = takeQuote / level.price;
      remaining -= takeQuote;
    }

    totalBase += takeBase;
    totalQuote += takeBase * level.price;
    worstPrice = level.price;
    levelsConsumed += 1;
  }

  const filled = remaining <= 1e-9;
  const averagePrice = totalBase > 0 ? totalQuote / totalBase : reference;

  const rawSlippage =
    side === "BUY"
      ? ((averagePrice - reference) / reference) * 100
      : ((reference - averagePrice) / reference) * 100;

  return {
    filled,
    totalQuote,
    totalBase,
    averagePrice,
    worstPrice,
    slippagePercent: Math.max(0, rawSlippage),
    unfilled: filled ? 0 : remaining,
    levelsConsumed,
  };
}

/** Spread helpers kept here so every caller uses one definition. */
export function spreadPercent(bestBid: number, bestAsk: number): number {
  const mid = (bestBid + bestAsk) / 2;
  return ((bestAsk - bestBid) / mid) * 100;
}
