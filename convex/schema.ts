import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  statements: defineTable({
    userId: v.string(),
    // Optional because API-pushed JSON transactions ("api" fileType) have no file
    storageId: v.optional(v.id("_storage")),
    filename: v.string(),
    fileType: v.union(
      v.literal("pdf"),
      v.literal("csv"),
      v.literal("excel"),
      v.literal("api") // JSON transactions pushed via POST /v1/transactions
    ),
    status: v.union(
      v.literal("processing"),
      v.literal("done"),
      v.literal("error")
    ),
    errorMessage: v.optional(v.string()),
    transactionCount: v.optional(v.number()),
    uploadedAt: v.number(),
    processedAt: v.optional(v.number()),
    // Live progress while status === "processing" — the onboarding wizard
    // subscribes to it for real-time feedback
    progress: v.optional(v.object({
      phase: v.union(v.literal("extracting"), v.literal("categorizing")),
      extracted: v.optional(v.number()),
      categorized: v.optional(v.number()),
      total: v.optional(v.number()),
    })),
    // Legacy: insights used to live on the statement; they're per-month now
    // (see monthlyInsights). Kept optional for old documents.
    insights: v.optional(v.array(v.object({
      type: v.union(
        v.literal("warning"),
        v.literal("trend"),
        v.literal("suggestion")
      ),
      text: v.string(),
    }))),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_status", ["userId", "status"]),

  // AI insights generated per calendar month (on demand from the dashboard).
  // A statement file can span several months, so insights can't live on the
  // statement — every month resolves independently.
  monthlyInsights: defineTable({
    userId: v.string(),
    month: v.string(), // "YYYY-MM"
    generatedAt: v.number(),
    insights: v.array(v.object({
      type: v.union(
        v.literal("warning"),
        v.literal("trend"),
        v.literal("suggestion")
      ),
      text: v.string(),
    })),
  }).index("by_user_month", ["userId", "month"]),

  transactions: defineTable({
    userId: v.string(),
    statementId: v.id("statements"),
    date: v.string(),
    description: v.string(),
    amount: v.number(),
    category: v.string(),
    merchant: v.optional(v.string()),
    type: v.union(v.literal("income"), v.literal("expense")),
    // Normalized merchant pattern (same format as category_rules.merchantPattern).
    // Stored at categorization time to make future corrections cheap.
    merchantPattern: v.optional(v.string()),
    categorySource: v.optional(v.union(
      v.literal("rule"),      // assigned by a user rule
      v.literal("ai"),        // assigned by Claude
      v.literal("manual")     // manually corrected by the user
    )),
    // true = the user excluded this transaction from the dashboard and
    // analyses (still visible, greyed out, in the transactions list)
    excluded: v.optional(v.boolean()),
  })
    .index("by_userId", ["userId"])
    .index("by_statementId", ["statementId"])
    .index("by_userId_and_date", ["userId", "date"]),

  // User-confirmed categorization rules, learned during onboarding and
  // from manual corrections. Matching is `includes` over the normalized
  // transaction description, not exact match.
  // TODO(spec): the spec asked for userId: v.id("users"), but this project
  // uses Better Auth with string user ids (see `user` table + transactions.userId),
  // so we keep v.string() for coherence.
  category_rules: defineTable({
    userId: v.string(),
    // Normalized merchant text as it appears on statements, uppercased,
    // without variable suffixes or asterisks. E.g. "AMZN MKTP", "GLOVO".
    merchantPattern: v.string(),
    // Category name exactly as the user uses it.
    category: v.string(),
    // true if the user marked it as a recurring subscription.
    isSubscription: v.boolean(),
    // true = the user chose "no contabilizar": future transactions of this
    // merchant are inserted with excluded: true (kept out of all analyses)
    excludeFromAnalysis: v.optional(v.boolean()),
    source: v.union(
      v.literal("onboarding"),  // from the initial wizard
      v.literal("user_edit")    // from a later manual correction
    ),
    confirmedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_merchant", ["userId", "merchantPattern"]),

  // Dashboard notifications (currently only "new_merchants" after a monthly upload)
  notifications: defineTable({
    userId: v.string(),
    type: v.literal("new_merchants"),
    merchantPatterns: v.array(v.string()),
    createdAt: v.number(),
    read: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_user_read", ["userId", "read"]),


  userTaxonomy: defineTable({
    userId: v.string(),
    generatedAt: v.number(),
    lastExpansionAt: v.optional(v.number()),
    categories: v.array(v.object({
      id: v.string(),
      name: v.string(),
      description: v.string(),
      color: v.string(),
      trackColor: v.string(),
      examples: v.array(v.string()),
      isDefault: v.boolean(),
      isActive: v.boolean(),
    })),
  }).index("by_userId", ["userId"]),

  // Savings plan built in /app/proyecciones (Pro): goal + simulated cuts.
  // One document per user; the page autosaves so the plan survives sessions.
  projection_plans: defineTable({
    userId: v.string(),
    goalName: v.optional(v.string()),
    targetAmount: v.optional(v.number()),
    targetDate: v.optional(v.string()), // "YYYY-MM"
    // Simulated monthly cut per category (absolute €/month)
    categoryCuts: v.array(v.object({ category: v.string(), monthlyCut: v.number() })),
    // Subscriptions toggled as "cancelled" in the simulation (merchant names)
    cancelledSubscriptions: v.array(v.string()),
    // Cached Claude feasibility verdict (regenerated on demand)
    aiVerdict: v.optional(v.object({ text: v.string(), generatedAt: v.number() })),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  // Conversational assistant (Pro): saved chat history so past conversations
  // survive sessions. One row per conversation + one row per message.
  assistant_conversations: defineTable({
    userId: v.string(),
    title: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  assistant_messages: defineTable({
    conversationId: v.id("assistant_conversations"),
    userId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    text: v.string(),
    createdAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_user", ["userId"]),

  // Stripe subscription state, kept in sync by the /stripe/webhook HTTP route.
  // One row per user; absence of a row (or a non-active status) means Free.
  subscriptions: defineTable({
    userId: v.string(),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.optional(v.string()),
    plan: v.union(v.literal("free"), v.literal("pro")),
    interval: v.optional(v.union(v.literal("month"), v.literal("year"))),
    // Raw Stripe status: active, trialing, past_due, canceled, unpaid...
    status: v.optional(v.string()),
    // true when the user cancelled but keeps access until period end
    cancelAtPeriodEnd: v.optional(v.boolean()),
    currentPeriodEnd: v.optional(v.number()), // ms epoch
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_customerId", ["stripeCustomerId"]),

  // Personal API keys for the public HTTP API (convex/http.ts).
  // The plaintext key (yld_...) is shown to the user exactly once at creation;
  // only its SHA-256 hash is stored. `prefix` keeps the first chars for display.
  api_keys: defineTable({
    userId: v.string(),
    name: v.string(),
    keyHash: v.string(), // SHA-256 hex of the full plaintext key
    prefix: v.string(), // e.g. "yld_a1b2c3" — for identifying keys in the UI
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_keyHash", ["keyHash"]),

  user: defineTable({
    id: v.string(),
    name: v.string(),
    email: v.string(),
    emailVerified: v.boolean(),
    image: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
    // Set to true when the user finishes the onboarding wizard.
    // Monthly uploads check this to decide wizard vs. normal experience.
    onboardingCompleted: v.optional(v.boolean()),
  })
    .index("by_auth_id", ["id"])
    .index("by_email", ["email"]),

  session: defineTable({
    id: v.string(),
    token: v.string(),
    userId: v.string(),
    expiresAt: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  })
    .index("by_auth_id", ["id"])
    .index("by_token", ["token"])
    .index("by_userId", ["userId"]),

  account: defineTable({
    id: v.string(),
    accountId: v.string(),
    providerId: v.string(),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    idToken: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.string()),
    refreshTokenExpiresAt: v.optional(v.string()),
    scope: v.optional(v.string()),
    password: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_auth_id", ["id"])
    .index("by_userId", ["userId"])
    .index("by_accountId_providerId", ["accountId", "providerId"]),

  verification: defineTable({
    id: v.string(),
    identifier: v.string(),
    value: v.string(),
    expiresAt: v.string(),
    createdAt: v.optional(v.string()),
    updatedAt: v.optional(v.string()),
  })
    .index("by_auth_id", ["id"])
    .index("by_identifier", ["identifier"]),
});
