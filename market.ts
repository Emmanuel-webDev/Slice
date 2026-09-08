import type { MarketSnapshot, OrderBookLevel } from "@/lib/types/execution";

/**
 * Public market data hosts, tried in order.
 * data-api.binance.vision is the unauthenticated public mirror and is the
 * safest default when api.binance.com is geo-restricted on the demo machine.
 */
const HOSTS = [
  process.env.BINANCE_REST_HOST,
  "https://data-api.binance.vision",
  "https://api.binance.com",
].filter(Boolean) as string[];

const DEPTH_LIMIT = 100;

type RawDepth = {
  lastUpdateId: number;
  bids: [string, string][];
  asks: [string, string][];
};

function toLevels(raw: [string, string][]): OrderBookLevel[] {
  return raw
    .map(([p, q]) => ({ price: Number(p), quantity: Number(q) }))
    .filter((l) => Number.isFinite(l.price) && Number.isFinite(l.quantity) && l.quantity > 0);
}

async function fetchDepth(symbol: string): Promise<{ depth: RawDepth; host: string }> {
  let lastError: unknown = null;
  for (const host of HOSTS) {
    try {
      const url = `${host}/api/v3/depth?symbol=${encodeURIComponent(symbol)}&limit=${DEPTH_LIMIT}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        lastError = new Error(`${host} responded ${res.status}`);
        continue;
      }
      const depth = (await res.json()) as RawDepth;
      if (!depth?.bids?.length || !depth?.asks?.length) {
        lastError = new Error(`${host} returned an empty book for ${symbol}`);
        continue;
      }
      return { depth, host };
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    `Could not load the ${symbol} order book. ${
      lastError instanceof Error ? lastError.message : "All market data hosts failed."
    }`
  );
}

export async function getMarketSnapshot(symbol: string): Promise<MarketSnapshot> {
  const normalized = symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const { depth, host } = await fetchDepth(normalized);

  const bids = toLevels(depth.bids).sort((a, b) => b.price - a.price);
  const asks = toLevels(depth.asks).sort((a, b) => a.price - b.price);

  const bestBid = bids[0].price;
  const bestAsk = asks[0].price;
  const midPrice = (bestAsk + bestBid) / 2;
  const spreadAbsolute = bestAsk - bestBid;
  const spreadPercent = (spreadAbsolute / midPrice) * 100;

  return {
    symbol: normalized,
    timestamp: Date.now(),
    bestBid,
    bestAsk,
    midPrice,
    spreadAbsolute,
    spreadPercent,
    bids,
    asks,
    source: host.replace(/^https:\/\//, ""),
  };
}

/**
 * Demo-only. Widens the spread on a REAL book so the adaptive pause is
 * reproducible on stage. Always flagged as synthetic and always labelled
 * in the UI — simulated conditions are never presented as live conditions.
 */
export function applyDemoSpreadShock(snapshot: MarketSnapshot, widenPercent = 0.22): MarketSnapshot {
  const shift = (snapshot.midPrice * widenPercent) / 100 / 2;
  const asks = snapshot.asks.map((l) => ({ ...l, price: l.price + shift }));
  const bids = snapshot.bids.map((l) => ({ ...l, price: Math.max(0, l.price - shift) }));
  const bestBid = bids[0].price;
  const bestAsk = asks[0].price;
  const midPrice = (bestAsk + bestBid) / 2;
  return {
    ...snapshot,
    bids,
    asks,
    bestBid,
    bestAsk,
    midPrice,
    spreadAbsolute: bestAsk - bestBid,
    spreadPercent: ((bestAsk - bestBid) / midPrice) * 100,
    synthetic: true,
  };
}
