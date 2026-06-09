import { internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./authz";

const insightValidator = v.object({
  type: v.union(v.literal("warning"), v.literal("trend"), v.literal("suggestion")),
  text: v.string(),
});

export const getMonthInsights = query({
  args: { month: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    return await ctx.db
      .query("monthlyInsights")
      .withIndex("by_user_month", (q) =>
        q.eq("userId", userId).eq("month", args.month)
      )
      .unique();
  },
});

// Internal variant for the public HTTP API (API-key auth, trusted userId).
export const getMonthInsightsInternal = internalQuery({
  args: { userId: v.string(), month: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("monthlyInsights")
      .withIndex("by_user_month", (q) =>
        q.eq("userId", args.userId).eq("month", args.month)
      )
      .unique();
  },
});

export const saveMonthInsights = internalMutation({
  args: {
    userId: v.string(),
    month: v.string(),
    insights: v.array(insightValidator),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("monthlyInsights")
      .withIndex("by_user_month", (q) =>
        q.eq("userId", args.userId).eq("month", args.month)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        insights: args.insights,
        generatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("monthlyInsights", {
      userId: args.userId,
      month: args.month,
      generatedAt: Date.now(),
      insights: args.insights,
    });
  },
});
