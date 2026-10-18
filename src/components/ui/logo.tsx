import { Vault } from "lucide-react";

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[10px] bg-volt-600 text-white shadow-[0_1px_0_rgba(255,255,255,0.22)_inset,0_8px_20px_-8px_rgba(112,72,245,0.95)]"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Vault style={{ width: size * 0.56, height: size * 0.56 }} strokeWidth={2} />
    </span>
  );
}

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="text-[17px] font-semibold tracking-[-0.02em] text-text">ManuVault</span>
    </span>
  );
}
