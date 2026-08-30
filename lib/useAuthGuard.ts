"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthGuardResult {
  session: Session | null;
  loading: boolean;
}

/**
 * Single auth gate for every /dashboard and /admin page — sessions live in
 * localStorage (see lib/supabase.ts), not cookies, so there's no
 * server-side/middleware check (see proxy.ts); each page used to run its
 * own ad hoc getSession()/onAuthStateChange logic instead, and they
 * disagreed with each other: some hard-redirected via window.location on
 * SIGNED_OUT (a full page reload, felt jarring mid-task), most silently
 * left a broken-looking page with no redirect at all.
 *
 * This is a soft router.push instead — still a real redirect (a lost
 * session is a lost session; there's nothing to recover once localStorage
 * is actually cleared, e.g. a browser's "clear cache and cookies" action or
 * Safari ITP sweeping old site data), but it doesn't tear down the whole
 * page in the process.
 *
 * Also proactively re-checks the session when the tab becomes visible
 * again — supabase-js pauses its auto-refresh timer while backgrounded, so
 * a phone that sat locked for a while (a host or door-staff scanner mid-
 * event) would otherwise only discover its token had gone stale when the
 * next real action failed, instead of before.
 */
export function useAuthGuard(): AuthGuardResult {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const redirectedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const redirectToLogin = () => {
      if (redirectedRef.current) return;
      redirectedRef.current = true;
      router.push("/login");
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (!session) redirectToLogin();
      else setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      if (event === "SIGNED_OUT") {
        setSession(null);
        redirectToLogin();
      } else if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        setSession(newSession);
      }
    });

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!mounted) return;
        if (!session) redirectToLogin();
        else setSession(session);
      });
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return { session, loading };
}
