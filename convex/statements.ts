import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";

const insightValidator = v.object({
  type: v.union(v.literal("warning"), v.literal("trend"), v.literal("suggestion")),
  text: v.string(),
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const createStatement = internalMutation({
  args: {
    userId: v.string(),
    // Absent for API-pushed JSON imports (fileType "api")
    storageId: v.optional(v.id("_storage")),
    filename: v.string(),
    fileType: v.union(
      v.literal("pdf"),
      v.literal("csv"),
      v.literal("excel"),
      v.literal("api")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("statements", {
      userId: args.userId,
      storageId: args.storageId,
      filename: args.filename,
      fileType: args.fileType,
      status: "processing",
      uploadedAt: Date.now(),
    });
  },
});

export const updateStatementStatus = internalMutation({
  args: {
    statementId: v.id("statements"),
    status: v.union(v.literal("processing"), v.literal("done"), v.literal("error")),
    transactionCount: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = { status: args.status };
    if (args.transactionCount !== undefined) patch.transactionCount = args.transactionCount;
    if (args.errorMessage !== undefined) patch.errorMessage = args.errorMessage;
    if (args.status !== "processing") {
      patch.processedAt = Date.now();
      patch.progress = undefined; // clear live progress once finished
    }
    await ctx.db.patch(args.statementId, patch);
  },
});

export const updateStatementProgress = internalMutation({
  args: {
    statementId: v.id("statements"),
    progress: v.object({
      phase: v.union(v.literal("extracting"), v.literal("categorizing")),
      extracted: v.optional(v.number()),
      categorized: v.optional(v.number()),
      total: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.statementId, { progress: args.progress });
  },
});

export const getStatementById = query({
  args: { statementId: v.id("statements") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.statementId);
  },
});

export const updateInsights = internalMutation({
  args: {
    statementId: v.id("statements"),
    insights: v.array(insightValidator),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.statementId, { insights: args.insights });
  },
});

export const listStatements = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("statements")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(50);
  },
});
