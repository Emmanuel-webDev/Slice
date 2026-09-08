import type { Screen } from "@/hooks/usePlanEngine";
import type { Capabilities } from "@/lib/types/execution";

function NavLink({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`text-[14px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "text-coral" : "text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

export default function TopBar({
  screen,
  hasPlan,
  capabilities,
  onOverview,
  onNewExecution,
}: {
  screen: Screen;
  hasPlan: boolean;
  capabilities: Capabilities;
  onOverview: () => void;
  onNewExecution: () => void;
}) {
  return (
    <header className="flex h-[58px] shrink-0 items-center justify-between border-b border-line bg-canvas px-4 sm:px-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-lemon text-[15px] font-bold text-ink">
          S
        </span>
        <div className="leading-tight">
          <p className="text-[16px] font-semibold text-ink">Slice</p>
          <p className="hidden text-[9px] font-semibold uppercase tracking-[0.14em] text-quiet sm:block">
            Execution control
          </p>
        </div>
      </div>

      <nav className="hidden items-center gap-7 md:flex">
        <NavLink label="Overview" active={screen === "MONITOR" || (!hasPlan && screen === "SETUP")} onClick={onOverview} />
        <NavLink label="New execution" active={screen === "SETUP" && hasPlan !== false} onClick={onNewExecution} />
        <NavLink label="Activity" disabled />
        <NavLink label="Guardrails" disabled />
      </nav>

      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-2 rounded-full border border-line bg-paper px-3.5 py-1.5 text-[12px] font-medium text-muted sm:inline-flex">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${capabilities.trading ? "bg-mint" : "bg-mint"}`} />
          Binance Agent OS connected
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-white">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
            <path d="M4 20c0-3.6 3.6-6 8-6s8 2.4 8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
      </div>
    </header>
  );
}
