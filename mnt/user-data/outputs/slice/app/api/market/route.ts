import { NextResponse } from "next/server";
import { getMarketSnapshot } from "@/lib/binance/market";
import { detectCapabilities } from "@/lib/binance/agentos";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const symbol = new URL(request.url).searchParams.get("symbol") ?? "BNBUSDT";
  try {
    const market = await getMarketSnapshot(symbol);
    const capabilities = detectCapabilities();
    // Trim the payload sent to the browser; the engine runs server-side.
    return NextResponse.json({
      market: { ...market, bids: market.bids.slice(0, 12), asks: market.asks.slice(0, 12) },
      capabilities,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Market data unavailable" },
      { status: 502 }
    );
  }
}
