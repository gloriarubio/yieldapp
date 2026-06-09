"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { authClient } from "@/lib/auth-client";

// Redirects authenticated users that haven't completed onboarding to /onboarding.
// TODO(spec): the spec suggested adding this to the auth middleware, but this
// project has no Next.js middleware — auth is checked client-side with
// authClient.getSession() (see dashboard/extractos pages), so the guard
// follows that same pattern. It's mounted in the /app layout, which covers
// every app route; /onboarding and /(auth) routes are outside it.
export function OnboardingGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    authClient.getSession().then(({ data }) => setUserId(data?.user?.id ?? null));
  }, []);

  const status = useQuery(
    api.users.getOnboardingStatus,
    userId ? {} : "skip"
  );

  useEffect(() => {
    if (!userId || status === undefined) return;
    if (!status.onboardingCompleted && !pathname.startsWith("/onboarding")) {
      router.replace("/onboarding");
    }
  }, [userId, status, pathname, router]);

  return null;
}
