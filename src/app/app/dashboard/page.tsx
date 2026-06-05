"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { useMonth } from "@/components/app/MonthContext";
import { useTaxonomy } from "@/hooks/useTaxonomy";
import { KpiCard } from "@/components/app/dashboard/KpiCard";
import { CategoryRanking, type CategoryRow } from "@/components/app/dashboard/CategoryRanking";
import { BarChart } from "@/components/app/dashboard/BarChart";
import { SubscriptionsWidget } from "@/components/app/dashboard/SubscriptionsWidget";
import { DayHeatmap } from "@/components/app/dashboard/DayHeatmap";
import { MonthInsights } from "@/components/app/dashboard/MonthInsights";

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return mobile;
}

const MONTH_NAMES_SHORT = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

function fmt(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function pctChange(current: number, prev: number) {
  if (prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

function formatChangeDelta(change: number | null): string | null {
  if (change === null) return null;
  const abs = Math.abs(change);
  if (abs > 200) return `> ${change > 0 ? "+" : "-"}200% vs mes anterior`;
  return `${change >= 0 ? "↑" : "↓"} ${abs.toFixed(1)}% vs mes anterior`;
}

function formatSavingsDelta(income: number, expenses: number, savings: number): string | null {
  if (income === 0) return null;
  if (savings >= 0) {
    return `Ahorras el ${((savings / income) * 100).toFixed(1)}% de tus ingresos`;
  }
  const ratio = (expenses / income).toFixed(2).replace(".", ",");
  return `Gastas ${ratio}€ por cada euro que ingresas`;
}

function sum(txs: { amount: number }[], sign: "pos" | "neg") {
  return txs
    .filter((t) => (sign === "pos" ? t.amount > 0 : t.amount < 0))
    .reduce((a, t) => a + Math.abs(t.amount), 0);
}

function prevMonthString(monthString: string) {
  const [y, m] = monthString.split("-").map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

function buildCategoryRanking(
  expenses: { category: string; amount: number }[],
  getColor: (name: string) => { color: string; trackColor: string }
): CategoryRow[] {
  const totals: Record<string, number> = {};
  for (const tx of expenses) {
    totals[tx.category] = (totals[tx.category] || 0) + Math.abs(tx.amount);
  }
  const total = Object.values(totals).reduce((a, v) => a + v, 0);
  if (total === 0) return [];

  // "Otros" is always the last row — it's not eligible for the top 5.
  // Any named categories beyond the top 5 are also folded into "Otros".
  const othersBase = totals["Otros"] ?? 0;
  const named = Object.entries(totals)
    .filter(([label]) => label !== "Otros")
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => b.amount - a.amount);

  const top5 = named.slice(0, 5);
  const othersAmount = othersBase + named.slice(5).reduce((a, c) => a + c.amount, 0);

  const allAmounts = top5.map((c) => c.amount);
  if (othersAmount > 0) allAmounts.push(othersAmount);
  const maxAmount = Math.max(...allAmounts, 1);

  const rows: CategoryRow[] = top5.map((c) => {
    const { color, trackColor } = getColor(c.label);
    return {
      label: c.label,
      amount: c.amount,
      pct: Math.round((c.amount / total) * 100),
      bar: Math.round((c.amount / maxAmount) * 100),
      color,
      trackColor,
    };
  });

  if (othersAmount > 0) {
    const { color, trackColor } = getColor("Otros");
    rows.push({
      label: "Otros",
      amount: othersAmount,
      pct: Math.round((othersAmount / total) * 100),
      bar: Math.round((othersAmount / maxAmount) * 100),
      color,
      trackColor,
    });
  }

  return rows;
}

function EmptyDashboard() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 520, textAlign: "center" }}>
      <div style={{ width: 72, height: 72, borderRadius: 20, background: "var(--green-dim)", border: "1px solid rgba(26,110,60,0.18)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 28, color: "var(--green)" }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path d="M12 16V4M8 8l4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M3 16v2a2 2 0 002 2h14a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      </div>
      <h2 style={{ fontSize: 30, fontWeight: 500, letterSpacing: "-0.8px", color: "var(--text)", marginBottom: 14, lineHeight: 1.2, fontFamily: "var(--font-playfair), Georgia, serif" }}>
        Sube tu primer extracto bancario
      </h2>
      <p style={{ fontSize: 15, color: "var(--text2)", maxWidth: 400, lineHeight: 1.65, marginBottom: 32 }}>
        En menos de 2 minutos sabrás exactamente en qué gastas tu dinero, cuánto ahorras y cómo mejorar tus finanzas.
      </p>
      <Link href="/app/extractos" style={{ display: "inline-flex", alignItems: "center", gap: 9, background: "var(--accent)", color: "#fff", padding: "13px 28px", borderRadius: 100, fontSize: 14, fontWeight: 600, textDecoration: "none", letterSpacing: "-0.1px", marginBottom: 36 }}>
        Subir extracto
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </Link>
      <div style={{ display: "flex", gap: 28, fontSize: 12.5, color: "var(--text3)" }}>
        {["PDF, Excel o CSV", "Todos los bancos", "Tus datos, siempre privados"].map((t) => (
          <span key={t} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "var(--green)", fontWeight: 600 }}>✓</span>{t}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const { monthString, monthIdx, year, setMonth } = useMonth();
  const isMobile = useIsMobile();
  const { getColor } = useTaxonomy(userId);

  useEffect(() => {
    authClient.getSession().then(({ data }) => setUserId(data?.user?.id ?? null));
  }, []);

  const rawTransactions = useQuery(
    api.transactions.listTransactions,
    userId ? { userId } : "skip"
  );

  // User-excluded transactions don't take part in the dashboard or analyses
  const transactions = useMemo(
    () => rawTransactions?.filter((t) => t.excluded !== true),
    [rawTransactions]
  );

  // Free plan: one global analysis over the whole period (sentinel month
  // "all"); Pro: per-month insights for the selected month
  const subscription = useQuery(
    api.subscriptions.getSubscription,
    userId ? { userId } : "skip"
  );
  const periodInsightsMode = subscription?.plan === "free";

  // Per-month AI insights (generated on demand for the selected month)
  const monthInsights = useQuery(
    api.insights.getMonthInsights,
    userId && subscription !== undefined
      ? { userId, month: periodInsightsMode ? "all" : monthString }
      : "skip"
  );

  // If the selected month has no data, jump to the most recent month that does
  const availableMonths = useMemo(() => {
    if (!transactions?.length) return [];
    return [...new Set(transactions.map((t) => t.date.slice(0, 7)))].sort().reverse();
  }, [transactions]);

  useEffect(() => {
    if (!availableMonths.length) return;
    if (!availableMonths.includes(monthString)) {
      const [y, m] = availableMonths[0].split("-").map(Number);
      setMonth(m - 1, y);
    }
  }, [availableMonths, monthString, setMonth]);

  if (!userId || transactions === undefined) {
    return <div style={{ color: "var(--text3)", fontSize: 13, padding: 20 }}>Cargando…</div>;
  }

  if (transactions.length === 0) return <EmptyDashboard />;

  // ── Filter by selected month ───────────────────────────────────────────────
  const prevMonth = prevMonthString(monthString);
  const thisTx = transactions.filter((t) => t.date.startsWith(monthString));
  const prevTx  = transactions.filter((t) => t.date.startsWith(prevMonth));

  const income   = sum(thisTx, "pos");
  const expenses = sum(thisTx, "neg");
  const savings  = income - expenses;

  const prevIncome   = sum(prevTx, "pos");
  const prevExpenses = sum(prevTx, "neg");
  const incomeChange  = pctChange(income, prevIncome);
  const expenseChange = pctChange(expenses, prevExpenses);

  const kpis = [
    {
      label: "Ingresos",
      value: `${fmt(income)}€`,
      delta: formatChangeDelta(incomeChange),
      positive: (incomeChange ?? 0) >= 0,
    },
    {
      label: "Gastos",
      value: `${fmt(expenses)}€`,
      delta: formatChangeDelta(expenseChange),
      positive: (expenseChange ?? 0) <= 0,
    },
    {
      label: "Ahorro neto",
      value: `${fmt(savings)}€`,
      delta: formatSavingsDelta(income, expenses, savings),
      positive: savings >= 0,
      accent: true,
    },
  ];

  // ── Category ranking ──────────────────────────────────────────────────────
  const categoryRows = buildCategoryRanking(thisTx.filter((t) => t.amount < 0), getColor);

  // ── Bar chart: 6 months ending at selected month ──────────────────────────
  const barData = Array.from({ length: 6 }, (_, i) => {
    const offset = 5 - i;
    let m = monthIdx - offset;
    let y = year;
    while (m < 0) { m += 12; y--; }
    const prefix = `${y}-${String(m + 1).padStart(2, "0")}`;
    const mTx = transactions.filter((t) => t.date.startsWith(prefix));
    return { month: MONTH_NAMES_SHORT[m], income: sum(mTx, "pos"), expenses: sum(mTx, "neg") };
  });

  // ── Subscriptions: current month only, enriched with all-time payment count ─
  const thisMonthSubMap = new Map<string, { amount: number; date: string }>();
  for (const tx of thisTx.filter((t) => t.category === "Suscripciones" && t.amount < 0)) {
    const name = tx.merchant || tx.description;
    if (!thisMonthSubMap.has(name)) {
      thisMonthSubMap.set(name, { amount: Math.abs(tx.amount), date: tx.date });
    }
  }
  const allSubTxs = transactions.filter((t) => t.category === "Suscripciones" && t.amount < 0);
  const subs = [...thisMonthSubMap.entries()]
    .map(([name, { amount, date }]) => ({
      name,
      amount,
      lastPaymentDate: date,
      totalPayments: allSubTxs.filter((t) => (t.merchant || t.description) === name).length,
    }))
    .sort((a, b) => b.amount - a.amount);
  const hasAnySubs = subs.length > 0;

  // No-data state for selected month
  if (thisTx.length === 0) {
    return (
      <div style={{ color: "var(--text3)", fontSize: 14, padding: "60px 0", textAlign: "center" }}>
        Sin datos para este mes. Usa las flechas del encabezado para navegar a un mes con transacciones.
      </div>
    );
  }

  // ── Insights — strictly per selected month ────────────────────────────────
  const insights = monthInsights === undefined ? undefined : (monthInsights?.insights ?? null);

  // alignItems stretch keeps heights identical; minmax(0,1fr) keeps widths
  // identical — plain "1fr" means minmax(auto,1fr), so a long unbreakable
  // text (e.g. a subscription name) widens its column and shrinks the sibling
  const g3 = { display: "grid", gridTemplateColumns: isMobile ? "minmax(0,1fr)" : "repeat(3, minmax(0,1fr))", gap: 14, alignItems: "stretch" } as const;
  const g2 = { display: "grid", gridTemplateColumns: isMobile ? "minmax(0,1fr)" : "minmax(0,1fr) minmax(0,1fr)", gap: 14, alignItems: "stretch" } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Row 1 — KPIs */}
      <div style={g3}>
        {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* Row 2 — Categorías + Suscripciones */}
      <div style={g2}>
        <CategoryRanking rows={categoryRows} />
        <SubscriptionsWidget subs={subs} />
      </div>

      {/* Row 3 — Calendario + Insights IA */}
      <div style={g2}>
        <DayHeatmap month={monthString} transactions={thisTx} />
        <MonthInsights
          insights={insights}
          month={monthString}
          hasData={thisTx.length > 0}
          userId={userId}
          period={periodInsightsMode}
        />
      </div>

      {/* Separador visual */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0" }}>
        <div style={{ flex: 1, height: "0.5px", background: "var(--border2)" }} />
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text3)" }}>
          Tendencias
        </span>
        <div style={{ flex: 1, height: "0.5px", background: "var(--border2)" }} />
      </div>

      {/* Row 4 — Evolución histórica (ancho completo) */}
      <BarChart data={barData} />

    </div>
  );
}
