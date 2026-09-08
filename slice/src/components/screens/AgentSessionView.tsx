import { useAgentSession } from "@/hooks/useAgentSession";
import MonitorScreen from "@/components/screens/MonitorScreen";

/**
 * Observer view for a plan being driven by an MCP-connected agent session
 * (Claude Code + slice + binance-mcp-server) rather than this tab's own
 * client-side engine. Reached via ?plan=<id>, as handed back by slice_plan's
 * monitorUrl. Polls the shared local sync server so this tab mirrors what
 * the agent is doing live.
 */
export default function AgentSessionView({ planId }: { planId: string }) {
  const { plan, error, recheckLoading, abortArmed, setAbortArmed, actions } = useAgentSession(planId);

  if (error && !plan) {
    return (
      <div className="screen-enter mx-auto w-full max-w-2xl">
        <h1 className="text-[24px] font-semibold text-ink">Waiting for the agent session</h1>
        <p className="mt-2 text-[14px] text-muted">{error}</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="screen-enter mx-auto w-full max-w-2xl">
        <p className="text-[14px] text-muted">Loading plan {planId}…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="rounded-[var(--radius-control)] border border-blue bg-blue-soft px-4 py-2.5 text-[13px] font-medium text-blue-dark">
        Agent OS session — this plan is being driven by an MCP-connected agent, not this browser tab.
      </div>
      {error && <p className="mt-2 text-[12px] text-coral-dark">{error}</p>}
      <div className="mt-6">
        <MonitorScreen
          plan={plan}
          recheckLoading={recheckLoading}
          abortArmed={abortArmed}
          onRecheck={actions.recheck}
          onAbort={actions.abort}
          onArmAbort={() => setAbortArmed(true)}
          onDisarmAbort={() => setAbortArmed(false)}
          onDemoShock={actions.demoShock}
          agentDriven
        />
      </div>
    </div>
  );
}
