import type { ExecutionSlice, Liquidity } from "../types/execution";

/**
 * Simple, readable slicing. Slightly front-loaded when liquidity is strong
 * (take the good book while it is there), equal otherwise.
 * 500 USDT over 3 slices -> 175 / 175 / 150.
 */
const WEIGHTS: Record<number, number[]> = {
  2: [0.55, 0.45],
  3: [0.35, 0.35, 0.3],
  4: [0.28, 0.27, 0.23, 0.22],
  5: [0.22, 0.22, 0.2, 0.18, 0.18],
};

export function sliceAmounts(total: number, count: number, liquidity: Liquidity): number[] {
  const decimals = total >= 100 ? 2 : 6;
  const round = (n: number) => Number(n.toFixed(decimals));

  const weights =
    liquidity === "HIGH" && WEIGHTS[count]
      ? WEIGHTS[count]
      : new Array(count).fill(1 / count);

  const amounts = weights.map((w) => round(total * w));
  const drift = round(total - amounts.reduce((a, b) => a + b, 0));
  amounts[amounts.length - 1] = round(amounts[amounts.length - 1] + drift);
  return amounts;
}

export function buildSlices(
  total: number,
  count: number,
  liquidity: Liquidity,
  expectedPrice: number
): ExecutionSlice[] {
  return sliceAmounts(total, count, liquidity).map((amount, i) => ({
    id: `s${i + 1}-${Math.random().toString(36).slice(2, 8)}`,
    number: i + 1,
    amount,
    status: "PENDING" as const,
    expectedPrice,
  }));
}
