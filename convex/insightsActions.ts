"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import Anthropic from "@anthropic-ai/sdk";
import { requireUserId } from "./authz";

const MONTH_NAMES_ES = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
];

type InsightRow = { type: "warning" | "trend" | "suggestion"; text: string };

// Generates AI insights for ONE calendar month, using only that month's
// transactions (a statement file can span several months, so insights are
// keyed by month, never by statement). Triggered on demand from the
// dashboard's "Generar análisis" button.
// Public wrapper (dashboard): verified identity → internal generator.
export const generateMonthInsights = action({
  args: { userId: v.optional(v.string()), month: v.string() },
  handler: async (ctx, args): Promise<InsightRow[] | null> => {
    const userId = await requireUserId(ctx);
    return await ctx.runAction(internal.insightsActions.generateMonthInsightsInternal, {
      userId,
      month: args.month,
    });
  },
});

// Internal generator (the web wrapper above and convex/http.ts API call it,
// both with an already-trusted userId).
export const generateMonthInsightsInternal = internalAction({
  args: {
    userId: v.string(),
    month: v.string(), // "YYYY-MM"
  },
  handler: async (ctx, args): Promise<InsightRow[] | null> => {
    const allTxs: Doc<"transactions">[] = await ctx.runQuery(
      internal.transactions.getTransactionsByMonth,
      { userId: args.userId, month: args.month }
    );
    // User-excluded transactions don't take part in any analysis
    const txs = allTxs.filter((t) => t.excluded !== true);

    const expenses = txs.filter((t) => t.amount < 0);
    if (expenses.length === 0) return null;

    const totalGastos = expenses.reduce((a, t) => a + Math.abs(t.amount), 0);
    const totalIngresos = txs.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0);

    const catTotals: Record<string, number> = {};
    for (const tx of expenses) {
      catTotals[tx.category] = (catTotals[tx.category] || 0) + Math.abs(tx.amount);
    }
    const topCategorias = Object.entries(catTotals)
      .map(([nombre, total]) => ({
        nombre,
        total,
        porcentaje: Math.round((total / totalGastos) * 100),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);

    const [yearStr, monthStr] = args.month.split("-");
    const mes = MONTH_NAMES_ES[parseInt(monthStr ?? "1") - 1] ?? "mes";
    const año = parseInt(yearStr ?? "2026");

    const summary = {
      totalIngresos,
      totalGastos,
      ahorro: totalIngresos - totalGastos,
      mes,
      año,
      topCategorias,
    };

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    let insights: InsightRow[];
    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        messages: [{
          role: "user",
          content: `Eres un analizador financiero personal. Analiza estos datos del usuario para el mes de ${mes} ${año}:

RESUMEN: ${JSON.stringify(summary)}

Genera exactamente 3 insights sobre los datos. Cada insight debe ser concreto, usar números reales de los datos y tener máximo 120 caracteres.

Clasifica cada insight con uno de estos tipos:
- "warning": déficit, gasto muy por encima de la media, situación que requiere atención
- "trend": patrón detectado, comparativa con meses anteriores, tendencia de una categoría
- "suggestion": acción concreta que puede mejorar el ahorro

Responde ÚNICAMENTE con un array JSON válido, sin markdown, sin texto adicional, con este formato exacto:
[{"type":"warning","text":"..."},{"type":"trend","text":"..."},{"type":"suggestion","text":"..."}]`,
        }],
      });
      const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
      const parsed = JSON.parse(text) as InsightRow[];
      if (!Array.isArray(parsed) || parsed.length === 0) return null;
      insights = parsed;
    } catch {
      throw new Error("No se pudo generar el análisis. Inténtalo de nuevo.");
    }

    await ctx.runMutation(internal.insights.saveMonthInsights, {
      userId: args.userId,
      month: args.month,
      insights,
    });

    return insights;
  },
});

// Whole-period analysis for the Free plan: instead of one set of insights per
// month, a single global look at ALL the user's uploaded data. Stored in
// monthlyInsights under the sentinel month "all".
export const generatePeriodInsights = action({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx): Promise<InsightRow[] | null> => {
    const userId = await requireUserId(ctx);
    const allTxs: Doc<"transactions">[] = await ctx.runQuery(
      internal.transactions.getAllTransactionsInternal,
      { userId }
    );
    const txs = allTxs.filter((t) => t.excluded !== true);

    const expenses = txs.filter((t) => t.amount < 0);
    if (expenses.length === 0) return null;

    const totalGastos = expenses.reduce((a, t) => a + Math.abs(t.amount), 0);
    const totalIngresos = txs.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0);

    // Monthly breakdown so Claude can spot cross-month trends
    const monthMap = new Map<string, { ingresos: number; gastos: number }>();
    for (const tx of txs) {
      const m = tx.date.slice(0, 7);
      const entry = monthMap.get(m) ?? { ingresos: 0, gastos: 0 };
      if (tx.amount > 0) entry.ingresos += tx.amount;
      else entry.gastos += Math.abs(tx.amount);
      monthMap.set(m, entry);
    }
    const porMes = [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, v]) => ({
        mes,
        ingresos: Math.round(v.ingresos),
        gastos: Math.round(v.gastos),
      }));

    const catTotals: Record<string, number> = {};
    for (const tx of expenses) {
      catTotals[tx.category] = (catTotals[tx.category] || 0) + Math.abs(tx.amount);
    }
    const topCategorias = Object.entries(catTotals)
      .map(([nombre, total]) => ({
        nombre,
        total: Math.round(total),
        porcentaje: Math.round((total / totalGastos) * 100),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const subs = expenses.filter((t) => t.category === "Suscripciones");
    const totalSuscripciones = Math.round(subs.reduce((a, t) => a + Math.abs(t.amount), 0));

    const summary = {
      mesesAnalizados: porMes.length,
      periodo: `${porMes[0]?.mes} a ${porMes[porMes.length - 1]?.mes}`,
      totalIngresos: Math.round(totalIngresos),
      totalGastos: Math.round(totalGastos),
      ahorroTotal: Math.round(totalIngresos - totalGastos),
      porMes,
      topCategorias,
      totalSuscripciones,
    };

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    let insights: InsightRow[];
    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        messages: [{
          role: "user",
          content: `Eres un analizador financiero personal. Analiza TODO el período de datos del usuario (no un mes concreto):

RESUMEN DEL PERÍODO COMPLETO: ${JSON.stringify(summary)}

Genera exactamente 3 insights GLOBALES sobre sus patrones y tendencias a lo largo del período. Cada insight debe ser concreto, usar números reales de los datos y tener máximo 120 caracteres.

Clasifica cada insight con uno de estos tipos:
- "warning": déficit acumulado, categoría desproporcionada, situación que requiere atención
- "trend": patrón o tendencia detectada entre meses (gasto creciente/decreciente, estacionalidad)
- "suggestion": acción concreta que puede mejorar el ahorro de forma sostenida

Responde ÚNICAMENTE con un array JSON válido, sin markdown, sin texto adicional, con este formato exacto:
[{"type":"warning","text":"..."},{"type":"trend","text":"..."},{"type":"suggestion","text":"..."}]`,
        }],
      });
      const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
      const parsed = JSON.parse(text) as InsightRow[];
      if (!Array.isArray(parsed) || parsed.length === 0) return null;
      insights = parsed;
    } catch {
      throw new Error("No se pudo generar el análisis. Inténtalo de nuevo.");
    }

    await ctx.runMutation(internal.insights.saveMonthInsights, {
      userId,
      month: "all", // sentinel: whole-period insights (Free plan)
      insights,
    });

    return insights;
  },
});
