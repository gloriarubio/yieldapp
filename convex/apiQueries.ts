import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

// Internal queries that back the public HTTP API (convex/http.ts).
// They take userId because http.ts resolves it from the API key — they must
// never be exposed as public queries.

// ─── GET /v1/transactions ────────────────────────────────────────────────────

export const listTransactionsForApi = internalQuery({
  args: {
    userId: v.string(),
    from: v.optional(v.string()), // YYYY-MM-DD inclusive
    to: v.optional(v.string()), // YYYY-MM-DD inclusive
    category: v.optional(v.string()),
    type: v.optional(v.union(v.literal("income"), v.literal("expense"))),
    includeExcluded: v.optional(v.boolean()),
    numItems: v.number(),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("transactions")
      .withIndex("by_userId_and_date", (q) => {
        const base = q.eq("userId", args.userId);
        if (args.from && args.to) return base.gte("date", args.from).lte("date", args.to);
        if (args.from) return base.gte("date", args.from);
        if (args.to) return base.lte("date", args.to);
        return base;
      })
      .order("desc")
      .paginate({ numItems: args.numItems, cursor: args.cursor });

    // Category/type filters are applied per page (a page can return fewer
    // items than numItems — consumers must follow the cursor, not the count)
    const catLower = args.category?.toLowerCase();
    const items = result.page.filter((t) => {
      if (catLower && t.category.toLowerCase() !== catLower) return false;
      if (args.type && t.type !== args.type) return false;
      if (!args.includeExcluded && t.excluded === true) return false;
      return true;
    });

    return {
      items: items.map((t) => ({
        id: t._id,
        date: t.date,
        description: t.description,
        amount: t.amount,
        category: t.category,
        type: t.type,
        merchant: t.merchant ?? null,
        categorySource: t.categorySource ?? null,
        excluded: t.excluded === true,
      })),
      cursor: result.isDone ? null : result.continueCursor,
      isDone: result.isDone,
    };
  },
});

// ─── GET /v1/summary ─────────────────────────────────────────────────────────

export const getSummaryForApi = internalQuery({
  args: { userId: v.string(), month: v.string() }, // month "YYYY-MM"
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("transactions")
      .withIndex("by_userId_and_date", (q) =>
        q
          .eq("userId", args.userId)
          .gte("date", `${args.month}-01`)
          .lte("date", `${args.month}-31`)
      )
      .take(5000);

    // Excluded transactions never take part in analyses
    const txs = all.filter((t) => t.excluded !== true);

    const income = txs.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0);
    const expenses = txs.filter((t) => t.amount < 0);
    const totalExpenses = expenses.reduce((a, t) => a + Math.abs(t.amount), 0);

    // Expense breakdown by category
    const catTotals = new Map<string, { total: number; count: number }>();
    for (const t of expenses) {
      const entry = catTotals.get(t.category) ?? { total: 0, count: 0 };
      entry.total += Math.abs(t.amount);
      entry.count++;
      catTotals.set(t.category, entry);
    }
    const byCategory = [...catTotals.entries()]
      .map(([category, { total, count }]) => ({
        category,
        total: round2(total),
        count,
        percent: totalExpenses > 0 ? Math.round((total / totalExpenses) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // Top merchants by spend
    const merchTotals = new Map<string, { total: number; count: number; category: string }>();
    for (const t of expenses) {
      const name = (t.merchant || t.merchantPattern || t.description).trim().slice(0, 60);
      const entry = merchTotals.get(name) ?? { total: 0, count: 0, category: t.category };
      entry.total += Math.abs(t.amount);
      entry.count++;
      merchTotals.set(name, entry);
    }
    const topMerchants = [...merchTotals.entries()]
      .map(([merchant, { total, count, category }]) => ({
        merchant,
        total: round2(total),
        count,
        category,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Detected subscriptions this month
    const subscriptions = [...merchTotals.entries()]
      .filter(([merchant]) =>
        expenses.some(
          (t) =>
            t.category === "Suscripciones" &&
            (t.merchant || t.merchantPattern || t.description).trim().slice(0, 60) === merchant
        )
      )
      .map(([merchant, { total, count }]) => ({ merchant, total: round2(total), count }))
      .sort((a, b) => b.total - a.total);

    return {
      month: args.month,
      transactionCount: txs.length,
      income: round2(income),
      expenses: round2(totalExpenses),
      net: round2(income - totalExpenses),
      byCategory,
      topMerchants,
      subscriptions,
    };
  },
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
