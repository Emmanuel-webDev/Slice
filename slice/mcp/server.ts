#!/usr/bin/env node
/**
 * Slice MCP Server
 *
 * Composes with the official Binance MCP Server. Run BOTH in the same client:
 *
 *   binance-mcp-server  -> OAuth session, live market data, order placement
 *   slice               -> execution planning, slicing, constraint enforcement
 *
 * Slice never places an order. It decides whether an order should be placed,
 * how large it should be, and hands the exact parameters back to the client,
 * which sends them through the Binance MCP with the user confirming.
 *
 * This process is a thin HTTP client over the local Slice sync server
 * (server/index.ts — a plain Node HTTP server, not Next.js, run separately
 * with `npm run server`), so the browser monitor and this agent session
 * share one plan state. The browser's own client-side demo path does not
 * depend on this server; it exists so a second process (this one) can see
 * the same plan the browser is showing.
 *
 * PROTOCOL RULE: stdout belongs to MCP. Never console.log. Use console.error.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = process.env.SLICE_BASE_URL ?? "http://localhost:8791";
// The browser SPA (Vite), not the API server above — this is what a human opens.
const MONITOR_BASE = process.env.SLICE_MONITOR_URL ?? "http://localhost:5173";

async function api(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      json?.error ??
        `Slice API ${res.status} on ${path}. Is \`npm run server\` running (server/index.ts)?`,
    );
  }
  return json;
}

function text(payload: unknown) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(payload, null, 2) },
    ],
  };
}

function fail(err: unknown) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: err instanceof Error ? err.message : String(err),
      },
    ],
  };
}

/**
 * Order book as returned by the Binance MCP Server. Optional everywhere:
 * when the client supplies it, Agent OS is the data source. When it does
 * not, Slice falls back to Binance public REST.
 */
const bookSchema = z
  .object({
    bids: z.array(
      z.tuple([
        z.union([z.string(), z.number()]),
        z.union([z.string(), z.number()]),
      ]),
    ),
    asks: z.array(
      z.tuple([
        z.union([z.string(), z.number()]),
        z.union([z.string(), z.number()]),
      ]),
    ),
  })
  .optional()
  .describe(
    "Order book from the Binance MCP Server, in Binance depth format. Fetch this with the Binance MCP before calling, so the plan is built on the authorized Agent OS session.",
  );

type OrderBookArg =
  | { bids: (string | number)[][]; asks: (string | number)[][] }
  | undefined;

const server = new McpServer({ name: "slice", version: "1.0.0" });

server.registerTool(
  "slice_plan",
  {
    title: "Plan an execution",
    description:
      "Turns a trade intent into an execution plan. Analyses spread and order-book depth, estimates the slippage of executing the whole order at once, and decides IMMEDIATE, SPLIT, WAIT or ABORT. Does NOT place any order. Fetch the order book with the Binance MCP Server first and pass it as orderBook.",
    inputSchema: {
      symbol: z.string().describe("Trading pair, e.g. BNBUSDT"),
      side: z.enum(["BUY", "SELL"]),
      amount: z.number().positive(),
      amountType: z
        .enum(["QUOTE", "BASE"])
        .describe("QUOTE = spend/receive in USDT, BASE = in BNB"),
      executionWindowMinutes: z.number().positive(),
      maxSlippagePercent: z.number().positive(),
      orderBook: bookSchema,
    },
  },
  async (args: {
    symbol: string;
    side: "BUY" | "SELL";
    amount: number;
    amountType: "QUOTE" | "BASE";
    executionWindowMinutes: number;
    maxSlippagePercent: number;
    orderBook: OrderBookArg;
  }) => {
    try {
      const { plan, capabilities } = await api("/api/analyze", {
        method: "POST",
        body: JSON.stringify(args),
      });
      return text({
        planId: plan.id,
        strategy: plan.strategy,
        liquidity: plan.liquidity,
        spreadPercent: Number(plan.market.spreadPercent.toFixed(4)),
        fullOrderSlippagePercent: Number(
          plan.fullOrderEstimate.slippagePercent.toFixed(4),
        ),
        estimatedSlippagePercent: Number(
          plan.estimatedSlippagePercent.toFixed(4),
        ),
        maxSlippagePercent: plan.intent.maxSlippagePercent,
        requestedAmount: plan.intent.amount,
        plannableAmount: plan.plannableAmount,
        unfillableAmount: plan.unfillableAmount,
        slices: plan.slices.map((s: any) => ({
          number: s.number,
          amount: s.amount,
        })),
        reasoning: plan.reasoning,
        marketDataSource: plan.market.source,
        capabilities,
        monitorUrl: `${MONITOR_BASE}/?plan=${plan.id}`,
        nextStep:
          "Show this plan to the user and ask for approval. On approval call slice_approve, then slice_next_slice.",
      });
    } catch (err) {
      return fail(err);
    }
  },
);

server.registerTool(
  "slice_approve",
  {
    title: "Approve an execution plan",
    description:
      "Records the user's explicit approval and starts the execution window. Call this only after the user has seen the plan and said yes. Still places no orders.",
    inputSchema: { planId: z.string() },
  },
  async ({ planId }: { planId: string }) => {
    try {
      const { plan } = await api("/api/execute", {
        method: "POST",
        body: JSON.stringify({ planId, action: "APPROVE" }),
      });
      return text({
        status: plan.status,
        deadline: new Date(plan.deadline).toISOString(),
        nextStep: "Call slice_next_slice to get the first decision.",
      });
    } catch (err) {
      return fail(err);
    }
  },
);

server.registerTool(
  "slice_next_slice",
  {
    title: "Decide the next slice",
    description:
      "Re-checks the market against the user's constraints and returns one of: CONTINUE with exact order parameters to send through the Binance MCP Server, PAUSE with the violated constraint, or ABORT. Call this immediately before every order — never reuse an earlier decision. Pass a freshly fetched orderBook so the decision uses live Agent OS data.",
    inputSchema: { planId: z.string(), orderBook: bookSchema },
  },
  async ({ planId, orderBook }: { planId: string; orderBook: OrderBookArg }) => {
    try {
      const { plan, decision } = await api("/api/execute", {
        method: "POST",
        body: JSON.stringify({ planId, action: "DECIDE", orderBook }),
      });
      if (decision.action !== "CONTINUE") {
        return text({
          decision: decision.action,
          reasons: decision.violations,
          spreadPercent: Number(plan.market.spreadPercent.toFixed(4)),
          nextStep:
            decision.action === "PAUSE"
              ? "Do not place an order. Tell the user why, wait ~20 seconds, then call slice_next_slice again."
              : "Do not place an order. The plan is aborted. Tell the user why.",
        });
      }
      return text({
        decision: "CONTINUE",
        sliceId: decision.sliceId,
        sliceNumber: decision.sliceNumber,
        order: decision.order,
        estimatedSlippagePercent: Number(
          decision.estimatedSlippagePercent.toFixed(4),
        ),
        maxSlippagePercent: plan.intent.maxSlippagePercent,
        nextStep:
          "Place exactly these order parameters through the Binance MCP Server. The user must confirm. Then call slice_record_fill with the executedQty and cummulativeQuoteQty Binance returns.",
      });
    } catch (err) {
      return fail(err);
    }
  },
);

server.registerTool(
  "slice_record_fill",
  {
    title: "Record a completed fill",
    description:
      "Records what the Binance MCP Server actually filled, computes realised slippage against the pre-trade estimate, and advances the plan. Call this after every confirmed order.",
    inputSchema: {
      planId: z.string(),
      sliceId: z.string(),
      executedQty: z
        .number()
        .describe("Base quantity filled, from the Binance order response"),
      cummulativeQuoteQty: z
        .number()
        .describe("Quote spent or received, from the Binance order response"),
      orderId: z.string().optional(),
    },
  },
  async (args: {
    planId: string;
    sliceId: string;
    executedQty: number;
    cummulativeQuoteQty: number;
    orderId: string | undefined;
  }) => {
    try {
      const { plan, slice } = await api("/api/execute", {
        method: "POST",
        body: JSON.stringify({ ...args, action: "RECORD_FILL" }),
      });
      return text({
        sliceNumber: slice.number,
        averageFillPrice: slice.averageFillPrice,
        realisedSlippagePercent: slice.realisedSlippagePercent,
        estimatedSlippagePercent: slice.estimatedSlippagePercent,
        planStatus: plan.status,
        remainingSlices: plan.slices.filter((s: any) => s.status === "PENDING")
          .length,
        nextStep:
          plan.status === "COMPLETED"
            ? "Execution is complete. Summarise the fills for the user."
            : "Call slice_next_slice again. Do not assume conditions are unchanged.",
      });
    } catch (err) {
      return fail(err);
    }
  },
);

server.registerTool(
  "slice_status",
  {
    title: "Read plan state",
    description:
      "Returns the full current state of a plan, including the activity log.",
    inputSchema: { planId: z.string() },
  },
  async ({ planId }: { planId: string }) => {
    try {
      const { plan } = await api("/api/execute", {
        method: "POST",
        body: JSON.stringify({ planId, action: "STATUS" }),
      });
      return text({
        status: plan.status,
        strategy: plan.strategy,
        slices: plan.slices,
        activity: plan.activity.map(
          (a: any) =>
            `${new Date(a.t).toISOString().slice(11, 19)} ${a.message}`,
        ),
      });
    } catch (err) {
      return fail(err);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[slice] MCP server ready, proxying ${BASE}`);
