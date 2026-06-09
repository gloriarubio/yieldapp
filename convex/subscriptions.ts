import { internalMutation, internalQuery, query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { subscriptionIsPro } from "./subscriptionHelpers";
import { requireUserId } from "./authz";

// Stripe subscription state per user. The webhook (convex/http.ts →
// stripeActions.processStripeWebhook) is the single writer; the UI and the
// plan gates only read.

async function getByUserId(ctx: QueryCtx, userId: string) {
  return await ctx.db
    .query("subscriptions")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export const getSubscription = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const sub = await getByUserId(ctx, userId);
    return {
      plan: subscriptionIsPro(sub) ? ("pro" as const) : ("free" as const),
      interval: sub?.interval ?? null,
      status: sub?.status ?? null,
      cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    };
  },
});

export const getSubscriptionInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await getByUserId(ctx, args.userId);
  },
});

// Email/name to prefill Stripe Checkout and the customer record
export const getUserInfoInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("user")
      .withIndex("by_auth_id", (q) => q.eq("id", args.userId))
      .unique();
    return user ? { email: user.email, name: user.name } : null;
  },
});

// Free plan: full experience for the first upload(s) — the onboarding — and
// read-only afterwards ("datos accesibles pero sin nuevas subidas").
// Pro: unlimited recurring uploads.
export const checkCanUpload = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const sub = await getByUserId(ctx, args.userId);
    if (subscriptionIsPro(sub)) return { allowed: true as const };

    const user = await ctx.db
      .query("user")
      .withIndex("by_auth_id", (q) => q.eq("id", args.userId))
      .unique();

    // Until onboarding is finished the user is still on their first upload
    if (user?.onboardingCompleted !== true) return { allowed: true as const };

    return {
      allowed: false as const,
      reason:
        "El plan Free incluye una única subida inicial. Pasa a Pro para subir extractos cada mes.",
    };
  },
});

// ─── Writes (webhook only) ───────────────────────────────────────────────────

export const upsertSubscription = internalMutation({
  args: {
    userId: v.optional(v.string()), // present on checkout.session.completed
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.optional(v.string()),
    plan: v.union(v.literal("free"), v.literal("pro")),
    interval: v.optional(v.union(v.literal("month"), v.literal("year"))),
    status: v.optional(v.string()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    currentPeriodEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Subscription lifecycle events only carry the customer id — resolve the
    // row through it when userId is absent
    const existing = args.userId
      ? await ctx.db
          .query("subscriptions")
          .withIndex("by_userId", (q) => q.eq("userId", args.userId as string))
          .unique()
      : await ctx.db
          .query("subscriptions")
          .withIndex("by_customerId", (q) =>
            q.eq("stripeCustomerId", args.stripeCustomerId)
          )
          .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        stripeCustomerId: args.stripeCustomerId,
        stripeSubscriptionId: args.stripeSubscriptionId,
        plan: args.plan,
        interval: args.interval,
        status: args.status,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd,
        currentPeriodEnd: args.currentPeriodEnd,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    if (!args.userId) {
      // Lifecycle event for a customer we never saw — nothing to update
      console.warn(`Stripe webhook: unknown customer ${args.stripeCustomerId}`);
      return null;
    }

    return await ctx.db.insert("subscriptions", {
      userId: args.userId,
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      plan: args.plan,
      interval: args.interval,
      status: args.status,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      currentPeriodEnd: args.currentPeriodEnd,
      updatedAt: Date.now(),
    });
  },
});

// Stores the customer id as soon as Checkout starts so portal/checkout reuse it
export const rememberStripeCustomer = internalMutation({
  args: { userId: v.string(), stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (existing) {
      if (existing.stripeCustomerId !== args.stripeCustomerId) {
        await ctx.db.patch(existing._id, {
          stripeCustomerId: args.stripeCustomerId,
          updatedAt: Date.now(),
        });
      }
      return existing._id;
    }
    return await ctx.db.insert("subscriptions", {
      userId: args.userId,
      stripeCustomerId: args.stripeCustomerId,
      plan: "free",
      updatedAt: Date.now(),
    });
  },
});
