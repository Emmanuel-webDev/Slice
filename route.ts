import { NextResponse } from "next/server";
import { getMarketSnapshot, applyDemoSpreadShock } from "@/lib/binance/market";
import { simulateFill } from "@/lib/binance/agentos";
import { analyzeSlice } from "@/lib/execution/constraints";
import { getPlan, log, savePlan } from "@/lib/execution/store";
import type { ExecutionPlan } from "@/lib/types/execution";

export const dynamic = "force-dynamic";

type Action = "APPROVE" | "STEP" | "PAUSE" | "RESUME" | "ABORT" | "DEMO_SHOCK";

/** Strips the heavy order book before sending the plan to the browser. */
function toClient(plan: ExecutionPlan) {
  return {
    ...plan,
    market: { ...plan.market, bids: plan.market.bids.slice(0, 10), asks: plan.market.asks.slice(0, 10) },
  };
}

export async function POST(request: Request) {
  const body = (await request.json()) as { planId?: string; action?: Action };
  const plan = body.planId ? getPlan(body.planId) : undefined;
  if (!plan) return NextResponse.json({ error: "Plan not found." }, { status: 404 });

  const action = body.action ?? "STEP";
  const now = Date.now();

  if (action === "APPROVE") {
    if (plan.status !== "PLANNED") {
      return NextResponse.json({ error: "This plan was already actioned." }, { status: 409 });
    }
    plan.status = "RUNNING";
    plan.startedAt = now;
    plan.deadline = now + plan.intent.executionWindowMinutes * 60_000;
    log(plan, "decision", "User approved execution");
    return NextResponse.json({ plan: toClient(savePlan(plan)) });
  }

  if (action === "PAUSE") {
    plan.status = "PAUSED";
    log(plan, "warn", "Execution paused by user");
    return NextResponse.json({ plan: toClient(savePlan(plan)) });
  }

  if (action === "RESUME") {
    plan.status = "RUNNING";
    log(plan, "info", "Execution resumed by user");
    return NextResponse.json({ plan: toClient(savePlan(plan)) });
  }

  if (action === "ABORT") {
    plan.status = "ABORTED";
    plan.slices.forEach((s) => {
      if (s.status !== "FILLED") s.status = "CANCELLED";
    });
    log(plan, "error", "Execution aborted by user");
    return NextResponse.json({ plan: toClient(savePlan(plan)) });
  }

  if (action === "DEMO_SHOCK") {
    plan.demoShockUntil = now + 25_000;
    log(plan, "warn", "Demo control: simulated spread widening applied to the live book");
    return NextResponse.json({ plan: toClient(savePlan(plan)) });
  }

  // ---- STEP: the adaptive loop, one slice per call ----

  if (plan.status !== "RUNNING" && plan.status !== "PAUSED") {
    return NextResponse.json({ plan: toClient(plan) });
  }

  const next = plan.slices.find((s) => s.status !== "FILLED" && s.status !== "CANCELLED");
  if (!next) {
    plan.status = "COMPLETED";
    log(plan, "fill", "All slices filled — execution complete");
    return NextResponse.json({ plan: toClient(savePlan(plan)) });
  }

  // 1. Always re-observe the market. Never execute on the original snapshot.
  let market = await getMarketSnapshot(plan.intent.symbol);
  if (plan.demoShockUntil && now < plan.demoShockUntil) {
    market = applyDemoSpreadShock(market);
  }
  plan.market = market;
  next.status = "CHECKING";
  log(
    plan,
    "info",
    `Market rechecked — spread ${market.spreadPercent.toFixed(3)}%${market.synthetic ? " (demo shock active)" : ""}`
  );

  // 2. Re-evaluate constraints against fresh data.
  const analysis = analyzeSlice({ plan, slice: next, market, now });
  plan.lastDecision = analysis.recommendedAction;

  if (analysis.shouldAbort) {
    plan.status = "ABORTED";
    next.status = "CANCELLED";
    analysis.violations.forEach((v) => log(plan, "error", v));
    log(plan, "error", "Execution aborted");
    return NextResponse.json({ plan: toClient(savePlan(plan)) });
  }

  if (analysis.shouldPause) {
    plan.status = "PAUSED";
    next.status = "PAUSED";
    next.note = analysis.violations[0];
    analysis.violations.forEach((v) => log(plan, "warn", v));
    log(plan, "warn", `Slice ${next.number} held — Slice will re-check shortly`);
    return NextResponse.json({ plan: toClient(savePlan(plan)) });
  }

  // 3. Conditions are inside the user's constraints. Execute.
  if (plan.status === "PAUSED") {
    log(plan, "info", `Conditions recovered — spread ${market.spreadPercent.toFixed(3)}%`);
    plan.status = "RUNNING";
  }

  next.status = "EXECUTING";
  next.estimatedSlippagePercent = analysis.estimate.slippagePercent;
  next.expectedPrice = analysis.estimate.averagePrice;
  log(
    plan,
    "info",
    `Slice ${next.number} submitted — ${next.amount} ${plan.intent.amountType === "QUOTE" ? "quote" : "base"} @ est. ${analysis.estimate.averagePrice.toFixed(4)}`
  );

  if (plan.mode === "LIVE") {
    // Live orders are placed by the operator's MCP client against the
    // Binance MCP Server, with the user confirming each one. This branch is
    // only reachable when SLICE_TRADING_ENABLED is set by that operator.
    next.status = "PAUSED";
    next.note = "Awaiting confirmation in the connected MCP client";
    log(plan, "warn", `Slice ${next.number} handed to the MCP client for confirmation`);
    return NextResponse.json({ plan: toClient(savePlan(plan)) });
  }

  const fill = simulateFill(plan.intent, next, analysis.estimate.averagePrice);
  next.status = "FILLED";
  next.averageFillPrice = fill.averageFillPrice;
  next.filledBase = fill.filledBase;
  next.filledQuote = fill.filledQuote;
  next.executedAt = Date.now();
  log(
    plan,
    "fill",
    `Slice ${next.number} filled (simulated) at ${fill.averageFillPrice.toFixed(4)} — ${analysis.estimate.slippagePercent.toFixed(3)}% slippage`
  );

  if (plan.slices.every((s) => s.status === "FILLED" || s.status === "CANCELLED")) {
    plan.status = "COMPLETED";
    log(plan, "fill", "Execution complete");
  }

  return NextResponse.json({ plan: toClient(savePlan(plan)) });
}
