import { internalMutation, internalQuery, mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { normalizeMerchant } from "../src/lib/categorization";
import { SEED_CATEGORIES } from "./taxonomy";

// ─── Validators ──────────────────────────────────────────────────────────────

const answerValidator = v.object({
  merchantPattern: v.string(),
  category: v.string(),
  isSubscription: v.boolean(),
  // "no contabilizar": exclude this merchant's transactions from all analyses
  exclude: v.optional(v.boolean()),
});

const renameValidator = v.object({
  from: v.string(),
  to: v.string(),
});

// ─── Queries ─────────────────────────────────────────────────────────────────

export const getUserRules = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("category_rules")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .take(1000);
  },
});

export const getUserRulesInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("category_rules")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .take(1000);
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function upsertRule(
  ctx: MutationCtx,
  userId: string,
  answer: {
    merchantPattern: string;
    category: string;
    isSubscription: boolean;
    excludeFromAnalysis?: boolean;
  },
  source: "onboarding" | "user_edit"
) {
  const existing = await ctx.db
    .query("category_rules")
    .withIndex("by_user_merchant", (q) =>
      q.eq("userId", userId).eq("merchantPattern", answer.merchantPattern)
    )
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      category: answer.category,
      isSubscription: answer.isSubscription,
      excludeFromAnalysis: answer.excludeFromAnalysis === true,
      source,
      confirmedAt: Date.now(),
    });
  } else {
    await ctx.db.insert("category_rules", {
      userId,
      merchantPattern: answer.merchantPattern,
      category: answer.category,
      isSubscription: answer.isSubscription,
      excludeFromAnalysis: answer.excludeFromAnalysis === true,
      source,
      confirmedAt: Date.now(),
    });
  }
}

// Keep userTaxonomy in sync so the dashboard (colors, filter chips) knows
// about every category the onboarding produced. Not in the original spec,
// but required for coherence with the existing taxonomy system.
const TAXONOMY_COLOR_POOL = [
  { color: "#2A7B7B", trackColor: "rgba(42,123,123,0.13)" },
  { color: "#B8860B", trackColor: "rgba(184,134,11,0.13)" },
  { color: "#4B5FA6", trackColor: "rgba(75,95,166,0.13)" },
  { color: "#C4605A", trackColor: "rgba(196,96,90,0.13)" },
  { color: "#6B7A3C", trackColor: "rgba(107,122,60,0.13)" },
  { color: "#8B5E3C", trackColor: "rgba(139,94,60,0.13)" },
  { color: "#546878", trackColor: "rgba(84,104,120,0.13)" },
  { color: "#7B4A6E", trackColor: "rgba(123,74,110,0.13)" },
];

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

async function syncTaxonomy(
  ctx: MutationCtx,
  userId: string,
  categoryNames: string[],
  renames: Array<{ from: string; to: string }>
) {
  let taxonomy = await ctx.db
    .query("userTaxonomy")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();

  if (!taxonomy) {
    const id = await ctx.db.insert("userTaxonomy", {
      userId,
      generatedAt: Date.now(),
      categories: SEED_CATEGORIES.map((c) => ({ ...c, examples: [...c.examples] })),
    });
    taxonomy = (await ctx.db.get(id))!;
  }

  let categories = taxonomy.categories.map((c) => ({ ...c }));

  // Apply renames to existing taxonomy entries (cosmetic rename keeps the id)
  for (const { from, to } of renames) {
    const entry = categories.find((c) => c.name === from);
    if (entry) entry.name = to;
  }

  // Add any category that the dashboard doesn't know about yet
  const known = new Set(categories.map((c) => c.name));
  let customCount = categories.filter((c) => !c.isDefault).length;
  for (const name of categoryNames) {
    if (!name || known.has(name)) continue;
    const { color, trackColor } = TAXONOMY_COLOR_POOL[customCount % TAXONOMY_COLOR_POOL.length];
    customCount++;
    categories.push({
      id: toSlug(name),
      name,
      description: "Categoría confirmada durante el onboarding",
      color,
      trackColor,
      examples: [],
      isDefault: false,
      isActive: true,
    });
    known.add(name);
  }

  // Respect the existing hard limit of 15 categories
  categories = categories.slice(0, 15);

  await ctx.db.patch(taxonomy._id, { categories });
}

// ─── 3B — saveOnboardingRules ────────────────────────────────────────────────

// TODO(spec): the spec asked to receive userId as v.id("users"); this project
// uses Better Auth string ids, so userId is v.string(). It also follows the
// existing convention of passing userId from the client (like the rest of
// the queries/mutations in this codebase).
export const saveOnboardingRules = mutation({
  args: {
    userId: v.string(),
    answers: v.array(answerValidator),
    // Cosmetic category renames done in step 4 of the wizard
    renames: v.optional(v.array(renameValidator)),
    // false when called from the mini-wizard at /app/clasificar
    completeOnboarding: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const renames = args.renames ?? [];
    const renameMap = new Map(renames.map((r) => [r.from, r.to]));
    const finalName = (cat: string) => renameMap.get(cat) ?? cat;

    // 1. Upsert one rule per answer (with renamed category names).
    //    exclude answers become "no contabilizar" rules: future uploads insert
    //    matching transactions as excluded automatically.
    for (const answer of args.answers) {
      await upsertRule(
        ctx,
        args.userId,
        {
          merchantPattern: answer.merchantPattern,
          category: finalName(answer.category),
          isSubscription: answer.isSubscription,
          excludeFromAnalysis: answer.exclude === true,
        },
        "onboarding"
      );
    }

    // 2. Update the user's transactions: first apply answers by merchantPattern,
    //    then apply renames to every remaining transaction of a renamed category.
    //    Track every FINAL category in use — the taxonomy must know all of them,
    //    not just the ones the user confirmed in questions (otherwise the
    //    recategorize dropdown only offers the seed categories).
    const txs = await ctx.db
      .query("transactions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .take(4000);

    const usedCategoryCounts = new Map<string, number>();
    const countUse = (cat: string) =>
      usedCategoryCounts.set(cat, (usedCategoryCounts.get(cat) ?? 0) + 1);

    for (const tx of txs) {
      const normalized = tx.merchantPattern ?? normalizeMerchant(tx.description);
      const answer = args.answers.find(
        (a) => a.merchantPattern.length > 0 && normalized.includes(a.merchantPattern)
      );

      if (answer) {
        const cat = finalName(answer.category);
        await ctx.db.patch(tx._id, {
          category: cat,
          merchantPattern: answer.merchantPattern,
          categorySource: "rule",
          // "no contabilizar" → out of dashboard, totals and insights
          ...(answer.exclude === true ? { excluded: true } : {}),
        });
        // Excluded merchants shouldn't force their category into the taxonomy
        if (answer.exclude !== true) countUse(cat);
      } else if (renameMap.has(tx.category)) {
        const cat = renameMap.get(tx.category)!;
        await ctx.db.patch(tx._id, { category: cat });
        countUse(cat);
      } else {
        countUse(tx.category);
      }
    }

    // 3. Rename categories in previously saved rules too
    if (renames.length > 0) {
      const rules = await ctx.db
        .query("category_rules")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .take(1000);
      for (const rule of rules) {
        if (renameMap.has(rule.category)) {
          await ctx.db.patch(rule._id, { category: renameMap.get(rule.category)! });
        }
      }
    }

    // 4. Keep the dashboard taxonomy coherent with EVERY category in use:
    //    answers, renames and whatever the AI assigned during processing.
    //    Most-used first so the 15-category cap never drops a relevant one.
    const usedNames = [
      ...new Set([
        ...args.answers.filter((a) => a.exclude !== true).map((a) => finalName(a.category)),
        ...renames.map((r) => r.to),
        ...[...usedCategoryCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([name]) => name),
      ]),
    ];
    await syncTaxonomy(ctx, args.userId, usedNames, renames);

    // 5. Mark onboarding as completed
    if (args.completeOnboarding !== false) {
      const user = await ctx.db
        .query("user")
        .withIndex("by_auth_id", (q) => q.eq("id", args.userId))
        .unique();
      if (user) {
        await ctx.db.patch(user._id, { onboardingCompleted: true });
      }
    }

    return null;
  },
});

// One-off backfill: users who onboarded before the taxonomy fix have
// transactions with categories the taxonomy doesn't know. Run with:
//   npx convex run categoryRules:backfillTaxonomyFromTransactions '{"userId":"..."}'
export const backfillTaxonomyFromTransactions = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const txs = await ctx.db
      .query("transactions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .take(4000);
    const counts = new Map<string, number>();
    for (const t of txs) counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
    const names = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
    await syncTaxonomy(ctx, args.userId, names, []);
    return names;
  },
});

// ─── 3C — updateTransactionCategory ──────────────────────────────────────────

export const updateTransactionCategory = mutation({
  args: {
    transactionId: v.id("transactions"),
    newCategory: v.string(),
    isSubscription: v.boolean(),
  },
  handler: async (ctx, args) => {
    const tx = await ctx.db.get(args.transactionId);
    if (!tx) throw new Error("Transacción no encontrada");

    const merchantPattern = tx.merchantPattern ?? normalizeMerchant(tx.description);

    // 1. Update the transaction itself
    await ctx.db.patch(args.transactionId, {
      category: args.newCategory,
      categorySource: "manual",
      merchantPattern,
    });

    // 2. Learn from the correction: next time this merchant appears it will
    //    be categorized by rule, without going through Claude.
    await upsertRule(
      ctx,
      tx.userId,
      {
        merchantPattern,
        category: args.newCategory,
        isSubscription: args.isSubscription,
      },
      "user_edit"
    );

    // 3. Propagate to the user's OTHER transactions of the same merchant
    //    (except ones they corrected manually themselves), so historical
    //    months stay consistent with the new rule.
    if (merchantPattern) {
      const siblings = await ctx.db
        .query("transactions")
        .withIndex("by_userId", (q) => q.eq("userId", tx.userId))
        .take(4000);
      for (const sib of siblings) {
        if (sib._id === args.transactionId) continue;
        if (sib.categorySource === "manual") continue;
        const sibPattern = sib.merchantPattern ?? normalizeMerchant(sib.description);
        if (sibPattern === merchantPattern || sibPattern.includes(merchantPattern)) {
          await ctx.db.patch(sib._id, {
            category: args.newCategory,
            merchantPattern,
            categorySource: "rule",
          });
        }
      }
    }

    return null;
  },
});
