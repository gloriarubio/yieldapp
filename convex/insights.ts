import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

const insightValidator = v.object({
  type: v.union(v.literal("warning"), v.literal("trend"), v.literal("suggestion")),
  text: v.string(),
});

export const getMonthInsights = query({
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
