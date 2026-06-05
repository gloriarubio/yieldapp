"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import Anthropic from "@anthropic-ai/sdk";

const CUSTOM_COLOR_POOL = [
  { color: "#2A7B7B", trackColor: "rgba(42,123,123,0.13)" },
  { color: "#B8860B", trackColor: "rgba(184,134,11,0.13)" },
  { color: "#4B5FA6", trackColor: "rgba(75,95,166,0.13)" },
  { color: "#C4605A", trackColor: "rgba(196,96,90,0.13)" },
  { color: "#6B7A3C", trackColor: "rgba(107,122,60,0.13)" },
  { color: "#8B5E3C", trackColor: "rgba(139,94,60,0.13)" },
  { color: "#546878", trackColor: "rgba(84,104,120,0.13)" },
  { color: "#7B4A6E", trackColor: "rgba(123,74,110,0.13)" },
];

function assignCustomColor(idx: number) {
  return CUSTOM_COLOR_POOL[idx % CUSTOM_COLOR_POOL.length];
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

const SEED_NAMES = [
  "Supermercado", "Transporte", "Restaurantes",
  "Ocio", "Suscripciones", "Ingresos", "Otros",
];

// ─── Taxonomy generation ──────────────────────────────────────────────────────

export const generateUserTaxonomy = internalAction({
  args: {
    userId: v.string(),
    othersTransactions: v.array(v.object({
      txId: v.id("statements"), // used as a stable reference; content not needed for generation
      description: v.string(),
      amount: v.number(),
      merchant: v.optional(v.string()),
    })),
    existingCustomCount: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.othersTransactions.length === 0) return;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const txList = args.othersTransactions
      .map((t, i) => `${i + 1}. "${t.merchant || t.description}" | ${t.amount < 0 ? "-" : "+"}${Math.abs(t.amount)}€`)
      .join("\n");

    const prompt = `Eres un sistema de categorización financiera para usuarios españoles. Tu objetivo principal es ELIMINAR la categoría "Otros" asignando a cada transacción la categoría más específica posible.

Categorías ya existentes (NO crear variantes de estas): ${SEED_NAMES.join(", ")}

Transacciones actualmente en "Otros":
${txList}

Tu tarea:
1. Crea nuevas categorías para agrupar estas transacciones
2. Prioriza cubrir el mayor volumen de transacciones posible
3. Si 2 o más transacciones tienen el mismo patrón de gasto, crea una categoría para ellas
4. Máximo 8 nuevas categorías, nombres en español de máximo 2 palabras
5. Las transacciones verdaderamente únicas o crípticas pueden quedarse en "Otros" — pero si hay duda, crea la categoría

Responde ÚNICAMENTE con JSON válido, sin markdown:
{"newCategories":[{"id":"farmacia","name":"Farmacia","description":"Gastos en farmacias y parafarmacia","examples":["Farmacia García","Arenal"]}],"uncategorizable":["descripción1"]}

Si no hay patrones claros: {"newCategories":[],"uncategorizable":[...]}`;

    let newCategories: Array<{ id: string; name: string; description: string; examples: string[] }> = [];

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      });
      const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
      const parsed = JSON.parse(text) as {
        newCategories: Array<{ id: string; name: string; description: string; examples: string[] }>;
      };
      newCategories = (parsed.newCategories ?? []).slice(0, 8);
    } catch {
      // Non-fatal: if Claude fails, taxonomy stays as seeds
      return;
    }

    if (newCategories.length === 0) return;

    let customCount = args.existingCustomCount;
    const categoriesToAdd = newCategories.map((c) => {
      const { color, trackColor } = assignCustomColor(customCount++);
      return {
        id: toSlug(c.name),
        name: c.name,
        description: c.description,
        color,
        trackColor,
        examples: c.examples ?? [],
        isDefault: false,
        isActive: true,
      };
    });

    await ctx.runMutation(internal.taxonomy.addCategories, {
      userId: args.userId,
      newCategories: categoriesToAdd,
    });
  },
});

// ─── Re-categorize existing "Otros" transactions ─────────────────────────────

export const recategorizeOthers = internalAction({
  args: {
    userId: v.string(),
    availableCategoryNames: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const others = await ctx.runQuery(internal.transactions.getOthersTransactions, {
      userId: args.userId,
    });

    if (others.length === 0) return;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const BATCH_SIZE = 100;
    const categoryList = args.availableCategoryNames.join(", ");

    for (let i = 0; i < others.length; i += BATCH_SIZE) {
      const batch = others.slice(i, i + BATCH_SIZE);

      const txList = batch
        .map((t) => `${t._id}|${t.merchant || t.description}|${t.amount}€`)
        .join("\n");

      const prompt = `Re-categoriza estas transacciones bancarias. Usa "Otros" SOLO si ninguna categoría disponible encaja. En caso de duda, asigna la más cercana.

Categorías disponibles: ${categoryList}

Transacciones (ID|descripción|importe):
${txList}

Responde ÚNICAMENTE con JSON, incluyendo TODAS las transacciones del input:
[{"id":"<_id>","category":"<nombre>"},...]`;

      try {
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 2000,
          messages: [{ role: "user", content: prompt }],
        });
        const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
        const assignments = JSON.parse(text) as Array<{ id: string; category: string }>;

        const updates: Array<{ txId: Id<"transactions">; category: string }> = assignments
          .filter((a) => a.category && a.category !== "Otros")
          .map((a) => ({
            txId: a.id as Id<"transactions">,
            category: a.category,
          }));

        if (updates.length > 0) {
          await ctx.runMutation(internal.transactions.batchUpdateCategories, { updates });
        }
      } catch {
        // Skip failed batch, continue with next
      }
    }
  },
});
