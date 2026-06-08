import { query } from "./_generated/server";
import type { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";

// Central authorization helpers for the IDOR remediation (SECURITY-IDOR-PLAN.md).
// Functions should derive the caller's id from the verified session via
// `requireUserId(ctx)` instead of trusting a client-supplied `userId`.

type AnyCtx = QueryCtx | MutationCtx | ActionCtx;

// Returns the authenticated user's id (Better Auth user id = JWT `sub`), or
// throws if the request is not authenticated.
export async function requireUserId(ctx: AnyCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("No autenticado");
  return identity.subject;
}

// Temporary verification endpoint: confirms Convex can read the Better Auth
// identity. Remove once the migration is validated.
export const whoami = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity
      ? { authenticated: true, subject: identity.subject, issuer: identity.issuer }
      : { authenticated: false };
  },
});
