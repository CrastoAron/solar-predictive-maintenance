"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Sun } from "lucide-react";
import { useEffect } from "react";

export default function LoginPage() {
  const { user, signInWithGoogle } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  const handleSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sign-in failed. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-500/5 rounded-full blur-3xl" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      {/* Grid dots */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="glass-card p-10 flex flex-col items-center text-center shadow-2xl">
          {/* Logo */}
          <div className="w-16 h-16 rounded-2xl bg-orange-500 flex items-center justify-center shadow-xl shadow-orange-500/40 mb-6">
            <Sun className="w-9 h-9 text-white" />
          </div>

          <h1 className="text-2xl font-bold text-white mb-1">SolarShield</h1>
          <p className="text-slate-400 text-sm mb-2">Predictive Maintenance Dashboard</p>
          <div className="w-12 h-px bg-gradient-to-r from-transparent via-orange-500/60 to-transparent mb-8" />

          <p className="text-slate-300 text-sm mb-8">
            Sign in to monitor your solar panel health, view live metrics, and receive
            AI-powered maintenance predictions.
          </p>

          {/* Google Sign in */}
          <button
            onClick={handleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl bg-white text-gray-700 font-semibold text-sm hover:bg-gray-50 active:bg-gray-100 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            {loading ? "Signing in…" : "Sign in with Google"}
          </button>

          {error && (
            <div className="mt-4 w-full px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-left">
              {error}
            </div>
          )}

          <p className="mt-8 text-slate-500 text-xs">
            By signing in you agree to our terms of service.
          </p>
        </div>
      </div>
    </div>
  );
}
