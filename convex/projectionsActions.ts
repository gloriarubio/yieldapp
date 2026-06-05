"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import Anthropic from "@anthropic-ai/sdk";
import {
  computeBaseline,
  computeCategoryStats,
  detectSubscriptions,
} from "../src/lib/projections";

// Claude evaluates the user's savings plan for FEASIBILITY: are the simulated
// cuts realistic given the spending history, and what better levers exist?
// The verdict is cached on the plan document (see projections.saveAiVerdict).
export const evaluateProjectionPlan = action({
  args: { userId: v.string() },
  handler: async (ctx, args): Promise<string> => {
    const [plan, allTxs]: [
      Doc<"projection_plans"> | null,
      Doc<"transactions">[]
    ] = await Promise.all([
      ctx.runQuery(internal.projections.getProjectionPlanInternal, { userId: args.userId }),
      ctx.runQuery(internal.transactions.getAllTransactionsInternal, { userId: args.userId }),
    ]);

    if (allTxs.length === 0) throw new Error("No hay transacciones que analizar");

    const baseline = computeBaseline(allTxs);
    const stats = computeCategoryStats(allTxs).slice(0, 8);
    const subs = detectSubscriptions(allTxs);

    const cuts = plan?.categoryCuts?.filter((c) => c.monthlyCut > 0) ?? [];
    const cancelled = plan?.cancelledSubscriptions ?? [];

    const summary = {
      mesesDeDatos: baseline.monthsCount,
      ahorroMensualTipico: Math.round(baseline.medianNet),
      ingresosTipicos: Math.round(baseline.medianIncome),
      gastosTipicos: Math.round(baseline.medianExpenses),
      meta: plan?.targetAmount
        ? { nombre: plan.goalName ?? "Meta", importe: plan.targetAmount, fecha: plan.targetDate ?? null }
        : null,
      recortesSimulados: cuts.map((c) => {
        const s = stats.find((x) => x.category === c.category);
        return {
          categoria: c.category,
          recorte: Math.round(c.monthlyCut),
          gastoTipico: Math.round(s?.median ?? 0),
          rango: s ? `${Math.round(s.p25)}-${Math.round(s.p75)}` : null,
          tendencia: s?.trend ?? "flat",
          comercioPrincipal: s?.topMerchant
            ? `${s.topMerchant.name} (${s.topMerchant.sharePct}% de la categoría)`
            : null,
        };
      }),
      suscripcionesCanceladasEnSimulacion: cancelled,
      suscripcionesActivas: subs
        .filter((s) => s.active)
        .map((s) => ({ nombre: s.name, mensual: Math.round(s.monthlyAmount * 100) / 100 })),
      categoriasPrincipales: stats.slice(0, 6).map((s) => ({
        categoria: s.category,
        medianaMensual: Math.round(s.median),
        tendencia: s.trend,
      })),
    };

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      messages: [{
        role: "user",
        content: `Eres un asesor financiero personal directo y práctico. Evalúa la VIABILIDAD del plan de ahorro de este usuario español:

${JSON.stringify(summary)}

Responde en 3-4 frases cortas (máx 400 caracteres en total), en segunda persona, concretas y con números reales de los datos:
1. ¿Son realistas los recortes simulados comparados con su gasto típico y tendencia? Si un recorte supera el 40% del gasto típico de la categoría, dilo claramente.
2. Señala la palanca MÁS fácil que no esté usando (suscripciones activas sin cancelar, comercio dominante de una categoría...).
3. Si hay meta, valora si llegará y qué cambiaría.

Sin saludos, sin markdown, sin listas — solo el texto del veredicto.`,
      }],
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
    if (!text) throw new Error("No se pudo generar el análisis");

    await ctx.runMutation(internal.projections.saveAiVerdict, {
      userId: args.userId,
      text,
    });

    return text;
  },
});
