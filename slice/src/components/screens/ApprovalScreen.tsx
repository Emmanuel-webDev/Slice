import type { ExecutionPlan } from "@/lib/types/execution";
import { formatPercent, formatUsd } from "@/lib/format";
import { splitSymbol } from "@/lib/symbol";
import Button from "@/components/Button";

export default function ApprovalScreen({
  plan,
  onApprove,
  onCancel,
}: {
  plan: ExecutionPlan;
  onApprove: () => void;
  onCancel: () => void;
}) {
  const { intent } = plan;
  const { base } = splitSymbol(intent.symbol);
  const unit = intent.amountType === "QUOTE" ? "USDT" : base;

  const summary = [
    { label: "Order", value: `${intent.side === "BUY" ? "Buy" : "Sell"} ${base}` },
    { label: "Total order", value: `${formatUsd(intent.amount, intent.amountType === "QUOTE" ? 0 : 6)} ${unit}` },
    { label: "Window", value: `${intent.executionWindowMinutes} min` },
    { label: "Max slippage", value: formatPercent(intent.maxSlippagePercent, 2) },
    { label: "Planned impact", value: formatPercent(plan.estimatedSlippagePercent, 2) },
  ];

  return (
    <div className="screen-enter w-full">
      <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-quiet">Review plan</p>
      <p className="mt-1 text-[15px] text-muted">No execution starts until you approve it.</p>

      {plan.mode === "DEMO" && (
        <div className="mt-5 rounded-[var(--radius-control)] border border-blue bg-blue-soft px-4 py-3 text-[13px] font-medium text-blue-dark">
          Plan only — execution requires confirmation in the MCP client
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-[var(--radius-panel)] border border-line bg-paper p-6">
          <h2 className="text-[16px] font-semibold text-ink">Trade summary</h2>
          <dl className="mt-4 grid grid-cols-2 gap-y-4 sm:grid-cols-3">
            {summary.map((row) => (
              <div key={row.label}>
                <dt className="text-[11px] uppercase tracking-[0.1em] text-quiet">{row.label}</dt>
                <dd className="tabular mt-1 text-[18px] font-medium text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 border-t border-line pt-5">
            <h3 className="text-[14px] font-medium text-muted">Slice breakdown</h3>
            <ul className="mt-3 flex flex-col gap-2">
              {plan.slices.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-[var(--radius-control)] bg-paper-2 px-4 py-3"
                >
                  <span className="text-[14px] text-muted">Slice {s.number}</span>
                  <span className="tabular text-[15px] font-medium text-ink">
                    {formatUsd(s.amount, intent.amountType === "QUOTE" ? 0 : 6)} {unit}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="h-fit rounded-[var(--radius-panel)] border border-line bg-paper p-6">
          <h2 className="text-[16px] font-semibold text-ink">Decision record</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {plan.reasoning.slice(0, 3).map((line, i) => (
              <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-muted">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-coral" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onApprove}>Approve execution</Button>
      </div>
    </div>
  );
}
