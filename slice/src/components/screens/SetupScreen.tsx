import type { SetupInput } from "@/hooks/usePlanEngine";
import Button from "@/components/Button";
import Field, { inputClass } from "@/components/Field";
import { splitSymbol } from "@/lib/symbol";

const PAIRS = ["BNBUSDT", "BTCUSDT", "ETHUSDT", "SOLUSDT"];

export default function SetupScreen({
  value,
  onChange,
  onSubmit,
  loading,
  error,
}: {
  value: SetupInput;
  onChange: (patch: Partial<SetupInput>) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
}) {
  const { base, quote } = splitSymbol(value.symbol);

  return (
    <div className="screen-enter grid w-full gap-6 lg:grid-cols-[1fr_280px]">
      <div className="rounded-[var(--radius-panel)] border border-line bg-paper p-6 sm:p-8">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-quiet">New execution</p>
        <h2 className="mt-1 text-[22px] font-semibold text-ink">Set the boundary. Leave the timing to Slice.</h2>

        <form
          className="mt-7 grid gap-5 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-[13px] font-medium text-muted">Side</span>
            <div className="grid grid-cols-2 gap-2">
              {(["BUY", "SELL"] as const).map((side) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => onChange({ side })}
                  className={`min-h-11 rounded-[var(--radius-control)] border text-[14px] font-medium transition-colors ${
                    value.side === side
                      ? "border-coral bg-coral-soft text-coral-dark"
                      : "border-line bg-paper text-muted hover:bg-paper-2"
                  }`}
                >
                  {side === "BUY" ? "Buy" : "Sell"}
                </button>
              ))}
            </div>
          </div>

          <Field label="Trading pair" htmlFor="symbol">
            <select
              id="symbol"
              className={`${inputClass} w-full`}
              value={value.symbol}
              onChange={(e) => onChange({ symbol: e.target.value })}
            >
              {PAIRS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Amount" htmlFor="amount">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="tabular pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-quiet">
                  {value.amountType === "QUOTE" ? "$" : ""}
                </span>
                <input
                  id="amount"
                  type="number"
                  min={0}
                  step="any"
                  className={`${inputClass} tabular w-full ${value.amountType === "QUOTE" ? "pl-7" : ""}`}
                  value={value.amount}
                  onChange={(e) => onChange({ amount: Number(e.target.value) })}
                />
              </div>
              <select
                className={`${inputClass} w-28 shrink-0`}
                value={value.amountType}
                onChange={(e) => onChange({ amountType: e.target.value as "QUOTE" | "BASE" })}
              >
                <option value="QUOTE">{quote || "quote"}</option>
                <option value="BASE">{base || "base"}</option>
              </select>
            </div>
          </Field>

          <Field label="Execution window" htmlFor="window" hint="Minutes Slice has to complete the order">
            <div className="relative">
              <input
                id="window"
                type="number"
                min={1}
                className={`${inputClass} tabular w-full pr-14`}
                value={value.executionWindowMinutes}
                onChange={(e) => onChange({ executionWindowMinutes: Number(e.target.value) })}
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-quiet">
                min
              </span>
            </div>
          </Field>

          <Field label="Max slippage" htmlFor="slippage" hint="Slice pauses rather than exceed this">
            <div className="relative">
              <input
                id="slippage"
                type="number"
                min={0}
                step="0.01"
                className={`${inputClass} tabular w-full pr-9`}
                value={value.maxSlippagePercent}
                onChange={(e) => onChange({ maxSlippagePercent: Number(e.target.value) })}
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-quiet">
                %
              </span>
            </div>
          </Field>

          {error && (
            <p className="rounded-[var(--radius-control)] bg-coral-soft px-3.5 py-2.5 text-[13px] text-coral-dark sm:col-span-2">
              {error}
            </p>
          )}

          <div className="sm:col-span-2">
            <Button type="submit" loading={loading} loadingLabel="Checking the book">
              Analyze execution
            </Button>
          </div>
        </form>
      </div>

      <aside className="h-fit rounded-[var(--radius-panel)] border border-line bg-paper-2 p-6">
        <p className="text-[15px] font-medium leading-snug text-ink">
          Slice optimizes execution, not trade selection.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          You set what to trade and the boundaries that matter — window, slippage. Slice re-checks the
          live book before every slice and holds when conditions turn against you.
        </p>
      </aside>
    </div>
  );
}
