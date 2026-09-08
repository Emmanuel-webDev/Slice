const QUOTE_ASSETS = ["USDT", "FDUSD", "BUSD", "USDC", "BTC", "ETH", "BNB"];

/** Best-effort split of a spot symbol like BNBUSDT into { base: "BNB", quote: "USDT" }. */
export function splitSymbol(symbol: string): { base: string; quote: string } {
  const upper = symbol.toUpperCase();
  for (const q of QUOTE_ASSETS) {
    if (upper.length > q.length && upper.endsWith(q)) {
      return { base: upper.slice(0, -q.length), quote: q };
    }
  }
  return { base: upper, quote: "" };
}
