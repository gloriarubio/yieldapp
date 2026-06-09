import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { generateApiKey, keyPrefix, sha256Hex } from "./apiKeyUtils";
import { subscriptionIsPro } from "./subscriptionHelpers";
import { requireUserId } from "./authz";

// Personal API keys for the public HTTP API (see convex/http.ts).
// The plaintext key is generated in an action (mutations must stay
// deterministic), shown to the user exactly once, and only its SHA-256
// hash is persisted.

const MAX_KEYS_PER_USER = 10;

// ─── Settings UI ─────────────────────────────────────────────────────────────

export const listApiKeys = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const keys = await ctx.db
      .query("api_keys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
    // Never expose the hash to the client
    return keys.map((k) => ({
      id: k._id,
      name: k.name,
      prefix: k.prefix,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt ?? null,
      revoked: k.revokedAt !== undefined,
    }));
  },
});

export const createApiKey = action({
  args: { name: v.string() },
  handler: async (ctx, args): Promise<{ key: string; prefix: string }> => {
    const userId = await requireUserId(ctx);
    // "API + automatizaciones" is a Pro feature — existing keys keep working
    // (read access), but creating new ones requires an active subscription
    const sub = await ctx.runQuery(internal.subscriptions.getSubscriptionInternal, {
      userId,
    });
    if (!subscriptionIsPro(sub)) {
      throw new Error("La API requiere el plan Pro. Actívalo en Ajustes → Suscripción.");
    }

    const key = generateApiKey();
    const prefix = keyPrefix(key);
    await ctx.runMutation(internal.apiKeys.insertApiKey, {
      userId,
      name: args.name.trim() || "API key",
      keyHash: await sha256Hex(key),
      prefix,
    });
    // Only moment the plaintext key ever leaves the server
    return { key, prefix };
  },
});

export const revokeApiKey = mutation({
  args: { keyId: v.id("api_keys") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const key = await ctx.db.get(args.keyId);
    if (!key || key.userId !== userId) {
      throw new Error("Clave no encontrada");
    }
    await ctx.db.patch(args.keyId, { revokedAt: Date.now() });
    return null;
  },
});

// ─── Internal (used by createApiKey and convex/http.ts) ──────────────────────

export const insertApiKey = internalMutation({
  args: {
    userId: v.string(),
    name: v.string(),
    keyHash: v.string(),
    prefix: v.string(),
  },
  handler: async (ctx, args) => {
    const active = await ctx.db
      .query("api_keys")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .take(MAX_KEYS_PER_USER + 1);
    if (active.filter((k) => k.revokedAt === undefined).length >= MAX_KEYS_PER_USER) {
      throw new Error(`Máximo ${MAX_KEYS_PER_USER} claves activas. Revoca alguna antes de crear otra.`);
    }
    return await ctx.db.insert("api_keys", {
      userId: args.userId,
      name: args.name,
      keyHash: args.keyHash,
      prefix: args.prefix,
      createdAt: Date.now(),
    });
  },
});

// Returns the owning userId for a key hash, or null if unknown/revoked
export const verifyApiKey = internalQuery({
  args: { keyHash: v.string() },
  handler: async (ctx, args) => {
    const key = await ctx.db
      .query("api_keys")
      .withIndex("by_keyHash", (q) => q.eq("keyHash", args.keyHash))
      .unique();
    if (!key || key.revokedAt !== undefined) return null;
    return { userId: key.userId, keyId: key._id, lastUsedAt: key.lastUsedAt ?? null };
  },
});

// lastUsedAt is informational — http.ts only patches it when stale (>5 min)
// to avoid a write on every request
export const touchApiKey = internalMutation({
  args: { keyId: v.id("api_keys") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.keyId, { lastUsedAt: Date.now() });
    return null;
  },
});
