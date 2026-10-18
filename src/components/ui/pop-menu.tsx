"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";

export type MenuEntry =
  | {
      label: string;
      icon?: LucideIcon;
      onSelect: () => void;
      danger?: boolean;
      disabled?: boolean;
      hint?: string;
    }
  | "separator";

type PopMenuProps = {
  x: number;
  y: number;
  /** Aligne le bord droit du menu sur x (menus ouverts depuis un bouton à droite). */
  alignRight?: boolean;
  entries: MenuEntry[];
  onClose: () => void;
};

export function PopMenu({ x, y, alignRight, entries, onClose }: PopMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y, ready: false });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const margin = 8;
    let left = alignRight ? x - width : x;
    let top = y;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
    if (top + height > window.innerHeight - margin) top = Math.max(margin, y - height - 8);
    setPos({ left, top, ready: true });
  }, [x, y, alignRight]);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
    const down = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    const away = () => onClose();
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("keydown", key, true);
    window.addEventListener("resize", away);
    window.addEventListener("scroll", away, true);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("keydown", key, true);
      window.removeEventListener("resize", away);
      window.removeEventListener("scroll", away, true);
    };
  }, [onClose]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    let next = current;
    if (e.key === "ArrowDown") next = (current + 1) % items.length;
    if (e.key === "ArrowUp") next = (current - 1 + items.length) % items.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = items.length - 1;
    items[next].focus();
  };

  return createPortal(
    <div
      ref={ref}
      role="menu"
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
      className="menu fixed z-[70]"
      style={{ left: pos.left, top: pos.top, visibility: pos.ready ? "visible" : "hidden" }}
    >
      {entries.map((entry, i) =>
        entry === "separator" ? (
          <div key={`sep-${i}`} role="separator" className="my-1 h-px bg-ink-600" />
        ) : (
          <button
            key={entry.label}
            type="button"
            role="menuitem"
            disabled={entry.disabled}
            onClick={() => {
              onClose();
              entry.onSelect();
            }}
            className={`menu-item ${entry.danger ? "menu-item-danger" : ""} disabled:pointer-events-none disabled:opacity-40`}
          >
            {entry.icon && <entry.icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />}
            <span className="flex-1 truncate">{entry.label}</span>
            {entry.hint && <span className="text-xs text-text-faint">{entry.hint}</span>}
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}

type MenuTriggerProps = {
  entries: MenuEntry[];
  children: React.ReactNode;
  className?: string;
  ariaLabel: string;
  alignRight?: boolean;
  title?: string;
};

/** Bouton qui ouvre un menu juste en dessous de lui. */
export function MenuTrigger({ entries, children, className, ariaLabel, alignRight, title }: MenuTriggerProps) {
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        title={title}
        onClick={(e) => {
          e.stopPropagation();
          const r = e.currentTarget.getBoundingClientRect();
          setAnchor(anchor ? null : { x: alignRight ? r.right : r.left, y: r.bottom + 6 });
        }}
      >
        {children}
      </button>
      {anchor && (
        <PopMenu
          x={anchor.x}
          y={anchor.y}
          alignRight={alignRight}
          entries={entries}
          onClose={() => setAnchor(null)}
        />
      )}
    </>
  );
}
