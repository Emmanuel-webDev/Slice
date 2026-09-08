export function formatUsd(n: number, decimals = 2): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatCompactUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function formatPercent(n: number, decimals = 2): string {
  return `${n.toFixed(decimals)}%`;
}

export function formatTime(t: number): string {
  return new Date(t).toLocaleTimeString("en-US", { hour12: false });
}
