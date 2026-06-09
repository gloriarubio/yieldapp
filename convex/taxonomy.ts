import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./authz";

// ─── Validators ──────────────────────────────────────────────────────────────

export const categoryValidator = v.object({
  id: v.string(),
  name: v.string(),
  description: v.string(),
  color: v.string(),
  trackColor: v.string(),
  examples: v.array(v.string()),
  isDefault: v.boolean(),
  isActive: v.boolean(),
});

// ─── Seed categories ─────────────────────────────────────────────────────────

export const SEED_CATEGORIES = [
  {
    id: "supermercado",
    name: "Supermercado",
    description: "Compras en supermercados y tiendas de alimentación",
    color: "#1A6E3C",
    trackColor: "rgba(26,110,60,0.13)",
    examples: ["Mercadona", "Lidl", "Carrefour"],
    isDefault: true,
    isActive: true,
  },
  {
    id: "transporte",
    name: "Transporte",
    description: "Transporte público, gasolina, parking y movilidad",
    color: "#1E3D2C",
    trackColor: "rgba(30,61,44,0.13)",
    examples: ["Renfe", "EMT", "Repsol"],
    isDefault: true,
    isActive: true,
  },
  {
    id: "restaurantes",
    name: "Restaurantes",
    description: "Restaurantes, cafeterías y comida preparada",
    color: "#9B8EC4",
    trackColor: "rgba(155,142,196,0.13)",
    examples: ["Restaurante", "Cafetería", "Burger King"],
    isDefault: true,
    isActive: true,
  },
  {
    id: "ocio",
    name: "Ocio",
    description: "Entretenimiento, cultura y tiempo libre",
    color: "#A83030",
    trackColor: "rgba(168,48,48,0.13)",
    examples: ["Cine", "Teatro", "Conciertos"],
    isDefault: true,
    isActive: true,
  },
  {
    id: "suscripciones",
    name: "Suscripciones",
    description: "Servicios de suscripción digital y membresías",
    color: "#E8A87C",
    trackColor: "rgba(232,168,124,0.13)",
    examples: ["Netflix", "Spotify", "Amazon Prime"],
    isDefault: true,
    isActive: true,
  },
  {
    id: "ingresos",
    name: "Ingresos",
    description: "Nóminas, transferencias recibidas e ingresos",
    color: "#3B9EDB",
    trackColor: "rgba(59,158,219,0.13)",
    examples: ["Nómina", "Transferencia recibida"],
    isDefault: true,
    isActive: true,
  },
  {
    id: "otros",
    name: "Otros",
    description: "Transacciones sin categoría identificada",
    color: "#7A6F66",
    trackColor: "rgba(122,111,102,0.13)",
    examples: [],
    isDefault: true,
    isActive: true,
  },
] as const;

// ─── Queries ─────────────────────────────────────────────────────────────────

export const getUserTaxonomy = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return await ctx.db
      .query("userTaxonomy")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const getUserTaxonomyInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userTaxonomy")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

// ─── Internal mutations ───────────────────────────────────────────────────────

export const bootstrapTaxonomy = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userTaxonomy")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (existing) return existing._id;

    return await ctx.db.insert("userTaxonomy", {
      userId: args.userId,
      generatedAt: Date.now(),
      categories: SEED_CATEGORIES.map((c) => ({ ...c, examples: [...c.examples] })),
    });
  },
});

export const addCategories = internalMutation({
  args: {
    userId: v.string(),
    newCategories: v.array(categoryValidator),
  },
  handler: async (ctx, args) => {
    const taxonomy = await ctx.db
      .query("userTaxonomy")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (!taxonomy) return;

    const existing = new Set(taxonomy.categories.map((c) => c.id));
    const toAdd = args.newCategories.filter((c) => !existing.has(c.id));

    // Hard limit: max 15 total categories
    const combined = [...taxonomy.categories, ...toAdd].slice(0, 15);

    await ctx.db.patch(taxonomy._id, {
      categories: combined,
      lastExpansionAt: Date.now(),
    });
  },
});

export const deactivateStaleCategories = internalMutation({
  args: {
    userId: v.string(),
    staleCategoryIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const taxonomy = await ctx.db
      .query("userTaxonomy")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (!taxonomy) return;

    const staleSet = new Set(args.staleCategoryIds);
    const updated = taxonomy.categories.map((c) =>
      staleSet.has(c.id) ? { ...c, isActive: false } : c
    );

    await ctx.db.patch(taxonomy._id, { categories: updated });
  },
});
