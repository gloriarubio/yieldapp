import { ConvexAuthGate } from "@/components/app/ConvexAuthGate";

// Holds the onboarding wizard until the Convex client is authenticated, so its
// data functions (now using requireUserId) don't hit a page-load race.
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ConvexAuthGate>{children}</ConvexAuthGate>;
}
