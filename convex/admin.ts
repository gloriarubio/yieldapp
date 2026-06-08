import { internalMutation } from "./_generated/server";

// ─── Borrar todos los datos excepto auth ─────────────────────────────────────
// Uso: npx convex run admin:clearAllData  (internal: solo CLI/dashboard, NUNCA
// llamable desde un cliente público — borra datos de TODOS los usuarios)

export const clearAllData = internalMutation({
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
