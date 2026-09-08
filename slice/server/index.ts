/**
 * Slice local sync server.
 *
 * A plain Node HTTP server (no framework) that hosts the exact same engine
 * modules as the browser SPA. It exists for one reason: the MCP server
 * (mcp/server.ts) runs in a separate process from the browser tab, and they
 * need one shared source of truth for plan state so the browser monitor can
 * show what the agent is doing live. This is not a return to Next.js — it's
 * the minimum plumbing needed for a second process to see the same plan.
 *
 * PROTOCOL NOTE: this process's stdout is fine to use (only the MCP server's
 * stdout is reserved for the MCP protocol). Logs here use console.log freely.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { getMarketSnapshot, applyDemoSpreadShock, snapshotFromDepth } from "../src/lib/binance/market.ts";
import { detectCapabilities, simulateFill } from "../src/lib/binance/agentos.ts";
import { createPlan } from "../src/lib/execution/strategy.ts";
import { analyzeSlice } from "../src/lib/execution/constraints.ts";
import { log } from "../src/lib/execution/activity.ts";
import { parseIntent } from "../src/lib/execution/intent.ts";
import type { ExecutionPlan } from "../src/lib/types/execution.ts";

// Render (and most PaaS) inject PORT and expect the app to bind to it.
const PORT = Number(process.env.PORT ?? process.env.SLICE_SERVER_PORT ?? 8791);

const plans = new Map<string, ExecutionPlan>();
const savePlan = (p: ExecutionPlan) => (plans.set(p.id, p), p);
const getPlan = (id: string) => plans.get(id);

function toClient(plan: ExecutionPlan) {
  return {
    ...plan,
    market: { ...plan.market, bids: plan.market.bids.slice(0, 10), asks: plan.market.asks.slice(0, 10) },
  };
}

type OrderBook = { bids: [string | number, string | number][]; asks: [string | number, string | number][] };

async function resolveMarket(symbol: string, orderBook: OrderBook | undefined) {
  return orderBook ? snapshotFromDepth(symbol, orderBook) : await getMarketSnapshot(symbol);
}

function send(res: ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(json);
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function handleAnalyze(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await readBody(req);
    const intent = parseIntent({
      side: body.side === "SELL" ? "SELL" : "BUY",
      symbol: String(body.symbol ?? ""),
      amount: Number(body.amount),
      amountType: body.amountType === "BASE" ? "BASE" : "QUOTE",
      executionWindowMinutes: Number(body.executionWindowMinutes),
      maxSlippagePercent: Number(body.maxSlippagePercent),
    });

    const market = await resolveMarket(intent.symbol, body.orderBook as OrderBook | undefined);
    const capabilities = detectCapabilities();
    const plan = createPlan({ intent, market, mode: capabilities.trading ? "LIVE" : "DEMO" });
    plan.lastHealthySpreadPercent = market.spreadPercent;

    log(plan, "info", `Market data retrieved from ${market.source}`);
    log(plan, "info", `Spread calculated: ${market.spreadPercent.toFixed(3)}%`);
    log(plan, "info", `Full-order slippage estimated: ${plan.fullOrderEstimate.slippagePercent.toFixed(3)}%`);
    log(plan, "decision", `Strategy selected: ${plan.strategy}`);
    if (plan.strategy === "SPLIT" || plan.strategy === "WAIT") {
      log(plan, "info", `Created ${plan.slices.length} execution slices`);
    }
    log(
      plan,
      capabilities.trading ? "info" : "warn",
      capabilities.trading
        ? "Agent OS trading authorized — live execution available"
        : "Agent OS market data only — execution requires confirmation in the MCP client"
    );

    savePlan(plan);
    send(res, 200, { plan: toClient(plan), capabilities });
  } catch (err) {
    send(res, 400, { error: err instanceof Error ? err.message : "Analysis failed" });
  }
}

async function handleExecute(req: IncomingMessage, res: ServerResponse) {
  const body = await readBody(req);
  const plan = body.planId ? getPlan(String(body.planId)) : undefined;
  if (!plan) return send(res, 404, { error: "Plan not found." });

  const action = String(body.action ?? "STEP");
  const now = Date.now();

  if (action === "STATUS") {
    return send(res, 200, { plan: toClient(plan) });
  }

  if (action === "APPROVE") {
    if (plan.status !== "PLANNED") return send(res, 409, { error: "This plan was already actioned." });
    plan.status = "RUNNING";
    plan.startedAt = now;
    plan.deadline = now + plan.intent.executionWindowMinutes * 60_000;
    log(plan, "decision", "User approved execution");
    return send(res, 200, { plan: toClient(savePlan(plan)) });
  }

  if (action === "PAUSE") {
    plan.status = "PAUSED";
    log(plan, "warn", "Execution paused by user");
    return send(res, 200, { plan: toClient(savePlan(plan)) });
  }

  if (action === "RESUME") {
    plan.status = "RUNNING";
    log(plan, "info", "Execution resumed by user");
    return send(res, 200, { plan: toClient(savePlan(plan)) });
  }

  if (action === "ABORT") {
    plan.status = "ABORTED";
    plan.slices.forEach((s) => {
      if (s.status !== "FILLED") s.status = "CANCELLED";
    });
    log(plan, "error", "Execution aborted by user");
    return send(res, 200, { plan: toClient(savePlan(plan)) });
  }

  if (action === "DEMO_SHOCK") {
    plan.demoShockUntil = now + 25_000;
    log(plan, "warn", "Demo control: simulated spread widening applied to the live book");
    return send(res, 200, { plan: toClient(savePlan(plan)) });
  }

  if (action === "DECIDE") {
    const next = plan.slices.find((s) => s.status !== "FILLED" && s.status !== "CANCELLED");
    if (!next) {
      plan.status = "COMPLETED";
      log(plan, "fill", "All slices filled — execution complete");
      return send(res, 200, { plan: toClient(savePlan(plan)), decision: { action: "COMPLETE" } });
    }

    let market = await resolveMarket(plan.intent.symbol, body.orderBook as OrderBook | undefined);
    if (plan.demoShockUntil && now < plan.demoShockUntil) {
      market = applyDemoSpreadShock(market);
    }
    plan.market = market;
    log(plan, "info", `Market rechecked via ${market.source} — spread ${market.spreadPercent.toFixed(3)}%`);

    const analysis = analyzeSlice({ plan, slice: next, market, now });
    plan.lastDecision = analysis.recommendedAction;

    if (analysis.shouldAbort || analysis.shouldPause) {
      plan.status = analysis.shouldAbort ? "ABORTED" : "PAUSED";
      next.status = analysis.shouldAbort ? "CANCELLED" : "PAUSED";
      next.note = analysis.violations[0];
      analysis.violations.forEach((v) => log(plan, analysis.shouldAbort ? "error" : "warn", v));
      return send(res, 200, {
        plan: toClient(savePlan(plan)),
        decision: { action: analysis.shouldAbort ? "ABORT" : "PAUSE", violations: analysis.violations },
      });
    }

    plan.status = "RUNNING";
    plan.lastHealthySpreadPercent = market.spreadPercent;
    next.status = "READY";
    next.estimatedSlippagePercent = analysis.estimate.slippagePercent;
    next.expectedPrice = analysis.estimate.averagePrice;
    log(plan, "decision", `Slice ${next.number} cleared for execution — handing parameters to the MCP client`);

    return send(res, 200, {
      plan: toClient(savePlan(plan)),
      decision: {
        action: "CONTINUE",
        sliceId: next.id,
        sliceNumber: next.number,
        estimatedSlippagePercent: analysis.estimate.slippagePercent,
        order: {
          symbol: plan.intent.symbol,
          side: plan.intent.side,
          type: "MARKET",
          ...(plan.intent.amountType === "QUOTE" ? { quoteOrderQty: next.amount } : { quantity: next.amount }),
        },
      },
    });
  }

  if (action === "RECORD_FILL") {
    const slice = plan.slices.find((s) => s.id === body.sliceId);
    if (!slice) return send(res, 404, { error: "Slice not found." });

    const filledBase = Number(body.executedQty);
    const filledQuote = Number(body.cummulativeQuoteQty);
    if (!filledBase || !filledQuote) {
      return send(res, 400, { error: "executedQty and cummulativeQuoteQty are required." });
    }

    const avg = filledQuote / filledBase;
    const ref = plan.intent.side === "BUY" ? plan.market.bestAsk : plan.market.bestBid;
    const realised = Math.max(
      0,
      plan.intent.side === "BUY" ? ((avg - ref) / ref) * 100 : ((ref - avg) / ref) * 100
    );

    slice.status = "FILLED";
    slice.averageFillPrice = avg;
    slice.filledBase = filledBase;
    slice.filledQuote = filledQuote;
    slice.executedAt = Date.now();
    slice.realisedSlippagePercent = realised;
    slice.live = true;

    log(
      plan,
      "fill",
      `Slice ${slice.number} filled on Binance at ${avg.toFixed(4)} — ${realised.toFixed(3)}% realised slippage`
    );

    if (plan.slices.every((s) => s.status === "FILLED" || s.status === "CANCELLED")) {
      plan.status = "COMPLETED";
      log(plan, "fill", "Execution complete");
    }
    return send(res, 200, { plan: toClient(savePlan(plan)), slice });
  }

  // ---- STEP: the browser's own adaptive loop, one slice per call ----

  if (plan.status !== "RUNNING" && plan.status !== "PAUSED") {
    return send(res, 200, { plan: toClient(plan) });
  }

  const next = plan.slices.find((s) => s.status !== "FILLED" && s.status !== "CANCELLED");
  if (!next) {
    plan.status = "COMPLETED";
    log(plan, "fill", "All slices filled — execution complete");
    return send(res, 200, { plan: toClient(savePlan(plan)) });
  }

  let market = await resolveMarket(plan.intent.symbol, body.orderBook as OrderBook | undefined);
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

  const analysis = analyzeSlice({ plan, slice: next, market, now });
  plan.lastDecision = analysis.recommendedAction;

  if (analysis.shouldAbort) {
    plan.status = "ABORTED";
    next.status = "CANCELLED";
    analysis.violations.forEach((v) => log(plan, "error", v));
    log(plan, "error", "Execution aborted");
    return send(res, 200, { plan: toClient(savePlan(plan)) });
  }

  if (analysis.shouldPause) {
    plan.status = "PAUSED";
    next.status = "PAUSED";
    next.note = analysis.violations[0];
    analysis.violations.forEach((v) => log(plan, "warn", v));
    log(plan, "warn", `Slice ${next.number} held — Slice will re-check shortly`);
    return send(res, 200, { plan: toClient(savePlan(plan)) });
  }

  if (plan.status === "PAUSED") {
    log(plan, "info", `Conditions recovered — spread ${market.spreadPercent.toFixed(3)}%`);
    plan.status = "RUNNING";
  }

  plan.lastHealthySpreadPercent = market.spreadPercent;
  next.status = "EXECUTING";
  next.estimatedSlippagePercent = analysis.estimate.slippagePercent;
  next.expectedPrice = analysis.estimate.averagePrice;
  log(
    plan,
    "info",
    `Slice ${next.number} submitted — ${next.amount} ${plan.intent.amountType === "QUOTE" ? "quote" : "base"} @ est. ${analysis.estimate.averagePrice.toFixed(4)}`
  );

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

  return send(res, 200, { plan: toClient(savePlan(plan)) });
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  const url = req.url ?? "";
  try {
    if (req.method === "GET" && url === "/health") return send(res, 200, { ok: true, plans: plans.size });
    if (req.method === "POST" && url === "/api/analyze") return await handleAnalyze(req, res);
    if (req.method === "POST" && url === "/api/execute") return await handleExecute(req, res);
    send(res, 404, { error: `No route for ${req.method} ${url}` });
  } catch (err) {
    console.error("[slice-server] error", err);
    send(res, 500, { error: err instanceof Error ? err.message : "Internal error" });
  }
});

server.listen(PORT, () => {
  console.log(`[slice-server] listening on http://localhost:${PORT}`);
});
