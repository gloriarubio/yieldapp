"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id, Doc } from "./_generated/dataModel";
import Anthropic from "@anthropic-ai/sdk";
import { extractFromPdf, extractFromStructuredFile, type TxRow } from "./process";
import { applyUserRules, ONBOARDING_CATEGORIES } from "../src/lib/categorization";
import { categorizeWithAI } from "../src/lib/categorization-ai";

export type OnboardingTxResult = {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  confidence: "high" | "low";
  isSubscription: boolean;
  merchantPattern: string;
  categorySource: "rule" | "ai";
};

// Processes one statement file during the onboarding wizard (step 2):
// extract → applyUserRules (empty on first run, but the flow is identical to
// monthly uploads) → categorizeWithAI → insert. Returns the categorized rows
// (with confidence) so the client can build the ambiguous-merchant questions
// with getAmbiguousMerchants() once every file is processed.
//
// TODO(spec): the spec mentions a LlamaParse parsing endpoint; this project
// extracts PDFs with Claude's native vision (see convex/process.ts), so we
// reuse that pipeline instead.
export const processOnboardingStatement = action({
  args: {
    userId: v.string(),
    storageId: v.id("_storage"),
    filename: v.string(),
    fileType: v.union(v.literal("pdf"), v.literal("csv"), v.literal("excel")),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ statementId: Id<"statements">; transactions: OnboardingTxResult[] }> => {
    const statementId: Id<"statements"> = await ctx.runMutation(
      internal.statements.createStatement,
      {
        userId: args.userId,
        storageId: args.storageId,
        filename: args.filename,
        fileType: args.fileType,
      }
    );

    try {
      const blob = await ctx.storage.get(args.storageId);
      if (!blob) throw new Error("Archivo no encontrado en storage");

      // 1. Extract transactions (same pipeline as monthly uploads).
      // Progress is patched onto the statement document — the wizard
      // subscribes to it for real-time feedback.
      await ctx.runMutation(internal.statements.updateStatementProgress, {
        statementId,
        progress: { phase: "extracting" },
      });

      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const extracted: TxRow[] =
        args.fileType === "pdf"
          ? await extractFromPdf(blob, args.userId, statementId, anthropic, [
              ...ONBOARDING_CATEGORIES,
            ])
          : await extractFromStructuredFile(blob, args.fileType, args.userId, statementId);

      await ctx.runMutation(internal.statements.updateStatementProgress, {
        statementId,
        progress: {
          phase: "categorizing",
          extracted: extracted.length,
          categorized: 0,
          total: extracted.length,
        },
      });

      // 2. Apply existing user rules (empty during a fresh onboarding)
      const rules: Doc<"category_rules">[] = await ctx.runQuery(
        internal.categoryRules.getUserRulesInternal,
        { userId: args.userId }
      );
      const { categorized: byRule, uncategorized } = applyUserRules(
        extracted,
        rules.map((r) => ({
          merchantPattern: r.merchantPattern,
          category: r.category,
          isSubscription: r.isSubscription,
        }))
      );

      // 3. Categorize the rest with Claude (parallel batches), reporting
      //    live progress as each batch completes
      const aiInput = uncategorized.map((t, i) => ({
        id: String(i),
        date: t.date,
        description: t.description,
        amount: t.amount,
      }));
      const aiResults = await categorizeWithAI(aiInput, true, {
        onProgress: async (categorized) => {
          await ctx.runMutation(internal.statements.updateStatementProgress, {
            statementId,
            progress: {
              phase: "categorizing",
              extracted: extracted.length,
              categorized: categorized + byRule.length,
              total: extracted.length,
            },
          });
        },
      });
      const aiById = new Map(aiResults.map((r) => [r.id, r]));

      // 4. Build the final rows
      const results: OnboardingTxResult[] = [
        ...byRule.map((t) => ({
          date: t.date,
          description: t.description,
          amount: t.amount,
          type: t.type,
          category: t.category,
          confidence: "high" as const,
          isSubscription: t.isSubscription,
          merchantPattern: t.merchantPattern,
          categorySource: "rule" as const,
        })),
        ...uncategorized.map((t, i) => {
          const ai = aiById.get(String(i));
          // If Claude fell back to "Otros" (e.g. a failed batch), keep the
          // extraction-time category (PDF tool / regex first pass) instead.
          const category =
            ai && ai.category !== "Otros"
              ? ai.category
              : t.category !== "Otros"
                ? t.category
                : "Otros";
          return {
            date: t.date,
            description: t.description,
            amount: t.amount,
            type: t.type,
            category,
            confidence: (ai?.confidence ?? "low") as "high" | "low",
            isSubscription: ai?.isSubscription === true,
            merchantPattern: ai?.merchantPattern ?? t.merchantPattern,
            categorySource: "ai" as const,
          };
        }),
      ];

      // 5. Persist transactions (the wizard answers will re-patch them later
      //    via saveOnboardingRules, matching by merchantPattern)
      const count: number = await ctx.runMutation(internal.transactions.insertTransactions, {
        transactions: results.map((r) => ({
          userId: args.userId,
          statementId,
          date: r.date,
          description: r.description,
          amount: r.amount,
          category: r.category,
          type: r.type,
          merchantPattern: r.merchantPattern,
          categorySource: r.categorySource,
        })),
      });

      await ctx.runMutation(internal.statements.updateStatementStatus, {
        statementId,
        status: "done",
        transactionCount: count,
      });

      return { statementId, transactions: results };
    } catch (err) {
      await ctx.runMutation(internal.statements.updateStatementStatus, {
        statementId,
        status: "error",
        errorMessage: err instanceof Error ? err.message : "Error desconocido",
      });
      throw err;
    }
  },
});
