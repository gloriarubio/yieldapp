import { internalMutation, internalQuery, mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { resolveMerchantCategories } from "../src/lib/categorization";

const transactionValidator = v.object({
  userId: v.string(),
  statementId: v.id("statements"),
  date: v.string(),
  description: v.string(),
  amount: v.number(),
  category: v.string(),
  merchant: v.optional(v.string()),
  type: v.union(v.literal("income"), v.literal("expense")),
  merchantPattern: v.optional(v.string()),
  categorySource: v.optional(
    v.union(v.literal("rule"), v.literal("ai"), v.literal("manual"))
  ),
});

export const insertTransactions = internalMutation({
  args: { transactions: v.array(transactionValidator) },
  handler: async (ctx, args) => {
    for (const tx of args.transactions) {
      await ctx.db.insert("transactions", tx);
    }
    return args.transactions.length;
  },
});

export const listTransactions = query({
  args: {
    userId: v.string(),
    statementId: v.optional(v.id("statements")),
  },
  handler: async (ctx, args) => {
    // 2000 covers a multi-month onboarding (the old 500 silently hid most of
    // the first uploaded file — it looked like only one file was processed).
    // TODO: paginate or filter by month server-side when volumes grow.
    if (args.statementId) {
      return await ctx.db
        .query("transactions")
        .withIndex("by_statementId", (q) => q.eq("statementId", args.statementId as Id<"statements">))
        .order("desc")
        .take(2000);
    }
    return await ctx.db
      .query("transactions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(2000);
  },
});

export const getTransactionsByMonth = internalQuery({
  args: { userId: v.string(), month: v.string() }, // month "YYYY-MM"
  handler: async (ctx, args) => {
    return await ctx.db
      .query("transactions")
      .withIndex("by_userId_and_date", (q) =>
        q
          .eq("userId", args.userId)
          .gte("date", `${args.month}-01`)
          .lte("date", `${args.month}-31`)
      )
      .take(2000);
  },
});

// Full history for the Free plan's whole-period analysis
export const getAllTransactionsInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("transactions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .take(4000);
  },
});

export const getOthersTransactions = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("transactions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .take(2000);
    return all.filter((t) => t.category === "Otros");
  },
});

// Detecta cargos recurrentes que no fueron identificados como suscripciones:
// mismo comercio en 2+ meses distintos, importe < 200€, variación < 20% → Suscripciones
export const detectRecurringSubscriptions = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("transactions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .take(2000);

    // Solo gastos no ingresos, no ya categorizados como suscripción
    const expenses = all.filter(
      (t) => t.amount < 0 && t.category !== "Suscripciones" && t.category !== "Ingresos"
    );

    // Agrupa por nombre de comercio normalizado
    type Entry = { id: Id<"transactions">; amount: number; month: string };
    const groups = new Map<string, Entry[]>();
    for (const tx of expenses) {
      const key = (tx.merchant || tx.description)
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 60); // normaliza espacios y recorta para evitar variaciones menores
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({
        id: tx._id,
        amount: Math.abs(tx.amount),
        month: tx.date.slice(0, 7),
      });
    }

    const toUpdate: Id<"transactions">[] = [];

    for (const [, entries] of groups) {
      const months = new Set(entries.map((e) => e.month));
      if (months.size < 2) continue; // debe aparecer en al menos 2 meses

      const amounts = entries.map((e) => e.amount);
      const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;

      if (avg > 200) continue; // importes altos no son suscripciones (alquiler, seguros grandes…)

      const maxDev = Math.max(...amounts.map((a) => Math.abs(a - avg)));
      if (maxDev > avg * 0.2) continue; // variación > 20%: no es cargo fijo recurrente

      for (const e of entries) toUpdate.push(e.id);
    }

    for (const id of toUpdate) {
      await ctx.db.patch(id, { category: "Suscripciones" });
    }

    return toUpdate.length;
  },
});

// ── Cross-file category consistency ──────────────────────────────────────────
// Each statement file is categorized independently, so the same merchant can
// end up with different categories across months. This unifies AI-assigned
// categories per merchantPattern (majority vote, or explicit assignments).

async function consolidate(
  ctx: MutationCtx,
  userId: string,
  assignments?: Array<{ merchantPattern: string; category: string }>
): Promise<number> {
  const txs = await ctx.db
    .query("transactions")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(4000);

  const winners = assignments
    ? new Map(assignments.map((a) => [a.merchantPattern, a.category]))
    : resolveMerchantCategories(txs);

  let patched = 0;
  for (const t of txs) {
    if (t.categorySource !== "ai" || !t.merchantPattern) continue;
    const winner = winners.get(t.merchantPattern);
    if (winner && t.category !== winner) {
      await ctx.db.patch(t._id, { category: winner });
      patched++;
    }
  }
  return patched;
}

export const consolidateMerchantCategories = mutation({
  args: {
    userId: v.string(),
    // Optional explicit pattern → category map (the onboarding wizard passes
    // the same resolution it shows the user, so UI and DB always agree)
    assignments: v.optional(
      v.array(v.object({ merchantPattern: v.string(), category: v.string() }))
    ),
  },
  handler: async (ctx, args) => {
    return await consolidate(ctx, args.userId, args.assignments);
  },
});

export const consolidateMerchantCategoriesInternal = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await consolidate(ctx, args.userId);
  },
});

// Excludes/includes a transaction from the dashboard and analyses
export const setTransactionExcluded = mutation({
  args: {
    transactionId: v.id("transactions"),
    excluded: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.transactionId, { excluded: args.excluded });
    return null;
  },
});

export const batchUpdateCategories = internalMutation({
  args: {
    updates: v.array(v.object({
      txId: v.id("transactions"),
      category: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    for (const { txId, category } of args.updates) {
      await ctx.db.patch(txId, { category });
    }
  },
});
