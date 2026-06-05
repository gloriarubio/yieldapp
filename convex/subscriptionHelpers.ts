// Pure helpers shared by subscriptions.ts (V8), stripeActions.ts ("use node")
// and apiKeys.ts. No Convex function registrations here.

// Statuses that grant Pro access. "past_due" keeps access during Stripe's
// retry/dunning window; access is cut when Stripe moves it to canceled/unpaid.
export const PRO_STATUSES = new Set(["active", "trialing", "past_due"]);

export function subscriptionIsPro(
  sub: { plan: string; status?: string } | null
): boolean {
  return !!sub && sub.plan === "pro" && PRO_STATUSES.has(sub.status ?? "");
}
