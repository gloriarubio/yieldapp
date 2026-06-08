"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { subscriptionIsPro } from "./subscriptionHelpers";
import Anthropic from "@anthropic-ai/sdk";

// Conversational assistant (Pro). Answers free-form questions about the user's
// own finances. We never send raw transactions to Claude — instead we build a
// compact aggregated summary that covers the kinds of questions asked
// (category trends across months, largest single expense, best/worst month,
// top merchants, subscriptions) and let Claude reason over it.

const r = Math.round;

type HistoryMsg = { role: "user" | "assistant"; text: string };

// Builds the compact financial context from the user's transactions.
function buildContext(txs: Doc<"transactions">[]) {
  const expenses = txs.filter((t) => t.amount < 0);
  const incomes = txs.filter((t) => t.amount > 0);

  const totalGastos = expenses.reduce((a, t) => a + Math.abs(t.amount), 0);
  const totalIngresos = incomes.reduce((a, t) => a + t.amount, 0);

  // Per-month income / expense / savings (sorted, last 24 months max)
  const monthMap = new Map<string, { ingresos: number; gastos: number }>();
  for (const tx of txs) {
    const m = tx.date.slice(0, 7);
    const e = monthMap.get(m) ?? { ingresos: 0, gastos: 0 };
    if (tx.amount > 0) e.ingresos += tx.amount;
    else e.gastos += Math.abs(tx.amount);
    monthMap.set(m, e);
  }
  const months = [...monthMap.keys()].sort().slice(-24);
  const porMes = months.map((mes) => {
    const e = monthMap.get(mes)!;
    return {
      mes,
      ingresos: r(e.ingresos),
      gastos: r(e.gastos),
      ahorro: r(e.ingresos - e.gastos),
    };
  });

  // Category × month matrix (expenses only) — for rising/falling questions
  const catMonth = new Map<string, Map<string, number>>();
  const catTotal = new Map<string, number>();
  for (const tx of expenses) {
    const m = tx.date.slice(0, 7);
    if (!months.includes(m)) continue;
    const row = catMonth.get(tx.category) ?? new Map();
    row.set(m, (row.get(m) ?? 0) + Math.abs(tx.amount));
    catMonth.set(tx.category, row);
    catTotal.set(tx.category, (catTotal.get(tx.category) ?? 0) + Math.abs(tx.amount));
  }
  const categoriasPorMes = [...catTotal.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([categoria, total]) => {
      const row = catMonth.get(categoria)!;
      const porMes: Record<string, number> = {};
      for (const m of months) if (row.has(m)) porMes[m] = r(row.get(m)!);
      return { categoria, total: r(total), porMes };
    });

  // Largest single expenses (top 10)
  const topGastosUnicos = [...expenses]
    .sort((a, b) => a.amount - b.amount) // most negative first
    .slice(0, 10)
    .map((t) => ({
      fecha: t.date,
      descripcion: t.description,
      importe: r(Math.abs(t.amount)),
      categoria: t.category,
    }));

  // Top merchants by total spend (grouped by normalized pattern)
  const merchMap = new Map<string, { total: number; n: number }>();
  for (const tx of expenses) {
    const key = tx.merchantPattern ?? tx.merchant ?? tx.description;
    const e = merchMap.get(key) ?? { total: 0, n: 0 };
    e.total += Math.abs(tx.amount);
    e.n += 1;
    merchMap.set(key, e);
  }
  const topComercios = [...merchMap.entries()]
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 10)
    .map(([comercio, e]) => ({ comercio, total: r(e.total), operaciones: e.n }));

  const subs = expenses.filter((t) => t.category === "Suscripciones");
  const suscripciones = r(subs.reduce((a, t) => a + Math.abs(t.amount), 0));

  return {
    moneda: "EUR",
    periodo: porMes.length ? `${porMes[0].mes} a ${porMes[porMes.length - 1].mes}` : "",
    mesesAnalizados: porMes.length,
    totales: {
      ingresos: r(totalIngresos),
      gastos: r(totalGastos),
      ahorro: r(totalIngresos - totalGastos),
    },
    porMes,
    categoriasPorMes,
    topGastosUnicos,
    topComercios,
    totalSuscripciones: suscripciones,
  };
}

export const ask = action({
  args: {
    userId: v.string(),
    question: v.string(),
    history: v.optional(
      v.array(
        v.object({
          role: v.union(v.literal("user"), v.literal("assistant")),
          text: v.string(),
        })
      )
    ),
  },
  handler: async (ctx, args): Promise<string> => {
    // The conversational assistant is a Pro feature — enforce server-side too.
    const sub = await ctx.runQuery(internal.subscriptions.getSubscriptionInternal, {
      userId: args.userId,
    });
    if (!subscriptionIsPro(sub)) {
      return "El asistente es una función Pro. Actívala para preguntar sobre tus finanzas con tus números reales.";
    }

    const allTxs: Doc<"transactions">[] = await ctx.runQuery(
      internal.transactions.getAllTransactionsInternal,
      { userId: args.userId }
    );
    const txs = allTxs.filter((t) => t.excluded !== true);
    if (txs.length === 0) {
      return "Todavía no tienes transacciones cargadas. Sube un extracto y podré responderte sobre tus finanzas.";
    }

    const context = buildContext(txs);

    const system = `Eres el asistente financiero de Yield. Respondes preguntas del usuario sobre SUS finanzas personales usando EXCLUSIVAMENTE el resumen de datos que se te proporciona.

Reglas:
- Responde en español, con tono cercano, claro y directo.
- Usa SIEMPRE números reales del resumen, en euros con el símbolo €. Redondea a euros enteros.
- Sé conciso: normalmente 2 a 5 frases. Usa una lista corta solo si aclara la respuesta.
- Para tendencias compara los meses disponibles en "categoriasPorMes" / "porMes".
- Si la pregunta no se puede responder con estos datos, dilo con franqueza y di qué dato faltaría. No inventes cifras ni transacciones.
- Todos los importes de gasto del resumen ya están en valor absoluto (positivos).

DATOS DEL USUARIO (resumen agregado de sus transacciones):
${JSON.stringify(context)}`;

    // Last 8 turns, trimmed so the sequence sent to Claude starts with a user
    // message (the Anthropic API requires user/assistant to alternate from user).
    let history: HistoryMsg[] = (args.history ?? []).slice(-8);
    while (history.length && history[0].role === "assistant") history = history.slice(1);
    const messages = [
      ...history.map((m) => ({ role: m.role, content: m.text })),
      { role: "user" as const, content: args.question },
    ];

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 700,
        system,
        messages,
      });
      const text =
        response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
      return text || "No he podido generar una respuesta. Inténtalo de nuevo.";
    } catch {
      throw new Error("No se pudo contactar con el asistente. Inténtalo de nuevo.");
    }
  },
});
