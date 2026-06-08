"use client";

import { useCallback, useMemo } from "react";
import { ConvexReactClient, ConvexProviderWithAuth } from "convex/react";
import { authClient } from "@/lib/auth-client";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Bridges Better Auth's session to Convex: supplies the JWT (from the `jwt`
// plugin's /api/auth/token) so Convex functions can verify identity via
// ctx.auth. When there is no session, fetchAccessToken returns null and the
// Convex client is simply unauthenticated (same as before) — additive change.
function useBetterAuthForConvex() {
  const { data, isPending } = authClient.useSession();

  const fetchAccessToken = useCallback(
    async () => {
      try {
        const res = await fetch("/api/auth/token", { credentials: "include" });
        if (!res.ok) return null;
        const json = (await res.json()) as { token?: string };
        return json.token ?? null;
      } catch {
        return null;
      }
    },
    []
  );

  return useMemo(
    () => ({
      isLoading: isPending,
      isAuthenticated: !!data?.user,
      fetchAccessToken,
    }),
    [isPending, data?.user, fetchAccessToken]
  );
}

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useBetterAuthForConvex}>
      {children}
    </ConvexProviderWithAuth>
  );
}
