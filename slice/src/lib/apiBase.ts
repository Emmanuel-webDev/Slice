// The local Slice sync server (server/index.ts), shared between this browser
// tab and any MCP session driving the same plan. Vite-only env access, guarded
// so this file can't be accidentally pulled into a non-Vite context.
const raw =
  (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_SLICE_API_BASE ?? "http://localhost:8791";

// Render's render.yaml links this to the backend service via `fromService`,
// which resolves to a bare hostname (no scheme) — add one so it's a usable
// fetch base URL. A value that already has a scheme passes through untouched.
export const API_BASE = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
