import type { ExecutionPlan } from "@/lib/types/execution";
import { liquidityWithinBand } from "@/lib/execution/liquidity";
import { formatCompactUsd, formatPercent, formatUsd } from "@/lib/format";
import Button from "@/components/Button";

const LIQUIDITY_TONE: Record<string, string> = {
  HIGH: "bg-mint-soft text-mint-dark",
  MEDIUM: "bg-lemon-2 text-lemon-ink",
  LOW: "bg-coral-soft text-coral-dark",
};

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-line bg-paper p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-quiet">{label}</p>
      <p className="tabular mt-2 text-[26px] font-semibold text-ink">{value}</p>
      {note && <p className="mt-1 text-[12px] text-muted">{note}</p>}
    </div>
  );
}

export default function AnalysisScreen({
  plan,
  onReview,
  onBack,
}: {
  plan: ExecutionPlan;
  onReview: () => void;
  onBack: () => void;
}) {
  const { market, fullOrderEstimate, intent } = plan;
  const liquidityUsd = liquidityWithinBand(market, 1);
  const withinLimit = fullOrderEstimate.slippagePercent <= intent.maxSlippagePercent;

  return (
    <div className="screen-enter w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-quiet">Market analysis</p>
          <p className="mt-1 text-[15px] text-muted">
            {intent.side === "BUY" ? "Buy" : "Sell"} {formatUsd(intent.amount, intent.amountType === "QUOTE" ? 2 : 6)}{" "}
            {intent.amountType === "QUOTE" ? "USDT of" : ""} {intent.symbol} · source {market.source}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-[13px] font-medium ${LIQUIDITY_TONE[plan.liquidity]}`}>
          {plan.liquidity} liquidity
        </span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Current price" value={`$${formatUsd(market.midPrice, market.midPrice >= 100 ? 2 : 4)}`} />
        <Metric label="Spread" value={formatPercent(market.spreadPercent, 3)} />
        <Metric label="Liquidity" value={formatCompactUsd(liquidityUsd)} note="within 1% of mid" />
        <Metric
          label="Immediate slippage"
          value={formatPercent(fullOrderEstimate.slippagePercent, 3)}
          note={withinLimit ? "within your limit" : "above your limit"}
        />
      </div>

      <div className="mt-6 rounded-[var(--radius-panel)] border border-line bg-paper p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[18px] font-semibold text-ink">Why Slice chose this plan</h2>
          <span className="tabular rounded-full bg-paper-2 px-3 py-1 text-[13px] font-medium text-ink">
            {plan.strategy}
          </span>
        </div>
        <ul className="mt-4 flex flex-col gap-2.5">
          {plan.reasoning.map((line, i) => (
            <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-muted">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-coral" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="secondary" onClick={onBack}>
          Start over
        </Button>
        <Button onClick={onReview}>Review plan</Button>
      </div>
    </div>
  );
}
