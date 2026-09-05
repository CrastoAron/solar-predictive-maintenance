"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import { supabase } from "./supabase";
import { API_BASE, apiHeaders } from "./api-config";
import { useRouter } from "next/navigation";

const REDIRECT_TARGET_KEY = "auth-redirect-target";

const persistRedirectTarget = (target: "admin" | "customer" | null) => {
  if (typeof window === "undefined") {
    return;
  }

  if (!target) {
    window.sessionStorage.removeItem(REDIRECT_TARGET_KEY);
    return;
  }

  window.sessionStorage.setItem(REDIRECT_TARGET_KEY, target);
};

interface AuthContextType {
  user: { uid: string; email?: string | null; photoURL?: string | null; displayName?: string | null } | null;
  role: string;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string, targetRole?: "admin" | "customer") => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: "customer",
  loading: true,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ uid: string; email?: string | null; photoURL?: string | null; displayName?: string | null } | null>(null);
  const [role, setRole] = useState("customer");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const resolveRole = async (firebaseUser: FirebaseUser | null) => {
    if (!firebaseUser) {
      setUser(null);
      setRole("customer");
      persistRedirectTarget("customer");
      return;
    }

    const preferredTarget =
      typeof window !== "undefined"
        ? window.sessionStorage.getItem(REDIRECT_TARGET_KEY)
        : null;

    if (preferredTarget === "admin") {
      setRole("admin");
      router.replace("/admin/dashboard");
      return;
    }

    try {
      const token = await firebaseUser.getIdToken();
      localStorage.setItem("firebase-token", token);
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: apiHeaders(token),
      });

      if (response.ok) {
        const payload = (await response.json()) as { role?: string };
        const nextRole = (payload.role || "customer").toLowerCase();
        setRole(nextRole);
        persistRedirectTarget(nextRole === "admin" ? "admin" : "customer");
        router.replace(nextRole === "admin" ? "/admin/dashboard" : "/dashboard");
        return;
      }
    } catch {
      // Ignore and fall back to customer.
    }

    setRole("customer");
    persistRedirectTarget("customer");
    router.replace("/dashboard");
  };

  useEffect(() => {
    const unsubscribeFirebase = auth
      ? onAuthStateChanged(auth, (firebaseUser) => {
          if (firebaseUser) {
            setUser(firebaseUser);
            setLoading(false);
            void resolveRole(firebaseUser);
          } else if (!supabase) {
            setUser(null);
            setLoading(false);
          }
        })
      : () => {};

    const supabaseSubscription = supabase?.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ uid: session.user.id, email: session.user.email });
        setRole("admin");
        setLoading(false);
      } else if (!auth?.currentUser) {
        setUser(null);
        setRole("customer");
        setLoading(false);
      }
    });

    return () => {
      unsubscribeFirebase();
      supabaseSubscription?.data.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    if (!auth) {
      throw new Error(
        "Firebase is not initialized. Please ensure your .env.local file contains valid Firebase credentials."
      );
    }

    const result = await signInWithPopup(auth, googleProvider);
    const token = await result.user.getIdToken();
    localStorage.setItem("firebase-token", token);
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: apiHeaders(token),
    });

    if (!response.ok) {
      throw new Error("Unable to resolve your account role.");
    }

    setRole("customer");
    persistRedirectTarget("customer");
    router.replace("/dashboard");
  };

  const signInWithEmail = async (email: string, password: string, targetRole: "admin" | "customer" = "customer") => {
    if (!supabase) {
      throw new Error(
        "Supabase is not initialized. Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      throw new Error(error?.message || "Admin sign-in failed.");
    }

    localStorage.setItem("admin-token", data.session.access_token);
    setUser({ uid: data.user.id, email: data.user.email });
    setRole("admin");
    persistRedirectTarget(targetRole);
    router.replace("/admin/dashboard");
  };

  const signOut = async () => {
    setUser(null);
    setRole("customer");
    localStorage.removeItem("firebase-token");
    localStorage.removeItem("admin-token");
    persistRedirectTarget(null);
    if (auth) {
      await firebaseSignOut(auth);
    }
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading SolarShield…</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, role, loading, signInWithGoogle, signInWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
