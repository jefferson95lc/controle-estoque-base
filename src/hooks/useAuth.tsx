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

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      // Trata refresh token inválido sem travar a UI
      if (event === "TOKEN_REFRESHED" && !s) {
        setSession(null);
        setUser(null);
        setIsMaster(false);
        return;
      }
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(async () => {
          const { data } = await supabase.rpc("has_role", {
            _user_id: s.user.id, _role: "master",
          });
          if (mounted) setIsMaster(!!data);
        }, 0);
      } else {
        setIsMaster(false);
      }
    });

    supabase.auth.getSession()
      .then(async ({ data: { session: s }, error }) => {
        if (!mounted) return;
        if (error) {
          // Sessão corrompida / refresh token inválido — limpa storage
          try { await supabase.auth.signOut(); } catch {}
          setSession(null);
          setUser(null);
          setIsMaster(false);
          setLoading(false);
          return;
        }
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          const { data } = await supabase.rpc("has_role", {
            _user_id: s.user.id, _role: "master",
          });
          if (mounted) setIsMaster(!!data);
        }
        setLoading(false);
      })
      .catch(async () => {
        try { await supabase.auth.signOut(); } catch {}
        if (!mounted) return;
        setSession(null);
        setUser(null);
        setIsMaster(false);
        setLoading(false);
      });

    return () => {
      mounted = false;
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
