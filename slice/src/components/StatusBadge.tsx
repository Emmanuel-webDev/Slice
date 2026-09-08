type Tone = "mint" | "lemon" | "blue" | "coral" | "muted";

const TONES: Record<Tone, { dot: string; bg: string; text: string }> = {
  mint: { dot: "bg-mint", bg: "bg-mint-soft", text: "text-mint-dark" },
  lemon: { dot: "bg-lemon", bg: "bg-lemon-2", text: "text-lemon-ink" },
  blue: { dot: "bg-blue", bg: "bg-blue-soft", text: "text-blue-dark" },
  coral: { dot: "bg-coral", bg: "bg-coral-soft", text: "text-coral-dark" },
  muted: { dot: "bg-quiet", bg: "bg-paper-2", text: "text-muted" },
};

export function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  const t = TONES[tone];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full ${t.bg} ${t.text} px-3 py-1.5 text-[13px] font-medium`}
    >
      <span className={`h-2 w-2 rounded-full ${t.dot}`} />
      {label}
    </span>
  );
}

export function planStatusTone(status: string): { label: string; tone: Tone } {
  switch (status) {
    case "RUNNING":
      return { label: "Running", tone: "mint" };
    case "PAUSED":
      return { label: "Paused", tone: "lemon" };
    case "RESUMING":
      return { label: "Resuming", tone: "blue" };
    case "COMPLETED":
      return { label: "Complete", tone: "mint" };
    case "ABORTED":
      return { label: "Aborted", tone: "muted" };
    default:
      return { label: status, tone: "muted" };
  }
}
