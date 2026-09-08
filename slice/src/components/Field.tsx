import type { ReactNode } from "react";

export default function Field({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="text-[12px] text-quiet">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "min-h-11 rounded-[var(--radius-control)] border border-line bg-paper px-3.5 text-[15px] text-ink outline-none placeholder:text-quiet focus:border-blue focus:ring-3 focus:ring-blue-soft";
