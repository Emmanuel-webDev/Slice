import type { Capabilities, ExecutionPlan } from "@/lib/types/execution";
import { executedAmount } from "@/lib/execution/constraints";
import { formatUsd } from "@/lib/format";
import { splitSymbol } from "@/lib/symbol";
import Button from "@/components/Button";

const STRATEGY_LABEL: Record<string, string> = {
  IMMEDIATE: "immediate fill",
  SPLIT: "adaptive split",
  WAIT: "holding for depth",
  ABORT: "aborted",
};

const STATUS_COPY: Record<string, string> = {
  PLANNED: "Awaiting approval",
  RUNNING: "Agent watching the book",
  PAUSED: "Agent holding — book insufficient",
  RESUMING: "Agent resuming",
  COMPLETED: "Execution complete",
  ABORTED: "Execution aborted",
};

function ageLabel(timestamp: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 5) return "now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

export default function Rail({
  plan,
  capabilities,
  onNewExecution,
}: {
  plan: ExecutionPlan | null;
  capabilities: Capabilities;
  onNewExecution: () => void;
}) {
  const { base, quote } = plan ? splitSymbol(plan.intent.symbol) : { base: "", quote: "" };
  const executed = plan ? executedAmount(plan) : 0;
  const progressPct = plan ? Math.min(100, Math.round((executed / plan.intent.amount) * 100)) : 0;

  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 p-4 sm:w-[260px] md:w-[260px] lg:w-[260px]">
      <div className="rounded-[var(--radius-hero)] bg-ink p-6 text-white shadow-[0_16px_40px_-20px_rgba(0,0,0,0.5)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">Active execution</p>

        {plan ? (
          <>
            <p className="mt-3 text-[18px] font-semibold">
              {base} / {quote}
            </p>
            <p className="tabular mt-4 text-[36px] font-semibold leading-none">
              {formatUsd(plan.intent.amount, plan.intent.amountType === "QUOTE" ? 0 : 6)}
            </p>
            <p className="mt-1.5 text-[13px] text-white/55">
              {plan.intent.side === "BUY" ? "Buy" : "Sell"} order, {STRATEGY_LABEL[plan.strategy] ?? plan.strategy.toLowerCase()}
            </p>

            <div className="mt-5 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-[12px] font-medium text-white/80">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-mint" />
              {STATUS_COPY[plan.status] ?? plan.status}
            </div>

            <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-lemon transition-[width] duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 text-[18px] font-semibold">No active execution</p>
            <p className="mt-2 text-[13px] leading-relaxed text-white/55">
              Set the boundary and Slice will take it from here.
            </p>
          </>
        )}

        <Button variant="lemon" onClick={onNewExecution} className="mt-6 w-full">
          Set up new execution ↗
        </Button>
      </div>

      <div className="rounded-[var(--radius-panel)] border border-line bg-paper p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-ink">Connection</h2>
          <span className="h-2 w-2 rounded-full bg-mint" />
        </div>
        <dl className="mt-3 flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-[13px]">
            <dt className="text-quiet">Market data</dt>
            <dd className="font-medium text-ink">Live</dd>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <dt className="text-quiet">Trading</dt>
            <dd className="font-medium text-ink">{capabilities.trading ? "Ready" : "Plan only"}</dd>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <dt className="text-quiet">Last check</dt>
            <dd className="tabular font-medium text-ink">{plan ? ageLabel(plan.market.timestamp) : "—"}</dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}
