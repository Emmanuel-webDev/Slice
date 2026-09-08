import { useEffect, useRef } from "react";
import type { ActivityEntry, ExecutionPlan, SliceStatus } from "@/lib/types/execution";
import { executedAmount, remainingAmount } from "@/lib/execution/constraints";
import { formatPercent, formatTime, formatUsd } from "@/lib/format";
import { splitSymbol } from "@/lib/symbol";
import Button from "@/components/Button";
import { StatusBadge, planStatusTone } from "@/components/StatusBadge";

const DECISION_LABEL: Record<string, string> = {
  CONTINUE: "Continue",
  PAUSE: "Pause",
  REPLAN: "Replan",
  ABORT: "Abort",
};

const STRATEGY_LABEL: Record<string, string> = {
  IMMEDIATE: "immediate fill",
  SPLIT: "adaptive split",
  WAIT: "holding for depth",
  ABORT: "aborted",
};

const MONITOR_HEADLINE: Record<string, string> = {
  RUNNING: "Slice is in control",
  PAUSED: "Slice hit the brakes",
  RESUMING: "Conditions recovered",
  COMPLETED: "Order closed cleanly",
  ABORTED: "Execution aborted",
};

const ACTIVITY_DOT: Record<ActivityEntry["kind"], string> = {
  info: "bg-quiet",
  decision: "bg-coral",
  fill: "bg-mint",
  warn: "bg-lemon",
  error: "bg-coral-dark",
};

function sliceLabel(status: SliceStatus, isNext: boolean): string {
  switch (status) {
    case "FILLED":
      return "Filled";
    case "EXECUTING":
      return "Submitting";
    case "CHECKING":
      return "Checking";
    case "PAUSED":
      return "Waiting";
    case "CANCELLED":
      return "Cancelled";
    case "FAILED":
      return "Failed";
    default:
      return isNext ? "Waiting" : "Pending";
  }
}

function sliceTone(status: SliceStatus): string {
  switch (status) {
    case "FILLED":
      return "bg-mint-soft text-mint-dark";
    case "EXECUTING":
    case "CHECKING":
      return "bg-coral-soft text-coral-dark";
    case "PAUSED":
      return "bg-lemon-2 text-lemon-ink";
    case "CANCELLED":
    case "FAILED":
      return "bg-paper-2 text-quiet";
    default:
      return "bg-paper-2 text-muted";
  }
}

/** Headline + explanation for the lemon Agent decision panel. */
function decisionCopy(plan: ExecutionPlan): { headline: string; explanation: string } {
  const next = plan.slices.find((s) => s.status !== "FILLED" && s.status !== "CANCELLED");
  switch (plan.status) {
    case "PAUSED":
      return {
        headline: "Hold — the book moved against you.",
        explanation: next?.note ?? "Current conditions exceed your execution threshold.",
      };
    case "RESUMING":
      return {
        headline: "Conditions recovered.",
        explanation: `Slice ${next?.number ?? ""} is entering at the refreshed threshold.`.trim(),
      };
    case "COMPLETED":
      return {
        headline: "Plan complete.",
        explanation: "Every slice cleared your slippage limit before it filled.",
      };
    case "ABORTED":
      return {
        headline: "Execution aborted.",
        explanation: "The remaining amount was not submitted.",
      };
    default:
      return {
        headline: plan.nextDecisionNote ?? "Watching the book.",
        explanation:
          plan.reasoning[plan.reasoning.length - 1] ?? "Slice re-checks the market before every order.",
      };
  }
}

export default function MonitorScreen({
  plan,
  recheckLoading,
  abortArmed,
  onRecheck,
  onAbort,
  onArmAbort,
  onDisarmAbort,
  onDemoShock,
  onCompleteDemo,
  agentDriven = false,
}: {
  plan: ExecutionPlan;
  recheckLoading: boolean;
  abortArmed: boolean;
  onRecheck: () => void;
  onAbort: () => void;
  onArmAbort: () => void;
  onDisarmAbort: () => void;
  onDemoShock: () => void;
  onCompleteDemo?: () => void;
  /** True when an MCP-connected agent is driving this plan, not this tab's own engine. */
  agentDriven?: boolean;
}) {
  const { intent } = plan;
  const { base } = splitSymbol(intent.symbol);
  const unit = intent.amountType === "QUOTE" ? "USDT" : base;

  const executed = executedAmount(plan);
  const remaining = remainingAmount(plan);
  const progressPct = Math.min(100, Math.round((executed / intent.amount) * 100));
  const badge = planStatusTone(plan.status);
  const decision = decisionCopy(plan);

  const nextIndex = plan.slices.findIndex((s) => s.status !== "FILLED" && s.status !== "CANCELLED");

  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [plan.activity.length]);

  const active = plan.status === "RUNNING" || plan.status === "PAUSED" || plan.status === "RESUMING";

  return (
    <div className="screen-enter w-full">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Execution monitor */}
        <div className="rounded-[var(--radius-panel)] border border-line bg-paper p-6 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-quiet">Execution monitor</p>
            <StatusBadge label={badge.label} tone={badge.tone} />
          </div>
          <h2 className="mt-1.5 text-[22px] font-semibold text-ink">{MONITOR_HEADLINE[plan.status] ?? "Slice is in control"}</h2>
          <p className="text-[13px] text-muted">
            {STRATEGY_LABEL[plan.strategy] ?? plan.strategy.toLowerCase()}, live execution
          </p>

          <p className="tabular mt-6 text-[44px] font-semibold leading-none text-ink">
            {formatUsd(executed, intent.amountType === "QUOTE" ? 0 : 6)}
            <span className="text-[20px] font-medium text-quiet"> of {formatUsd(intent.amount, intent.amountType === "QUOTE" ? 0 : 6)}</span>
          </p>

          <div className="mt-5 grid grid-cols-3 gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.1em] text-quiet">Remaining</p>
              <p className="tabular mt-1 text-[15px] font-medium text-ink">
                {formatUsd(remaining, intent.amountType === "QUOTE" ? 0 : 6)} {unit}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.1em] text-quiet">Max slippage</p>
              <p className="tabular mt-1 text-[15px] font-medium text-ink">
                {formatPercent(intent.maxSlippagePercent, 2)}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.1em] text-quiet">Est. impact</p>
              <p className="tabular mt-1 text-[15px] font-medium text-ink">
                {formatPercent(plan.estimatedSlippagePercent, 2)}
              </p>
            </div>
          </div>

          <div className="mt-6 border-t border-line pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-muted">
                <span className="tabular font-semibold text-ink">{progressPct}%</span> executed
              </p>
              {active && (
                <button
                  type="button"
                  onClick={onDemoShock}
                  className="rounded-[var(--radius-control)] bg-coral px-4 py-2 text-[13px] font-medium text-white shadow-[0_2px_0_var(--color-coral-dark)] transition-transform hover:-translate-y-px active:translate-y-0"
                >
                  Simulate market change ↗
                </button>
              )}
            </div>
            <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-paper-2">
              <div
                className="h-full rounded-full bg-coral transition-[width] duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Agent decision */}
        <div className="rounded-[var(--radius-panel)] bg-lemon p-6 sm:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink/55">Agent decision</p>
          <h2 className="mt-1.5 text-[21px] font-semibold leading-snug text-ink">{decision.headline}</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-ink/70">{decision.explanation}</p>

          <ul className="mt-5 flex flex-col gap-3.5">
            {plan.slices.map((s, i) => (
              <li key={s.id} className="flex items-start gap-3">
                <span className="tabular mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink/10 text-[11px] font-semibold text-ink">
                  {String(s.number).padStart(2, "0")}
                </span>
                <div>
                  <p className="text-[14px] font-semibold text-ink">{sliceLabel(s.status, i === nextIndex)}</p>
                  <p className="text-[13px] text-ink/65">
                    {s.status === "FILLED"
                      ? `${formatUsd(s.amount, intent.amountType === "QUOTE" ? 0 : 6)} ${unit}${
                          s.estimatedSlippagePercent !== undefined
                            ? ` at ${formatPercent(s.estimatedSlippagePercent, 2)} impact`
                            : ""
                        }`
                      : i === nextIndex
                        ? (s.note ?? "Re-checking depth before submit")
                        : `${formatUsd(s.amount, intent.amountType === "QUOTE" ? 0 : 6)} ${unit} reserved`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Pause banner */}
      {plan.status === "PAUSED" && (
        <div className="mt-6 rounded-[var(--radius-panel)] border border-line bg-lemon-2 p-6">
          <h2 className="text-[17px] font-semibold text-lemon-ink">The agent hit the brakes.</h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-lemon-ink/85">
            Market conditions changed. Current conditions exceed your execution threshold. Slice has paused
            the next order.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-4 sm:max-w-md">
            <div>
              <p className="text-[11px] uppercase tracking-[0.1em] text-lemon-ink/60">Spread before</p>
              <p className="tabular mt-1 text-[16px] font-medium text-lemon-ink">
                {formatPercent(plan.lastHealthySpreadPercent ?? plan.market.spreadPercent, 3)}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.1em] text-lemon-ink/60">Spread now</p>
              <p className="tabular mt-1 text-[16px] font-medium text-coral-dark">
                {formatPercent(plan.market.spreadPercent, 3)}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.1em] text-lemon-ink/60">Your limit</p>
              <p className="tabular mt-1 text-[16px] font-medium text-lemon-ink">
                {formatPercent(intent.maxSlippagePercent, 2)}
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={onRecheck} loading={recheckLoading} loadingLabel="Checking market">
              Recheck market
            </Button>
            {abortArmed ? (
              <Button variant="destructive" onClick={onAbort} onBlur={onDisarmAbort}>
                Confirm abort
              </Button>
            ) : (
              <Button variant="secondary" onClick={onArmAbort}>
                Abort execution
              </Button>
            )}
          </div>
        </div>
      )}

      {plan.status === "RESUMING" && (
        <div className="mt-6 rounded-[var(--radius-panel)] border border-blue bg-blue-soft p-5">
          <p className="text-[14px] font-medium text-blue-dark">
            Conditions recovered. Entering the next slice at the refreshed threshold.
          </p>
        </div>
      )}

      {plan.status === "COMPLETED" && (
        <div className="mt-6 rounded-[var(--radius-panel)] border border-mint bg-mint-soft p-6">
          <h2 className="text-[17px] font-semibold text-mint-dark">Order closed cleanly.</h2>
          <p className="mt-1.5 text-[14px] text-mint-dark/90">
            Slice completed the plan after rechecking conditions between each order.{" "}
            {formatUsd(executed, intent.amountType === "QUOTE" ? 0 : 6)} {unit} executed across{" "}
            {plan.slices.length} slice{plan.slices.length > 1 ? "s" : ""}, {formatPercent(plan.estimatedSlippagePercent, 2)}{" "}
            realized impact.
          </p>
          <ul className="mt-3 flex flex-col gap-1.5">
            <li className="text-[13px] text-mint-dark/90">✓ Book re-checked before every slice</li>
            <li className="text-[13px] text-mint-dark/90">✓ No fill exceeded your slippage limit</li>
            <li className="text-[13px] text-mint-dark/90">
              ✓ Completed within your {intent.executionWindowMinutes}-minute window
            </li>
          </ul>
        </div>
      )}

      {plan.status === "ABORTED" && (
        <div className="mt-6 rounded-[var(--radius-panel)] border border-line-strong bg-paper-2 p-6">
          <h2 className="text-[17px] font-semibold text-ink">Execution aborted</h2>
          <p className="mt-1.5 text-[14px] text-muted">
            {formatUsd(executed, intent.amountType === "QUOTE" ? 0 : 6)} {unit} executed. The remaining{" "}
            {formatUsd(remaining, intent.amountType === "QUOTE" ? 0 : 6)} {unit} was not submitted.
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Slice timeline */}
        <div className="rounded-[var(--radius-panel)] border border-line bg-paper p-6">
          <h2 className="text-[16px] font-semibold text-ink">Slice timeline</h2>
          <ul className="mt-4 flex flex-col divide-y divide-line">
            {plan.slices.map((s, i) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <span
                    className={`tabular flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold ${
                      s.status === "FILLED"
                        ? "bg-mint text-white"
                        : i === nextIndex
                          ? "bg-coral text-white"
                          : "bg-paper-2 text-quiet"
                    }`}
                  >
                    {s.status === "FILLED" ? "✓" : s.number}
                  </span>
                  <div>
                    <p className="text-[14px] font-medium text-ink">
                      {formatUsd(s.amount, intent.amountType === "QUOTE" ? 0 : 6)} {unit}
                    </p>
                    {s.status === "FILLED" && s.averageFillPrice ? (
                      <p className="tabular text-[12px] text-quiet">
                        filled @ {s.averageFillPrice.toFixed(4)}
                        {s.estimatedSlippagePercent !== undefined &&
                          ` · ${formatPercent(s.estimatedSlippagePercent, 3)} slippage`}
                      </p>
                    ) : s.note ? (
                      <p className="text-[12px] text-quiet">{s.note}</p>
                    ) : null}
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-[12px] font-medium ${sliceTone(s.status)}`}>
                  {sliceLabel(s.status, i === nextIndex)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          <div className="rounded-[var(--radius-panel)] border border-line bg-paper p-6">
            <h2 className="text-[16px] font-semibold text-ink">Market</h2>
            <dl className="mt-4 grid grid-cols-2 gap-y-4">
              <div>
                <dt className="text-[11px] uppercase tracking-[0.1em] text-quiet">Spread</dt>
                <dd className="tabular mt-1 text-[16px] font-medium text-ink">
                  {formatPercent(plan.market.spreadPercent, 3)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.1em] text-quiet">Liquidity</dt>
                <dd className="text-[16px] font-medium text-ink">{plan.liquidity}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[11px] uppercase tracking-[0.1em] text-quiet">Data source</dt>
                <dd
                  className={`mt-1 text-[13px] font-medium ${plan.market.source.includes("Agent OS") ? "text-mint-dark" : "text-ink"}`}
                >
                  {plan.market.source}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[11px] uppercase tracking-[0.1em] text-quiet">Current decision</dt>
                <dd className="mt-1 text-[16px] font-medium text-ink">
                  {plan.status === "COMPLETED"
                    ? "Complete"
                    : plan.status === "ABORTED"
                      ? "Abort"
                      : plan.status === "PAUSED"
                        ? "Pause"
                        : plan.status === "RESUMING"
                          ? "Continue"
                          : plan.lastDecision
                            ? DECISION_LABEL[plan.lastDecision]
                            : "Continue"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-[var(--radius-panel)] border border-line bg-paper p-6">
            <h2 className="text-[16px] font-semibold text-ink">Activity</h2>
            <div ref={logRef} className="mt-4 flex max-h-72 flex-col gap-3 overflow-y-auto pr-1">
              {plan.activity.map((entry, i) => (
                <div key={i} className="flex gap-2.5 text-[13px]">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${ACTIVITY_DOT[entry.kind]}`} />
                  <div className="min-w-0">
                    <p className="leading-snug text-muted">{entry.message}</p>
                    <p className="tabular text-[11px] text-quiet">{formatTime(entry.t)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {active && !agentDriven && onCompleteDemo && (
        <div className="mt-6 flex items-center justify-between border-t border-line pt-6">
          <button
            type="button"
            onClick={onCompleteDemo}
            className="text-[12px] font-medium text-quiet hover:text-muted"
          >
            Demo control: complete demo
          </button>
          {plan.status !== "PAUSED" &&
            (abortArmed ? (
              <Button variant="destructive" onClick={onAbort} onBlur={onDisarmAbort}>
                Confirm abort
              </Button>
            ) : (
              <Button variant="secondary" onClick={onArmAbort}>
                Abort execution
              </Button>
            ))}
        </div>
      )}

      {active && agentDriven && plan.status !== "PAUSED" && (
        <div className="mt-6 flex justify-end border-t border-line pt-6">
          {abortArmed ? (
            <Button variant="destructive" onClick={onAbort} onBlur={onDisarmAbort}>
              Confirm abort
            </Button>
          ) : (
            <Button variant="secondary" onClick={onArmAbort}>
              Abort execution
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
