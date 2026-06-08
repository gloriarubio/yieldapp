"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";

// Holds /app rendering until the Convex client has authenticated, so no query
// runs before the JWT is set. This is what lets the data functions derive the
// user from ctx.auth (requireUserId) without hitting a "not authenticated"
// race on page load. Unauthenticated visitors are sent to /sign-in.
export function ConvexAuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/sign-in");
  }, [isLoading, isAuthenticated, router]);

  if (!isAuthenticated) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
        }}
      >
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "var(--accent)",
            animation: "pulse 1.4s ease-in-out infinite",
          }}
        />
      </div>
    );
  }

  return <>{children}</>;
}
