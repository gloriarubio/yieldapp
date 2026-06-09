import { internalMutation, internalQuery, mutation, query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./authz";

// Savings plan for /app/proyecciones — one document per user, autosaved by
// the page so the goal and the simulation survive sessions.

const planFields = {
  goalName: v.optional(v.string()),
  targetAmount: v.optional(v.number()),
  targetDate: v.optional(v.string()), // "YYYY-MM"
  categoryCuts: v.array(v.object({ category: v.string(), monthlyCut: v.number() })),
  cancelledSubscriptions: v.array(v.string()),
};

async function getByUserId(ctx: QueryCtx, userId: string) {
  return await ctx.db
    .query("projection_plans")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

export const getProjectionPlan = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return await getByUserId(ctx, userId);
  },
});

export const getProjectionPlanInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await getByUserId(ctx, args.userId);
  },
});

export const saveProjectionPlan = mutation({
  args: { ...planFields },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const fields = args;
    const existing = await getByUserId(ctx, userId);
    if (existing) {
      await ctx.db.patch(existing._id, { ...fields, updatedAt: Date.now() });
      return existing._id;
    }
    return await ctx.db.insert("projection_plans", {
      userId,
      ...fields,
      updatedAt: Date.now(),
    });
  },
});

// Called by the AI action to cache its verdict on the plan
export const saveAiVerdict = internalMutation({
  args: { userId: v.string(), text: v.string() },
  handler: async (ctx, args) => {
    const existing = await getByUserId(ctx, args.userId);
    const verdict = { text: args.text, generatedAt: Date.now() };
    if (existing) {
      await ctx.db.patch(existing._id, { aiVerdict: verdict, updatedAt: Date.now() });
      return existing._id;
    }
    return await ctx.db.insert("projection_plans", {
      userId: args.userId,
      categoryCuts: [],
      cancelledSubscriptions: [],
      aiVerdict: verdict,
      updatedAt: Date.now(),
    });
  },
});
