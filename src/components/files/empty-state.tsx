import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  large = false,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
  large?: boolean;
}) {
  return (
    <div
      className={`mx-auto flex max-w-md animate-rise flex-col items-center text-center ${large ? "py-16 sm:py-24" : "py-14"}`}
    >
      <span className="relative mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-ink-600 bg-ink-800 text-volt-300 shadow-card">
        <Icon className="h-7 w-7" strokeWidth={1.7} aria-hidden />
      </span>
      <h2 className="text-lg font-semibold tracking-[-0.015em]">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">{description}</p>
      {children && <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">{children}</div>}
    </div>
  );
}
