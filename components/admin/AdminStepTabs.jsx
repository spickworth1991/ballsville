"use client";

import React from "react";

/**
 * Admin step tabs.
 * steps: Array<{ key: string; label: string; done?: boolean }>
 */
export default function AdminStepTabs({ steps = [], activeKey, onChange }) {
  const safeSteps = Array.isArray(steps) ? steps : [];
  if (!safeSteps.length) return null;

  return (
    <div className="rounded-2xl border border-subtle bg-card-surface shadow-sm backdrop-blur">
      <div className="flex flex-wrap gap-2 p-3">
        {safeSteps.map((s) => {
          const key = String(s?.key || "");
          const isActive = key === activeKey;
          const done = Boolean(s?.done);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange && onChange(key)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold tracking-[0.15em] uppercase transition \
                ${
                  isActive
                    ? "bg-accent/15 border-accent/40 text-foreground"
                    : "bg-panel/40 border-subtle text-muted hover:border-accent/30 hover:text-foreground"
                }`}
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] leading-none \
                  ${done ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100" : "border-subtle bg-panel text-muted"}`}
                aria-hidden="true"
              >
                {done ? "✓" : ""}
              </span>
              <span className="whitespace-nowrap">{String(s?.label || "")}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
