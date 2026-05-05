import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  isMaster: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isMaster, setIsMaster] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const clearSupabaseStorage = () => {
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith("sb-") || k.includes("supabase.auth"))
          .forEach((k) => localStorage.removeItem(k));
      } catch {}
    };

    const finishLoading = () => {
      if (mounted) setLoading(false);
    };

    // Failsafe: nunca deixar a UI presa em "Carregando..."
    const safety = setTimeout(finishLoading, 4000);

    const applySession = async (s: Session | null) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        try {
          const { data } = await supabase.rpc("has_role", {
            _user_id: s.user.id,
            _role: "master",
          });
          if (mounted) setIsMaster(!!data);
        } catch {
          if (mounted) setIsMaster(false);
        }
      } else {
        setIsMaster(false);
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      if (
        (event === "TOKEN_REFRESHED" && !s) ||
        event === "SIGNED_OUT"
      ) {
        clearSupabaseStorage();
        setSession(null);
        setUser(null);
        setIsMaster(false);
        finishLoading();
        return;
      }
      // Não usar await direto aqui (evita deadlock no listener)
      setTimeout(() => {
        applySession(s).finally(finishLoading);
      }, 0);
    });

    supabase.auth
      .getSession()
      .then(async ({ data: { session: s }, error }) => {
        if (!mounted) return;
        if (error) {
          clearSupabaseStorage();
          try {
            await supabase.auth.signOut();
          } catch {}
          setSession(null);
          setUser(null);
          setIsMaster(false);
          finishLoading();
          return;
        }
        await applySession(s);
        finishLoading();
      })
      .catch(async () => {
        clearSupabaseStorage();
        try {
          await supabase.auth.signOut();
        } catch {}
        if (!mounted) return;
        setSession(null);
        setUser(null);
        setIsMaster(false);
        finishLoading();
      });

    return () => {
      mounted = false;
      clearTimeout(safety);
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider value={{ user, session, isMaster, loading, signIn, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
