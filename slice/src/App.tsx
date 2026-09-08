import { useState } from "react";
import { usePlanEngine, type Screen, type SetupInput } from "@/hooks/usePlanEngine";
import TopBar from "@/components/TopBar";
import Rail from "@/components/Rail";
import SetupScreen from "@/components/screens/SetupScreen";
import AnalysisScreen from "@/components/screens/AnalysisScreen";
import ApprovalScreen from "@/components/screens/ApprovalScreen";
import MonitorScreen from "@/components/screens/MonitorScreen";
import AgentSessionView from "@/components/screens/AgentSessionView";

const agentPlanId = new URLSearchParams(window.location.search).get("plan");

const DEFAULT_SETUP: SetupInput = {
  side: "BUY",
  symbol: "BNBUSDT",
  amount: 500,
  amountType: "QUOTE",
  executionWindowMinutes: 15,
  maxSlippagePercent: 0.2,
};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const TODAY = new Date().toLocaleDateString("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

export default function App() {
  const [setupInput, setSetupInput] = useState<SetupInput>(DEFAULT_SETUP);
  const {
    screen,
    plan,
    capabilities,
    loading,
    error,
    recheckLoading,
    abortArmed,
    setAbortArmed,
    actions,
  } = usePlanEngine();

  const handleNavigate = (target: Screen) => actions.goTo(target);

  if (agentPlanId) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-canvas">
        <TopBar
          screen="MONITOR"
          hasPlan
          capabilities={capabilities}
          onOverview={() => {}}
          onNewExecution={() => {}}
        />
        <main className="flex-1 p-4 sm:p-6">
          <AgentSessionView planId={agentPlanId} />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-canvas">
      <TopBar
        screen={screen}
        hasPlan={!!plan}
        capabilities={capabilities}
        onOverview={() => (plan ? handleNavigate("MONITOR") : handleNavigate("SETUP"))}
        onNewExecution={actions.backToSetup}
      />

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-[22px] p-3.5 sm:flex-row sm:p-6">
        <Rail plan={plan} capabilities={capabilities} onNewExecution={actions.backToSetup} />

        <main className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-quiet">{TODAY}</p>
              <h1 className="mt-1 text-[32px] font-semibold leading-[1.05] tracking-tight text-ink sm:text-[44px]">
                {greeting()}
              </h1>
            </div>
            <div className="max-w-xs text-right">
              <p className="text-[13px] leading-relaxed text-muted">
                Set the constraint. Slice manages the entry, watches the market, and knows when to wait.
              </p>
              {plan && screen !== "MONITOR" && (
                <button
                  type="button"
                  onClick={() => handleNavigate("MONITOR")}
                  className="mt-2 text-[13px] font-medium text-coral hover:underline"
                >
                  Back to live run ↗
                </button>
              )}
            </div>
          </div>

          <div className="mt-6">
            {screen === "SETUP" && (
              <SetupScreen
                value={setupInput}
                onChange={(patch) => setSetupInput((prev) => ({ ...prev, ...patch }))}
                onSubmit={() => actions.analyze(setupInput)}
                loading={loading}
                error={error}
              />
            )}

            {screen === "ANALYSIS" && plan && (
              <AnalysisScreen plan={plan} onReview={actions.goToApproval} onBack={actions.backToSetup} />
            )}

            {screen === "APPROVAL" && plan && (
              <ApprovalScreen plan={plan} onApprove={actions.approve} onCancel={actions.backToSetup} />
            )}

            {screen === "MONITOR" && plan && (
              <MonitorScreen
                plan={plan}
                recheckLoading={recheckLoading}
                abortArmed={abortArmed}
                onRecheck={actions.recheck}
                onAbort={actions.abort}
                onArmAbort={() => setAbortArmed(true)}
                onDisarmAbort={() => setAbortArmed(false)}
                onDemoShock={actions.demoShock}
                onCompleteDemo={actions.completeDemo}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
