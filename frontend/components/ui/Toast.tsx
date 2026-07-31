"use client";

import { useToast } from "@/lib/toast-context";
import { X, CheckCircle2, XCircle, Info } from "lucide-react";

const iconMap = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const styleMap = {
  success: {
    wrapper: "border-emerald-500/30 bg-[#0d1f17]",
    icon: "text-emerald-400",
    bar: "bg-emerald-500",
  },
  error: {
    wrapper: "border-red-500/30 bg-[#1f0d0d]",
    icon: "text-red-400",
    bar: "bg-red-500",
  },
  info: {
    wrapper: "border-blue-500/30 bg-[#0d1324]",
    icon: "text-blue-400",
    bar: "bg-blue-500",
  },
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => {
        const Icon = iconMap[toast.type];
        const s = styleMap[toast.type];

        return (
          <div
            key={toast.id}
            className={`relative flex items-start gap-3 px-4 py-3 rounded-xl border
              backdrop-blur-md shadow-2xl pointer-events-auto animate-fade-in-up
              min-w-[280px] max-w-[380px] overflow-hidden ${s.wrapper}`}
          >
            {/* Progress bar */}
            <div
              className={`absolute bottom-0 left-0 h-[2px] ${s.bar} opacity-60`}
              style={{ animation: "toast-drain 4s linear forwards" }}
            />
            <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${s.icon}`} />
            <span className="text-sm text-white flex-1 leading-relaxed">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-500 hover:text-white transition-colors flex-shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
