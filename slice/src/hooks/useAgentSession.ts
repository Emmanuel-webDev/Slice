import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "@/lib/apiBase";
import type { ExecutionPlan } from "@/lib/types/execution";

/**
 * Read-mostly view of a plan being driven by an MCP-connected agent session
 * (Claude Code + slice + binance-mcp-server), polling the shared local sync
 * server so this tab shows the same plan the agent is working. Manual
 * recheck/abort/demo-shock still work here — they hit the same server, so a
 * demo shock triggered from the browser is visible to the agent's next
 * slice_next_slice call, and vice versa.
 */
export function useAgentSession(planId: string) {
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recheckLoading, setRecheckLoading] = useState(false);
  const [abortArmed, setAbortArmed] = useState(false);

  const call = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      const res = await fetch(`${API_BASE}/api/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, action, ...extra }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? `Slice server request failed (${res.status})`);
      return json;
    },
    [planId]
  );

  const poll = useCallback(async () => {
    try {
      const { plan } = await call("STATUS");
      setPlan(plan);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Could not reach the Slice server at ${API_BASE}. Is \`npm run server\` running?`
      );
    }
  }, [call]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [poll]);

  const recheck = useCallback(async () => {
    setRecheckLoading(true);
    try {
      const { plan } = await call("DECIDE");
      setPlan(plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recheck failed.");
    } finally {
      setRecheckLoading(false);
    }
  }, [call]);

  const abort = useCallback(async () => {
    try {
      const { plan } = await call("ABORT");
      setPlan(plan);
    } finally {
      setAbortArmed(false);
    }
  }, [call]);

  const demoShock = useCallback(async () => {
    await call("DEMO_SHOCK");
    await poll();
  }, [call, poll]);

  return { plan, error, recheckLoading, abortArmed, setAbortArmed, actions: { recheck, abort, demoShock } };
}
