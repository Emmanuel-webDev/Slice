import { NextResponse } from "next/server";
import { getMarketSnapshot } from "@/lib/binance/market";
import { detectCapabilities } from "@/lib/binance/agentos";
import { createPlan } from "@/lib/execution/strategy";
import { log, savePlan } from "@/lib/execution/store";
import type { ExecutionIntent } from "@/lib/types/execution";

export const dynamic = "force-dynamic";

function parseIntent(body: Record<string, unknown>): ExecutionIntent {
  const symbol = String(body.symbol ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const side = body.side === "SELL" ? "SELL" : "BUY";
  const amount = Number(body.amount);
  const amountType = body.amountType === "BASE" ? "BASE" : "QUOTE";
  const executionWindowMinutes = Number(body.executionWindowMinutes);
  const maxSlippagePercent = Number(body.maxSlippagePercent);

  if (!symbol) throw new Error("Choose a trading pair.");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter an amount above zero.");
  if (!Number.isFinite(executionWindowMinutes) || executionWindowMinutes <= 0)
    throw new Error("Enter an execution window in minutes.");
  if (!Number.isFinite(maxSlippagePercent) || maxSlippagePercent <= 0)
    throw new Error("Enter a maximum slippage above zero.");

  return { symbol, side, amount, amountType, executionWindowMinutes, maxSlippagePercent };
}

export async function POST(request: Request) {
  try {
    const intent = parseIntent(await request.json());
    const market = await getMarketSnapshot(intent.symbol);
    const capabilities = detectCapabilities();

    const plan = createPlan({
      intent,
      market,
      mode: capabilities.trading ? "LIVE" : "DEMO",
    });

    log(plan, "info", `Market data retrieved from ${market.source}`);
    log(plan, "info", `Spread calculated: ${market.spreadPercent.toFixed(3)}%`);
    log(
      plan,
      "info",
      `Full-order slippage estimated: ${plan.fullOrderEstimate.slippagePercent.toFixed(3)}%`
    );
    log(plan, "decision", `Strategy selected: ${plan.strategy}`);
    if (plan.strategy === "SPLIT" || plan.strategy === "WAIT") {
      log(plan, "info", `Created ${plan.slices.length} execution slices`);
    }
    log(
      plan,
      plan.mode === "LIVE" ? "info" : "warn",
      plan.mode === "LIVE"
        ? "Agent OS trading authorized — live execution available"
        : "Agent OS market data only — execution will be simulated"
    );

    savePlan(plan);
    return NextResponse.json({ plan, capabilities });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 400 }
    );
  }
}
