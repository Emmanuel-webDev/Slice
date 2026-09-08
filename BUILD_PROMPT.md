# SLICE — Build Prompt (paste this into Claude Code)

You are building **Slice**, an adaptive trade execution agent, for the Binance Agent OS Mini
Hackathon Track A. Submission closes **today, 8 Sept 2026, 23:59 UTC**. You have under two hours.

Read this whole file before writing anything. The research is already done — do not go and search
for Binance MCP docs, the answers are in the Verified Facts appendix at the bottom. Do not
re-litigate the architecture; it was chosen against a hard constraint you will otherwise
rediscover the expensive way.

---

## The one architectural decision you must not undo

The Binance MCP Server at `https://agent.binance.com/mcp/agentic` is **OAuth-authorized and built
for MCP clients**, not for server-to-server calls. There is no documented API-key or bearer-token
path for a Next.js backend to place orders on a user's behalf. Binance's docs explicitly tell users
not to open the endpoint in a browser or paste it into a chat.

Implementing OAuth 2.0 with dynamic client registration against that endpoint will consume your
entire remaining time and probably fail. **Do not attempt it.**

Slice therefore splits responsibility three ways:

| Concern | Where it lives | Auth needed |
|---|---|---|
| Market data (book, spread, depth) | Binance **public REST** | None |
| Planning, slicing, constraint math | Slice's own TypeScript engine | None |
| Live order placement | The operator's MCP client (Claude Code) holding the OAuth session | Binance OAuth, done by the human |

The web app plans, monitors and simulates. It **never** claims trading authorization it does not
have, and every simulated fill is labelled `DEMO EXECUTION` on screen. This is not a cop-out — it
is the same confirm-before-execute pattern Binance itself documents, and it is what makes the
project defensible to judges rather than a fake trading screenshot.

---

## What already exists

The engine and API layer are written. Start by reading these, do not rewrite them:

```
lib/types/execution.ts        # every shared type
lib/binance/market.ts         # public REST book fetch + host fallback + demo shock
lib/binance/agentos.ts        # capability detection + simulated fill
lib/execution/slippage.ts     # order-book walk, avg execution price, slippage
lib/execution/liquidity.ts    # HIGH/MEDIUM/LOW + all tunable thresholds
lib/execution/slicing.ts      # deterministic slice sizing
lib/execution/strategy.ts     # IMMEDIATE / SPLIT / WAIT / ABORT + plan construction
lib/execution/constraints.ts  # per-slice constraint engine
lib/execution/store.ts        # in-memory plan store
app/api/market/route.ts       # GET  ?symbol=BNBUSDT
app/api/analyze/route.ts      # POST intent -> plan (does NOT execute)
app/api/execute/route.ts      # POST { planId, action } -> adaptive loop, one slice per call
```

Your job is Phases 1, 4, 5, 6 below.

---

## Phase 1 — Scaffold (10 minutes)

```bash
npx create-next-app@latest slice --typescript --tailwind --app --eslint --src-dir=false --import-alias "@/*"
```

Drop the existing files in at the paths above. Confirm `npm run dev` boots and
`curl "localhost:3000/api/market?symbol=BNBUSDT"` returns a book with a spread.

If it does not return a book, the machine is geo-blocked from `api.binance.com`. `market.ts`
already falls back to `data-api.binance.vision`, which is the unrestricted public mirror. Check the
fallback fired before debugging anything else.

**Stop rule:** if market data is not flowing at the 15-minute mark, hardcode a saved book snapshot
into a fixture file and keep moving. A demo with a stale book beats no demo.

---

## Phase 4 — UI (45 minutes, the largest remaining block)

Build **one route** (`app/page.tsx`, client component) with four view states driven by local
state: `FORM → ANALYSIS → APPROVAL → MONITOR`. Do not build `/execute` and `/monitor` as separate
routes — cross-route state handoff is where hackathon builds die, and no judge will notice.

### State machine

```
FORM      -- submit --> POST /api/analyze  --> ANALYSIS
ANALYSIS  -- continue --> APPROVAL
APPROVAL  -- approve  --> POST /api/execute {action:"APPROVE"} --> MONITOR
MONITOR   -- setInterval(3000) --> POST /api/execute {action:"STEP"}
```

Poll `STEP` every 3 seconds while `plan.status` is `RUNNING` or `PAUSED`. Stop polling on
`COMPLETED` or `ABORTED`. Each `STEP` call re-fetches the book server-side and either fills,
holds, or aborts one slice — the client is a dumb renderer, all decisions are server-side.

### Screens

**FORM** — BUY/SELL toggle, pair (default `BNBUSDT`), amount + `USDT`/`BNB` unit selector,
execution window in minutes (default 15), max slippage % (default 0.20). One button: *Analyze
execution*.

**ANALYSIS** — market block (mid price, spread %, best bid, best ask, source host), liquidity
badge, full-order estimate (requested amount, estimated average price, estimated slippage %), and
the strategy decision with `plan.reasoning` rendered as bullets under the heading *Why Slice chose
this plan*.

**APPROVAL** — the whole plan, every slice listed with its amount, max vs current estimated
slippage, window. Primary *Approve execution*, secondary *Cancel*. If `plan.mode === "DEMO"`, the
approve button reads *Approve demo execution* and a persistent banner reads
`DEMO EXECUTION — orders are simulated against live Binance market data`.

**MONITOR** — the hero screen. Left: progress (executed vs remaining), then the slice timeline
with per-slice status, fill price and realised slippage. Right: live market panel (spread,
liquidity, current decision `CONTINUE`/`PAUSE`/`ABORT`) and the activity log, newest last,
timestamped `HH:MM:SS`, rendered straight from `plan.activity`.

Include a small, clearly-labelled **Simulate spread widening** button that POSTs
`{action:"DEMO_SHOCK"}`. This is your demo moment (see Phase 6). Label it as a demo control — never
disguise it as a market event.

### Visual direction

Financial instrument, not a trading dashboard. IBM Plex Sans for text, IBM Plex Mono for every
number (real alignment value, not decoration). Cool neutral ground (`#EEF0F1`), white surfaces,
deep slate ink (`#1A2430`), one deep green for fills (`#0E7A5F`), one burnt orange for holds
(`#B4541A`). Generous whitespace, hairline rules, no gradients, no glow, no emoji, no confetti.
Tabular figures throughout so numbers don't jitter as they update. Sentence case labels.

**Stop rule:** at the 75-minute mark the UI is frozen regardless of how it looks. Ugly and working
wins.

---

## Phase 5 — Agent OS integration proof (20 minutes)

This is what makes it a Track A entry rather than a trading form. Add a minimal MCP server so an
operator's Claude Code session — which already holds the Binance OAuth token — can drive Slice and
place the real order.

```
mcp/server.ts   # @modelcontextprotocol/sdk, stdio transport
```

Expose exactly three tools, thin wrappers over the existing engine:

- `slice_plan` — args `{symbol, side, amount, amountType, executionWindowMinutes, maxSlippagePercent}`; returns the plan with reasoning.
- `slice_next_slice` — args `{planId}`; re-checks the book, returns `CONTINUE` with the exact order params, or `PAUSE`/`ABORT` with reasons.
- `slice_record_fill` — args `{planId, sliceId, executedQty, cummulativeQuoteQty}`; records what the Binance MCP actually filled.

The demo flow is then: Claude Code holds both `binance-mcp-server` and `slice`. Slice decides
*whether and how much* to trade; the Binance MCP places it; the human confirms each order. Slice
never places an order itself.

Register with:

```bash
claude mcp add slice --transport stdio -- node ./mcp/server.js
```

**Stop rule:** if this is not working at the 95-minute mark, ship without it and say plainly in the
README that live execution runs through the operator's MCP client and the web app is the planning
and monitoring surface. Do not fake it.

---

## Phase 6 — Demo and submission (25 minutes)

Record 90 seconds, screen only, no talking head:

1. Enter *Buy 500 USDT of BNB, 15 minutes, 0.20% max slippage*. (0:00–0:15)
2. Analysis lands. Read the reasoning aloud — the agent explains why it will not send this as one order. (0:15–0:35)
3. Approve. Slice 1 fills. Activity log scrolls. (0:35–0:55)
4. Hit the spread-widening control. Slice pauses, log states the violated constraint. Then it recovers and slice 2 fills. (0:55–1:20) — **this is the shot that wins or loses it**
5. One line: *Slice does not pick what to trade. It decides how to execute what you have already decided.* (1:20–1:30)

Then: push to GitHub with a README covering architecture, the OAuth constraint above, and an
honest live-vs-simulated statement. Follow @Binance, repost the hackathon post, reply with video +
repo link, complete the survey. **Submit at least 40 minutes before 23:59 UTC.**

---

## Rules that hold throughout

- Spread, slippage, quantities, balances and constraint checks are **deterministic TypeScript**. An LLM may parse natural-language intent and phrase explanations. It may never do arithmetic or decide execution.
- Never execute on a stale snapshot. Every slice re-fetches the book first. This is the product.
- Plan creation and execution are separate user actions. Always.
- Never present a simulated fill as a real Binance order, in the UI, the README, or the video.
- No withdrawals, no futures, no margin, no persistence layer, no auth system.
- If any phase overruns its stop rule, cut scope and move on. A shipped 70% beats an unsubmitted 100%.

---

# Appendix — Verified facts (do not re-research)

**Hackathon.** Binance Agent OS Mini Hackathon, $60,000 USDC pool. Track A ($20K) is building an AI
agent with Agent OS and requires a video/demo plus GitHub repo; Track B ($40K) is connecting MCPs
and trading. Deadline 8 Sept 2026, 23:59 UTC. Entry = follow @Binance, repost, reply with
submission, complete the survey. Excluded jurisdictions include US, UK, EEA, Hong Kong and
Singapore — check your eligibility before spending the two hours.

**Agent OS.** Launched 20 Aug 2026. MCP endpoint `https://agent.binance.com/mcp/agentic`, MCP over
Streamable HTTP, added via `claude mcp add binance-mcp-server --transport http <endpoint>` then
OAuth consent. No API keys stored locally.

**Scopes.** Market data is public and needs no auth. Account = Agentic sub-account balances plus
optional read-only view of the main account. Trade = spot, margin, convert, USDⓈ-M and COIN-M
futures. Transfer = between wallets *inside* the same Agentic sub-account only. **There is no
withdrawal scope, ever.**

**Agentic sub-account.** Orders execute in a dedicated sub-account isolated from the main account.
It starts empty and must be funded manually from the Binance web UI — the agent cannot pull funds
from the main account. Fund it with only what you will let the agent trade. If you plan a live
order in the video, fund ~$20 and trade $10.

**Confirmation model.** Binance's documented pattern: reads run immediately, every order or
transfer is restated and confirmed by the human first. Slice's approval gate mirrors this
deliberately — say so in the README.

**Public market data endpoints** (no auth, use these for everything the engine needs):
- `GET https://data-api.binance.vision/api/v3/depth?symbol=BNBUSDT&limit=100` — preferred, public mirror, no geo restrictions
- `GET https://api.binance.com/api/v3/depth?...` — same shape, geo-blocked in some regions
- `GET .../api/v3/ticker/bookTicker?symbol=BNBUSDT` — best bid/ask only
- `GET .../api/v3/exchangeInfo?symbol=BNBUSDT` — `LOT_SIZE` and `NOTIONAL` filters

**Gotcha that will bite you.** Binance rejects orders below the `MIN_NOTIONAL` filter — typically
around 5 USDT on major spot pairs. A 5-way split of a small order produces slices the exchange
refuses. `THRESHOLDS.minSliceQuote` in `lib/execution/liquidity.ts` guards this; keep it at 10 or
higher, and for a live demo order size the whole intent so every slice clears the filter.

**Prior art.** Other entrants have shipped risk-gated MCP trader agents and precision/idempotency
layers. Slice's differentiator is not safety plumbing — it is that the agent *re-observes the
market between slices and visibly changes its mind*. Every minute of build time should protect
that moment.
