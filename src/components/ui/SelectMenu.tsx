// FILE: src/components/ui/SelectMenu.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export type SelectMenuOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export function SelectMenu(props: {
  value: string;
  onChange: (next: string) => void;
  options: SelectMenuOption[];
  disabled?: boolean;

  placeholder?: string;
  title?: string;
  className?: string;
}) {
  const { value, onChange, options, disabled, placeholder = "Select…", title = "Select", className } = props;

  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(() => options.find((o) => o.value === value) || null, [options, value]);

  useEffect(() => {
    if (!open) return;

    const idx = Math.max(
      0,
      options.findIndex((o) => o.value === value)
    );
    setActiveIdx(idx);

    // focus the panel so keyboard works immediately
    setTimeout(() => panelRef.current?.focus(), 0);
  }, [open, options, value]);

  function close() {
    setOpen(false);
  }

  function selectByIndex(idx: number) {
    const opt = options[idx];
    if (!opt || opt.disabled) return;
    onChange(opt.value);
    close();
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={cn(
          "w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-left",
          "outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-300 disabled:opacity-50",
          className
        )}
      >
        <span className={cn(!selected ? "text-gray-400" : "text-gray-900")}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="float-right text-gray-400">▾</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
            onClick={close}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              "absolute bottom-0 left-0 right-0 md:bottom-auto md:left-1/2 md:top-1/2 md:right-auto md:-translate-x-1/2 md:-translate-y-1/2",
              "bg-white border border-gray-200 md:rounded-3xl rounded-t-3xl shadow-xl",
              "w-full md:w-[420px] max-h-[70vh] overflow-hidden"
            )}
          >
            <div className="p-4 border-b border-gray-200">
              <p className="text-sm font-semibold text-gray-900">{title}</p>
              <p className="text-[11px] text-gray-500 mt-1">Use ↑/↓ then Enter. Esc to close.</p>
            </div>

            <div
              ref={panelRef}
              tabIndex={0}
              className="p-2 overflow-y-auto max-h-[60vh] outline-none"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  close();
                  return;
                }
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveIdx((i) => Math.min(options.length - 1, i + 1));
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveIdx((i) => Math.max(0, i - 1));
                  return;
                }
                if (e.key === "Home") {
                  e.preventDefault();
                  setActiveIdx(0);
                  return;
                }
                if (e.key === "End") {
                  e.preventDefault();
                  setActiveIdx(options.length - 1);
                  return;
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  selectByIndex(activeIdx);
                }
              }}
            >
              <div role="listbox" aria-label={title}>
                {options.map((opt, idx) => {
                  const isSelected = opt.value === value;
                  const isActive = idx === activeIdx;

                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={opt.disabled}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => selectByIndex(idx)}
                      className={cn(
                        "w-full text-left px-3 py-3 rounded-2xl text-sm",
                        opt.disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-50",
                        isActive && "bg-gray-50",
                        isSelected && "font-semibold text-orange-700"
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-3 border-t border-gray-200">
              <button
                type="button"
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                onClick={close}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}