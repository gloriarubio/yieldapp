import { query } from "./_generated/server";
import { v } from "convex/values";

// Used by the client guard to decide between /onboarding and the app.
// Follows the project convention of passing the Better Auth userId from
// the client (same as transactions/statements queries).
export const getOnboardingStatus = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("user")
      .withIndex("by_auth_id", (q) => q.eq("id", args.userId))
      .unique();

    return {
      exists: user !== null,
      onboardingCompleted: user?.onboardingCompleted === true,
    };
  },
});
