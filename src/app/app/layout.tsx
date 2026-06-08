import { Sidebar } from "@/components/app/Sidebar";
import { AppHeader } from "@/components/app/AppHeader";
import { AiPanel } from "@/components/app/AiPanel";
import { MonthProvider } from "@/components/app/MonthContext";
import { OnboardingGuard } from "@/components/app/OnboardingGuard";
import { NewMerchantsBanner } from "@/components/app/NewMerchantsBanner";
import { ConvexAuthGate } from "@/components/app/ConvexAuthGate";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    // Gate: no /app content (and so no Convex query) renders until the Convex
    // client is authenticated — lets data functions trust ctx.auth without a race.
    <ConvexAuthGate>
      <MonthProvider>
        {/* Sends users that haven't completed onboarding to /onboarding */}
        <OnboardingGuard />
        <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
          <Sidebar />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            <AppHeader />
            <NewMerchantsBanner />
            <main style={{ flex: 1, padding: 28, overflowY: "auto" }}>
              {children}
            </main>
          </div>
          <AiPanel />
        </div>
      </MonthProvider>
    </ConvexAuthGate>
  );
}
