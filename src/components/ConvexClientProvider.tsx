"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ConvexReactClient, ConvexProviderWithAuth } from "convex/react";
import { authClient } from "@/lib/auth-client";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Bridges Better Auth's session to Convex: supplies the JWT (from the `jwt`
// plugin's /api/auth/token) so Convex functions can verify identity via
// ctx.auth. When there is no session, fetchAccessToken returns null and the
// Convex client is simply unauthenticated (same as before) — additive change.
//
// Uses getSession() in an effect (not the reactive useSession() hook) so it is
// SSR-safe: useSession relies on a nanostore hook that breaks during static
// prerendering ("Cannot read properties of null (reading 'useRef')").
function useBetterAuthForConvex() {
  const [auth, setAuth] = useState({ isLoading: true, isAuthenticated: false });

  useEffect(() => {
    let active = true;
    authClient.getSession().then(({ data }) => {
      if (active) setAuth({ isLoading: false, isAuthenticated: !!data?.user });
    });
    return () => {
      active = false;
    };
  }, []);

  const fetchAccessToken = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/token", { credentials: "include" });
      if (!res.ok) return null;
      const json = (await res.json()) as { token?: string };
      return json.token ?? null;
    } catch {
      return null;
    }
  }, []);

  return useMemo(
    () => ({ ...auth, fetchAccessToken }),
    [auth, fetchAccessToken]
  );
}

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useBetterAuthForConvex}>
      {children}
    </ConvexProviderWithAuth>
  );
}
