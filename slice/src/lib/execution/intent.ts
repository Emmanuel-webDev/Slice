import type { AmountType, ExecutionIntent, TradeSide } from "../types/execution";

export interface IntentInput {
  side: TradeSide;
  symbol: string;
  amount: number;
  amountType: AmountType;
  executionWindowMinutes: number;
  maxSlippagePercent: number;
}

/** Shared validation used by both the browser setup form and the local sync server. */
export function parseIntent(input: IntentInput): ExecutionIntent {
  const symbol = input.symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  if (!symbol) throw new Error("Choose a trading pair.");
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Enter an amount above zero.");
  if (!Number.isFinite(input.executionWindowMinutes) || input.executionWindowMinutes <= 0)
    throw new Error("Enter an execution window in minutes.");
  if (!Number.isFinite(input.maxSlippagePercent) || input.maxSlippagePercent <= 0)
    throw new Error("Enter a maximum slippage above zero.");
  return {
    symbol,
    side: input.side,
    amount: input.amount,
    amountType: input.amountType,
    executionWindowMinutes: input.executionWindowMinutes,
    maxSlippagePercent: input.maxSlippagePercent,
  };
}
