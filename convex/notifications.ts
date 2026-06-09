import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./authz";

// Creates (or merges into) the unread "new_merchants" notification shown as a
// banner in the dashboard after a monthly upload finds unclassified merchants.
export const createNewMerchantsNotification = internalMutation({
  args: {
    userId: v.string(),
    merchantPatterns: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.merchantPatterns.length === 0) return null;

    // Merge with an existing unread notification instead of stacking banners
    const existing = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", args.userId).eq("read", false))
      .take(10);
    const sameType = existing.find((n) => n.type === "new_merchants");

    if (sameType) {
      const merged = [...new Set([...sameType.merchantPatterns, ...args.merchantPatterns])];
      await ctx.db.patch(sameType._id, {
        merchantPatterns: merged,
        createdAt: Date.now(),
      });
      return sameType._id;
    }

    return await ctx.db.insert("notifications", {
      userId: args.userId,
      type: "new_merchants",
      merchantPatterns: args.merchantPatterns,
      createdAt: Date.now(),
      read: false,
    });
  },
});

export const getUnreadNotifications = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", userId).eq("read", false))
      .take(20);
  },
});

export const markNotificationRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.userId !== userId) return null; // not yours
    await ctx.db.patch(args.notificationId, { read: true });
    return null;
  },
});
