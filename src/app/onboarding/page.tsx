"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

// Initial categorization wizard. Only for authenticated users; if onboarding
// is already completed it redirects straight to the dashboard.
export default function OnboardingPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      setUserId(data?.user?.id ?? null);
    });
  }, []);

  // Not authenticated → sign in
  useEffect(() => {
    if (userId === null) router.replace("/sign-in");
  }, [userId, router]);

  const status = useQuery(
    api.users.getOnboardingStatus,
    userId ? {} : "skip"
  );

  // Already onboarded → dashboard
  useEffect(() => {
    if (status?.onboardingCompleted) router.replace("/app/dashboard");
  }, [status, router]);

  const loading = userId === undefined || (userId && status === undefined) || status?.onboardingCompleted;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Minimal header */}
      <header style={{ height: 60, display: "flex", alignItems: "center", padding: "0 28px", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.3px", color: "var(--text)", fontFamily: "var(--font-playfair), Georgia, serif" }}>
          Yield
        </span>
      </header>

      <main style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px 80px" }}>
        {loading ? (
          <div style={{ color: "var(--text3)", fontSize: 13, padding: 20 }}>Cargando…</div>
        ) : (
          <OnboardingWizard userId={userId!} />
        )}
      </main>
    </div>
  );
}
