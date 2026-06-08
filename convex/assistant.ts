import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";

// Persistence for the conversational assistant (/app/asistente). Pure
// queries/mutations (V8 runtime); the Claude call lives in assistantActions.ts.

const DEFAULT_TITLE = "Nueva conversación";

async function ownedConversation(
  ctx: QueryCtx,
  conversationId: import("./_generated/dataModel").Id<"assistant_conversations">,
  userId: string
) {
  const convo = await ctx.db.get(conversationId);
  if (!convo || convo.userId !== userId) return null;
  return convo;
}

// All conversations for the user, most recently updated first.
export const listConversations = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const convos = await ctx.db
      .query("assistant_conversations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return convos.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

// Messages of one conversation (ownership-checked), oldest first.
export const getMessages = query({
  args: {
    userId: v.string(),
    conversationId: v.id("assistant_conversations"),
  },
  handler: async (ctx, args) => {
    const convo = await ownedConversation(ctx, args.conversationId, args.userId);
    if (!convo) return [];
    return await ctx.db
      .query("assistant_messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();
  },
});

export const createConversation = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("assistant_conversations", {
      userId: args.userId,
      title: DEFAULT_TITLE,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Appends the user's message and, on the first message, derives the
// conversation title from it.
export const addUserMessage = mutation({
  args: {
    userId: v.string(),
    conversationId: v.id("assistant_conversations"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const convo = await ownedConversation(ctx, args.conversationId, args.userId);
    if (!convo) throw new Error("Conversación no encontrada.");
    const now = Date.now();
    await ctx.db.insert("assistant_messages", {
      conversationId: args.conversationId,
      userId: args.userId,
      role: "user",
      text: args.text,
      createdAt: now,
    });
    const patch: { updatedAt: number; title?: string } = { updatedAt: now };
    if (convo.title === DEFAULT_TITLE) {
      patch.title = args.text.slice(0, 48);
    }
    await ctx.db.patch(args.conversationId, patch);
  },
});

export const deleteConversation = mutation({
  args: {
    userId: v.string(),
    conversationId: v.id("assistant_conversations"),
  },
  handler: async (ctx, args) => {
    const convo = await ownedConversation(ctx, args.conversationId, args.userId);
    if (!convo) return;
    const msgs = await ctx.db
      .query("assistant_messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();
    for (const m of msgs) await ctx.db.delete(m._id);
    await ctx.db.delete(args.conversationId);
  },
});

// --- Internal helpers used by assistantActions.ask ---

export const getConversationInternal = internalQuery({
  args: { conversationId: v.id("assistant_conversations") },
  handler: async (ctx, args) => ctx.db.get(args.conversationId),
});

export const getMessagesInternal = internalQuery({
  args: { conversationId: v.id("assistant_conversations") },
  handler: async (ctx, args) =>
    ctx.db
      .query("assistant_messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect(),
});

export const addAssistantMessage = internalMutation({
  args: {
    conversationId: v.id("assistant_conversations"),
    userId: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("assistant_messages", {
      conversationId: args.conversationId,
      userId: args.userId,
      role: "assistant",
      text: args.text,
      createdAt: now,
    });
    await ctx.db.patch(args.conversationId, { updatedAt: now });
  },
});
