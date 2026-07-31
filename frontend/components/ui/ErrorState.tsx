import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({
  message = "Could not load data. Check your connection or backend.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
      {/* Icon */}
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shadow-lg shadow-red-500/5">
        <AlertTriangle className="w-8 h-8 text-red-400" />
      </div>

      {/* Text */}
      <div className="max-w-xs">
        <p className="text-white font-semibold text-lg mb-2">Failed to load data</p>
        <p className="text-slate-400 text-sm leading-relaxed">{message}</p>
      </div>

      {/* Retry */}
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10
            text-slate-300 hover:text-white text-sm font-medium
            transition-all duration-200 border border-white/10 hover:border-white/20"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      )}
    </div>
  );
}
