import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./authz";

// Used by the client guard to decide between /onboarding and the app.
// IDOR fix: the userId is the verified session subject (the optional `userId`
// arg is accepted for backward compat but ignored).
export const getOnboardingStatus = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db
      .query("user")
      .withIndex("by_auth_id", (q) => q.eq("id", userId))
      .unique();

    return {
      exists: user !== null,
      onboardingCompleted: user?.onboardingCompleted === true,
    };
  },
});
