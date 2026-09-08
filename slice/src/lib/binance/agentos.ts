import type { Capabilities, ExecutionIntent, ExecutionSlice } from "../types/execution";

/**
 * IMPORTANT — read before changing this file.
 *
 * The Binance MCP Server (https://agent.binance.com/mcp/agentic) is an
 * OAuth-authorized, Streamable-HTTP MCP endpoint intended for MCP *clients*
 * (Claude Code, Claude Desktop, Codex, ChatGPT, VS Code, Grok). There is no
 * documented API-key or bearer-token path for a web server to place orders on
 * a user's behalf, and Binance's docs explicitly say not to open the endpoint
 * directly or hand it to a chat to install.
 *
 * So Slice splits responsibility:
 *   - Market data  -> Binance public REST (no auth required, see market.ts)
 *   - Live orders  -> the operator's MCP client, holding the OAuth session,
 *                     calling Slice's MCP tools (see mcp/server.ts)
 *   - This web app -> plans, monitors, and simulates
 *
 * The web app therefore never claims trading authorization it does not have.
 */

export const MCP_ENDPOINT = "https://agent.binance.com/mcp/agentic";

/**
 * Trading is only ever enabled when an operator has explicitly wired an
 * MCP-side executor and set this flag. Default is market-data-only.
 */
// import.meta.env is Vite-only, process is Node-only — this module runs in both
// the browser (Vite) and the plain Node/tsx local sync server, so guard both via
// globalThis rather than referencing `process` directly (the browser tsconfig has
// no Node types, so a bare `process` identifier fails to compile there).
const nodeProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
const OPERATOR_TRADING_ENABLED =
  (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_SLICE_TRADING_ENABLED === "true" ||
  nodeProcess?.env?.SLICE_TRADING_ENABLED === "true";

export function detectCapabilities(): Capabilities {
  return {
    marketData: true,
    trading: OPERATOR_TRADING_ENABLED,
    detail: OPERATOR_TRADING_ENABLED
      ? "Agentic sub-account connected through the operator's MCP client"
      : "Market data only — execution requires confirmation in the MCP client",
  };
}

export interface SimulatedFill {
  orderId: string;
  averageFillPrice: number;
  filledBase: number;
  filledQuote: number;
  simulated: true;
}

/**
 * Fills at the price the live order book actually implies, so the numbers on
 * screen are real market numbers even though no order was sent through this
 * function. Used by the browser's own self-driven loop; an MCP-driven session
 * never calls this — it records a real fill via slice_record_fill instead.
 */
export function simulateFill(
  intent: ExecutionIntent,
  slice: ExecutionSlice,
  averagePrice: number
): SimulatedFill {
  const filledBase =
    intent.amountType === "QUOTE" ? slice.amount / averagePrice : slice.amount;
  const filledQuote =
    intent.amountType === "QUOTE" ? slice.amount : slice.amount * averagePrice;
  return {
    orderId: `sim_${Math.random().toString(36).slice(2, 10)}`,
    averageFillPrice: averagePrice,
    filledBase,
    filledQuote,
    simulated: true,
  };
}
