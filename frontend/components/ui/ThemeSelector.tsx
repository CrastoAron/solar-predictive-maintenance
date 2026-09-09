"use client";

import { useTheme } from "@/lib/theme-context";
import { Sun, Moon, Monitor } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const OPTIONS = [
  { value: "light" as const, label: "Light", icon: Sun },
  { value: "dark" as const, label: "Dark", icon: Moon },
  { value: "system" as const, label: "System", icon: Monitor },
];

export default function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const current = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[1];
  const Icon = current.icon;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150"
        style={{ border: "1px solid var(--border)", background: "var(--card)", color: "var(--text-secondary)" }}
        title="Change theme"
      >
        <Icon className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{current.label}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 min-w-[120px] rounded-xl overflow-hidden shadow-2xl z-50 animate-fade-in"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          {OPTIONS.map(({ value, label, icon: ItemIcon }) => (
            <button
              key={value}
              onClick={() => { setTheme(value); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors"
              style={{
                color: theme === value ? "var(--accent)" : "var(--text-secondary)",
                background: theme === value ? "var(--accent-bg)" : "transparent",
              }}
            >
              <ItemIcon className="w-3.5 h-3.5 flex-shrink-0" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
