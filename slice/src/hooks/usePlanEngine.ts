import { useCallback, useEffect, useRef, useState } from "react";
import { getMarketSnapshot, applyDemoSpreadShock } from "@/lib/binance/market";
import { detectCapabilities, simulateFill } from "@/lib/binance/agentos";
import { createPlan } from "@/lib/execution/strategy";
import { analyzeSlice } from "@/lib/execution/constraints";
import { log } from "@/lib/execution/activity";
import { parseIntent, type IntentInput } from "@/lib/execution/intent";
import type { Capabilities, ExecutionPlan } from "@/lib/types/execution";

export type Screen = "SETUP" | "ANALYSIS" | "APPROVAL" | "MONITOR";

export type SetupInput = IntentInput;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function usePlanEngine() {
  const [screen, setScreen] = useState<Screen>("SETUP");
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities>(() => detectCapabilities());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recheckLoading, setRecheckLoading] = useState(false);
  const [abortArmed, setAbortArmed] = useState(false);

  const planRef = useRef<ExecutionPlan | null>(null);
  planRef.current = plan;

  /** Applies a mutation to a deep-cloned copy of the current plan and commits it. */
  const updatePlan = useCallback((mutator: (p: ExecutionPlan) => void) => {
    setPlan((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      mutator(next);
      return next;
    });
  }, []);

  const analyze = useCallback(async (input: SetupInput) => {
    setLoading(true);
    setError(null);
    try {
      const intent = parseIntent(input);
      const market = await getMarketSnapshot(intent.symbol);
      const caps = detectCapabilities();
      setCapabilities(caps);

      const newPlan = createPlan({ intent, market, mode: caps.trading ? "LIVE" : "DEMO" });
      newPlan.lastHealthySpreadPercent = market.spreadPercent;

      log(newPlan, "info", `Market data retrieved from ${market.source}`);
      log(newPlan, "info", `Spread calculated: ${market.spreadPercent.toFixed(3)}%`);
      log(newPlan, "info", `Full-order slippage estimated: ${newPlan.fullOrderEstimate.slippagePercent.toFixed(3)}%`);
      log(newPlan, "decision", `Strategy selected: ${newPlan.strategy}`);
      if (newPlan.strategy === "SPLIT" || newPlan.strategy === "WAIT") {
        log(newPlan, "info", `Created ${newPlan.slices.length} execution slices`);
      }
      log(
        newPlan,
        caps.trading ? "info" : "warn",
        caps.trading
          ? "Agent OS trading authorized — live execution available"
          : "Agent OS market data only — execution requires confirmation in the MCP client"
      );

      setPlan(newPlan);
      setScreen("ANALYSIS");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const goToApproval = useCallback(() => setScreen("APPROVAL"), []);
  const backToSetup = useCallback(() => setScreen("SETUP"), []);
  /** Free navigation between already-reached screens, e.g. from the nav rail. */
  const goTo = useCallback((target: Screen) => setScreen(target), []);

  const approve = useCallback(() => {
    const now = Date.now();
    updatePlan((p) => {
      p.status = "RUNNING";
      p.startedAt = now;
      p.deadline = now + p.intent.executionWindowMinutes * 60_000;
      p.nextDecisionNote = `Check the book, then submit slice 1 of ${p.slices.length}.`;
      log(p, "decision", "User approved execution");
    });
    setScreen("MONITOR");
  }, [updatePlan]);

  /** One adaptive tick: re-observes the market and either fills, holds, or aborts the next slice. */
  const step = useCallback(async () => {
    const current = planRef.current;
    if (!current) return;
    if (current.status !== "RUNNING") return;

    const next = current.slices.find((s) => s.status !== "FILLED" && s.status !== "CANCELLED");
    if (!next) {
      updatePlan((p) => {
        p.status = "COMPLETED";
        log(p, "fill", "All slices filled — execution complete");
      });
      return;
    }

    const now = Date.now();
    let market = await getMarketSnapshot(current.intent.symbol);
    if (current.demoShockUntil && now < current.demoShockUntil) {
      market = applyDemoSpreadShock(market);
    }

    updatePlan((p) => {
      const slice = p.slices.find((s) => s.id === next.id);
      if (!slice) return;

      p.market = market;
      slice.status = "CHECKING";
      log(
        p,
        "info",
        `Market rechecked — spread ${market.spreadPercent.toFixed(3)}%${market.synthetic ? " (demo shock active)" : ""}`
      );

      const analysis = analyzeSlice({ plan: p, slice, market, now });
      p.lastDecision = analysis.recommendedAction;

      if (analysis.shouldAbort) {
        p.status = "ABORTED";
        slice.status = "CANCELLED";
        analysis.violations.forEach((v) => log(p, "error", v));
        log(p, "error", "Execution aborted — the window expired with the order unfinished");
        return;
      }

      if (analysis.shouldPause) {
        p.status = "PAUSED";
        slice.status = "PAUSED";
        slice.note = analysis.violations[0];
        analysis.violations.forEach((v) => log(p, "warn", v));
        log(p, "warn", `Slice ${slice.number} held — Slice will re-check shortly`);
        p.nextDecisionNote = "Hold until the spread returns inside your execution threshold.";
        return;
      }

      p.lastHealthySpreadPercent = market.spreadPercent;
      slice.status = "EXECUTING";
      slice.estimatedSlippagePercent = analysis.estimate.slippagePercent;
      slice.expectedPrice = analysis.estimate.averagePrice;
      log(
        p,
        "info",
        `Slice ${slice.number} submitted — ${slice.amount} ${p.intent.amountType === "QUOTE" ? "quote" : "base"} @ est. ${analysis.estimate.averagePrice.toFixed(4)}`
      );

      const fill = simulateFill(p.intent, slice, analysis.estimate.averagePrice);
      slice.status = "FILLED";
      slice.averageFillPrice = fill.averageFillPrice;
      slice.filledBase = fill.filledBase;
      slice.filledQuote = fill.filledQuote;
      slice.executedAt = Date.now();
      log(
        p,
        "fill",
        `Slice ${slice.number} filled (simulated) at ${fill.averageFillPrice.toFixed(4)} — ${analysis.estimate.slippagePercent.toFixed(3)}% slippage`
      );

      const remaining = p.slices.filter((s) => s.status !== "FILLED" && s.status !== "CANCELLED");
      if (remaining.length === 0) {
        p.status = "COMPLETED";
        log(p, "fill", "Execution complete");
      } else {
        p.nextDecisionNote = `Hold for one more depth check, then submit slice ${remaining[0].number}.`;
      }
    });
  }, [updatePlan]);

  /** Manual "Recheck market" from the pause banner — shows Checking → Resuming → Running/Complete. */
  const recheck = useCallback(async () => {
    const current = planRef.current;
    if (!current || current.status !== "PAUSED") return;

    setRecheckLoading(true);
    await sleep(650);

    const next = current.slices.find((s) => s.status !== "FILLED" && s.status !== "CANCELLED");
    if (!next) {
      setRecheckLoading(false);
      return;
    }

    const now = Date.now();
    const market = await getMarketSnapshot(current.intent.symbol);
    const analysis = analyzeSlice({ plan: current, slice: next, market, now });

    if (analysis.shouldAbort || analysis.shouldPause) {
      updatePlan((p) => {
        const slice = p.slices.find((s) => s.id === next.id);
        if (!slice) return;
        p.market = market;
        if (analysis.shouldAbort) {
          p.status = "ABORTED";
          slice.status = "CANCELLED";
          log(p, "error", "Execution aborted — the window expired with the order unfinished");
        } else {
          slice.note = analysis.violations[0];
          analysis.violations.forEach((v) => log(p, "warn", v));
          log(p, "info", "Recheck: conditions still exceed the execution threshold");
        }
      });
      setRecheckLoading(false);
      return;
    }

    // Conditions recovered — transition through Resuming before landing on Running/Complete.
    updatePlan((p) => {
      const slice = p.slices.find((s) => s.id === next.id);
      if (!slice) return;
      p.market = market;
      p.status = "RESUMING";
      p.lastHealthySpreadPercent = market.spreadPercent;
      log(p, "info", `Conditions recovered — spread ${market.spreadPercent.toFixed(3)}%`);
      log(p, "decision", `Conditions recovered. Slice ${slice.number} is entering at the refreshed threshold.`);

      slice.status = "EXECUTING";
      slice.estimatedSlippagePercent = analysis.estimate.slippagePercent;
      slice.expectedPrice = analysis.estimate.averagePrice;

      const fill = simulateFill(p.intent, slice, analysis.estimate.averagePrice);
      slice.status = "FILLED";
      slice.averageFillPrice = fill.averageFillPrice;
      slice.filledBase = fill.filledBase;
      slice.filledQuote = fill.filledQuote;
      slice.executedAt = Date.now();
      log(
        p,
        "fill",
        `Slice ${slice.number} filled (simulated) at ${fill.averageFillPrice.toFixed(4)} — ${analysis.estimate.slippagePercent.toFixed(3)}% slippage`
      );
    });
    setRecheckLoading(false);

    await sleep(1100);
    updatePlan((p) => {
      if (p.status !== "RESUMING") return;
      const remaining = p.slices.filter((s) => s.status !== "FILLED" && s.status !== "CANCELLED");
      if (remaining.length === 0) {
        p.status = "COMPLETED";
        log(p, "fill", "Execution complete");
      } else {
        p.status = "RUNNING";
        p.nextDecisionNote = `Hold for one more depth check, then submit slice ${remaining[0].number}.`;
      }
    });
  }, [updatePlan]);

  const abort = useCallback(() => {
    updatePlan((p) => {
      p.status = "ABORTED";
      p.slices.forEach((s) => {
        if (s.status !== "FILLED") s.status = "CANCELLED";
      });
      log(p, "error", "Execution aborted by user");
    });
    setAbortArmed(false);
  }, [updatePlan]);

  /** Prototype-only: widen the live spread so the pause path is reproducible on demand. */
  const demoShock = useCallback(async () => {
    updatePlan((p) => {
      p.demoShockUntil = Date.now() + 25_000;
      log(p, "warn", "Demo control: simulated spread widening applied to the live book");
    });
    await step();
  }, [updatePlan, step]);

  /** Prototype-only: jump straight to the completed state without waiting for real fills. */
  const completeDemo = useCallback(() => {
    updatePlan((p) => {
      p.slices.forEach((s) => {
        if (s.status === "FILLED" || s.status === "CANCELLED") return;
        const price = s.expectedPrice ?? p.market.midPrice;
        const fill = simulateFill(p.intent, s, price);
        s.status = "FILLED";
        s.averageFillPrice = fill.averageFillPrice;
        s.filledBase = fill.filledBase;
        s.filledQuote = fill.filledQuote;
        s.executedAt = Date.now();
      });
      p.status = "COMPLETED";
      log(p, "fill", "Demo control: execution marked complete");
    });
  }, [updatePlan]);

  // Auto-poll every 3s while RUNNING. Paused state waits for an explicit Recheck.
  useEffect(() => {
    if (plan?.status !== "RUNNING") return;
    const id = setInterval(() => {
      step();
    }, 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.status, step]);

  return {
    screen,
    plan,
    capabilities,
    loading,
    error,
    recheckLoading,
    abortArmed,
    setAbortArmed,
    actions: { analyze, goToApproval, backToSetup, goTo, approve, recheck, abort, demoShock, completeDemo },
  };
}
