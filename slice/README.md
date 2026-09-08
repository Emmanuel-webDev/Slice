# Slice

**An adaptive trade execution agent built on Binance Agent OS.**

Most trading agents try to answer *what should I buy?* Slice answers a different question, and a harder one to get right:

> Once you have decided to trade, what is the best way to execute that trade inside your constraints?

You give Slice an intent. It reads the live order book through Binance Agent OS, works out what executing that order would actually cost, and decides whether to send it now, break it into smaller orders, wait, or refuse. Before every single order it looks at the market again. It never trusts a snapshot it took a minute ago.

Slice never places an order itself. It produces the exact order parameters and hands them to your MCP client, where you confirm.

---

## What it does in practice

Ask for 900,000 USDT of BNB with a 15 minute window:

```
Requested          900,000 USDT
Plannable          449,074 USDT
Unfillable         450,926 USDT
Depth cover        0.50x
Strategy           SPLIT into 2 orders
Slippage per order 0.053%   (limit 0.20%)
```

> The visible book covers 449,074 of your 900,000 request. Slice will plan against what is available and re-check as depth replenishes.

It tells you it cannot fill your order. That is the behaviour that matters. An execution agent that quietly plans against depth it has already consumed is worse than no agent at all.

Now tighten the limit to 0.005% and ask again:

```
Plan time     WAIT    Even the smallest supported slice would breach your slippage limit at current depth.
Runtime       PAUSE   Actual 0.048%   Limit 0.005%
```

Two independent checkpoints, same verdict, both from real order book arithmetic. No retry, no workaround.

---

## How Agent OS fits

Slice runs as an MCP server beside the official Binance MCP server, in the same client session.

```
                    Claude Code
                   /            \
   binance-mcp-server            slice
   OAuth session                 planning, slicing,
   live order book               constraint enforcement
   order placement
                   \            /
                     you confirm
```

The division of labour is deliberate:

| Concern | Owner |
| --- | --- |
| Authorized market data | Binance Agent OS |
| Should this order be sent, and how large | Slice |
| Sending the order | Binance Agent OS |
| Approving the order | You |

Every plan records where its book came from. When Agent OS supplied it, the plan reads `"marketDataSource": "binance-mcp-server (Agent OS)"`. When no client session is present, Slice falls back to Binance public REST and says so. It never claims authorization it does not hold.

There is no withdrawal scope in Agent OS, and there never will be. Trades run inside a dedicated agentic sub account, isolated from your main balance.

---

## Tools

| Tool | Purpose |
| --- | --- |
| `slice_plan` | Turn an intent into an execution plan with reasoning. Places nothing. |
| `slice_approve` | Record explicit approval and start the execution window. |
| `slice_next_slice` | Re-check the market. Return CONTINUE with order parameters, or PAUSE or ABORT with the violated constraint. |
| `slice_record_fill` | Record what Binance actually filled. Compute realised against estimated slippage. |
| `slice_status` | Read plan state and activity log. |

---

## The engine

Every number on screen comes from deterministic TypeScript. No model is asked to do arithmetic.

| File | Responsibility |
| --- | --- |
| `lib/execution/slippage.ts` | Walks the book level by level. Average execution price, worst fill, slippage. |
| `lib/execution/liquidity.ts` | HIGH, MEDIUM, LOW classification. Every tunable threshold lives here. |
| `lib/execution/strategy.ts` | IMMEDIATE, SPLIT, WAIT, ABORT. Caps plans at what the book can absorb. |
| `lib/execution/slicing.ts` | Deterministic slice sizing, front loaded when depth allows. |
| `lib/execution/constraints.ts` | Runs before every order. Deadline, spread ceiling, depth, slippage. |

An LLM may parse a plain English intent and phrase an explanation. It may never decide a quantity, compute a spread, or approve an execution.

---

## Running it

Requires Node 18 or newer, and a desktop browser for the Binance consent screen.

```bash
npm install
npm run dev          # monitor UI on http://localhost:5173
npm run server       # engine API
```

Register both MCP servers:

```bash
claude mcp add slice -- npx tsx /absolute/path/to/mcp/server.ts
claude mcp add binance-mcp-server --transport http https://agent.binance.com/mcp/agentic
```

Authorize Binance in the browser. Grant market data and account scopes. Spot trading is optional; Slice works fully without it, and stops at the order parameters instead of raising a confirmation prompt.

Then, in Claude Code:

> Fetch the BNBUSDT order book with the Binance MCP, then plan a buy of 500 USDT of BNB over 15 minutes with a 0.20% maximum slippage.

Open the monitor beside your terminal. Both show the same plan, live, as the agent works.

---

## Honest scope

- Spot only. One pair per execution.
- Plans are held in memory. No database.
- Order placement requires your confirmation in the MCP client. The web app plans and monitors.
- Where a fill is simulated, it is simulated against the live book and labelled. No simulated fill is ever presented as a Binance order.

Built for the Binance Agent OS Mini Hackathon, Track A.