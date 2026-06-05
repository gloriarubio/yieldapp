import { mutation } from "./_generated/server";
import { v } from "convex/values";

// ─── Borrar todos los datos excepto auth ─────────────────────────────────────
// Uso: npx convex run admin:clearAllData

export const clearAllData = mutation({
  args: {},
  handler: async (ctx) => {
    const tables = [
      "transactions",
      "statements",
      "userTaxonomy",
      "category_rules",
      "notifications",
      "monthlyInsights",
    ] as const;
    const counts: Record<string, number> = {};

    for (const table of tables) {
      const docs = await ctx.db.query(table).take(4000);
      for (const doc of docs) {
        await ctx.db.delete(doc._id);
      }
      counts[table] = docs.length;
    }

    // Reset onboarding so the wizard runs again on next login
    const users = await ctx.db.query("user").take(100);
    for (const u of users) {
      await ctx.db.patch(u._id, { onboardingCompleted: undefined });
    }
    counts["usersReset"] = users.length;

    return counts;
  },
});
