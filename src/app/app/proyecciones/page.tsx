"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { useTaxonomy } from "@/hooks/useTaxonomy";

const projections = [
  { period: "3 meses",  months: 3 },
  { period: "6 meses",  months: 6 },
  { period: "12 meses", months: 12 },
];

function fmt(n: number) {
  return Math.round(n).toLocaleString("es-ES");
}

export default function ProyeccionesPage() {
  const [userId, setUserId] = useState<string | null>(null);
  // Slider overrides per category — anything not overridden sits at its real
  // monthly average (no simulated saving)
  const [spending, setSpending] = useState<Record<string, number>>({});
  const { getColor } = useTaxonomy(userId);

  useEffect(() => {
    authClient.getSession().then(({ data }) => setUserId(data?.user?.id ?? null));
  }, []);

  const rawTransactions = useQuery(
    api.transactions.listTransactions,
    userId ? { userId } : "skip"
  );
  // Las proyecciones interactivas son una función Pro
  const subscription = useQuery(
    api.subscriptions.getSubscription,
    userId ? { userId } : "skip"
  );

  // ── Real baseline from the user's data ─────────────────────────────────────
  const stats = useMemo(() => {
    if (!rawTransactions) return null;
    const txs = rawTransactions.filter((t) => t.excluded !== true);
    if (txs.length === 0) return null;

    // Months with data — averages are per month actually observed
    const months = new Set(txs.map((t) => t.date.slice(0, 7)));
    const monthsCount = Math.max(1, months.size);

    const totalIncome = txs.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0);
    const totalExpenses = txs.filter((t) => t.amount < 0).reduce((a, t) => a + Math.abs(t.amount), 0);

    // Average monthly spend per category (expenses only)
    const catTotals = new Map<string, number>();
    for (const t of txs) {
      if (t.amount >= 0) continue;
      catTotals.set(t.category, (catTotals.get(t.category) ?? 0) + Math.abs(t.amount));
    }
    const categories = [...catTotals.entries()]
      .map(([name, total]) => ({ name, avg: Math.round(total / monthsCount) }))
      .filter((c) => c.avg >= 5) // categories too small to matter just add noise
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 10);

    return {
      monthsCount,
      baselineMonthly: (totalIncome - totalExpenses) / monthsCount,
      categories,
    };
  }, [rawTransactions]);

  if (!userId || rawTransactions === undefined || subscription === undefined) {
    return <div style={{ color: "var(--text3)", fontSize: 13, padding: 20 }}>Cargando…</div>;
  }

  if (subscription.plan === "free") {
    return (
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border2)",
          borderRadius: 14,
          padding: "56px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          textAlign: "center",
          maxWidth: 560,
          margin: "40px auto 0",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: "var(--card2)",
            border: "1px solid var(--border2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text2)",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="4" y="9" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7 9V6.5a3 3 0 016 0V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <p style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", margin: 0 }}>
          Las proyecciones interactivas son una función Pro
        </p>
        <p style={{ fontSize: 13, color: "var(--text2)", margin: 0, maxWidth: 380 }}>
          Simula recortes por categoría con tus datos reales y descubre cuánto
          podrías ahorrar en 3, 6 y 12 meses.
        </p>
        <a
          href="/app/ajustes?tab=suscripcion"
          style={{
            background: "var(--accent)",
            color: "#fff",
            borderRadius: 9,
            padding: "10px 22px",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            marginTop: 4,
          }}
        >
          Activar Pro — 7€/mes
        </a>
      </div>
    );
  }

  if (!stats || stats.categories.length === 0) {
    return (
      <div style={{ color: "var(--text3)", fontSize: 14, padding: "40px 0", textAlign: "center" }}>
        Sube un extracto bancario para ver tus proyecciones de ahorro.
      </div>
    );
  }

  const sim = spending;
  const extraSavingsMonthly = stats.categories.reduce(
    (a, c) => a + (c.avg - (sim[c.name] ?? c.avg)),
    0
  );
  const projectedMonthly = stats.baselineMonthly + extraSavingsMonthly;
  const extraSavingsAnnual = extraSavingsMonthly * 12;
  const totalAnnual = projectedMonthly * 12;
  const isPositive = totalAnnual >= 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Projection cards — real average monthly savings × horizon */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
        {projections.map((p) => {
          const value = projectedMonthly * p.months;
          const positive = value >= 0;
          return (
            <div
              key={p.period}
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "22px 20px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 500,
                  letterSpacing: "-1.5px",
                  color: positive ? "var(--text)" : "var(--red)",
                  marginBottom: 6,
                  fontFamily: "var(--font-playfair), Georgia, serif",
                }}
              >
                {positive ? "+" : "−"}{fmt(Math.abs(value))}€
              </div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 2 }}>{p.period}</div>
              <div style={{ fontSize: 11, color: "var(--text3)" }}>
                {extraSavingsMonthly > 0 ? "con los ajustes del simulador" : "si mantienes este ritmo"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Simulator */}
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "20px 24px",
        }}
      >
        <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text3)", marginBottom: 4 }}>
          Simulador de ahorro
        </div>
        <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 22 }}>
          Cada categoría parte de tu gasto medio mensual real
          {stats.monthsCount > 1 ? ` (media de ${stats.monthsCount} meses)` : ""}.
          Mueve los sliders hacia la izquierda para simular cuánto ahorrarías reduciéndola.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {stats.categories.map((c) => {
            const current = sim[c.name] ?? c.avg;
            const saving = c.avg - current;
            const { color } = getColor(c.name);
            return (
              <div key={c.name}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 500, color: "var(--text)" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    {c.name}
                  </span>
                  <span style={{ fontSize: 12.5 }}>
                    <strong style={{ color: "var(--text)" }}>{fmt(current)}€/mes</strong>
                    {saving > 0 && (
                      <span style={{ color: "var(--green)", marginLeft: 10, fontWeight: 500 }}>
                        −{fmt(saving)}€ ahorro
                      </span>
                    )}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10.5, color: "var(--text3)", flexShrink: 0, minWidth: 34 }}>
                    0€
                  </span>
                  {/* step=1: with step=5 a non-multiple max (e.g. 487€) was
                      unreachable and the slider never filled to the end */}
                  <input
                    type="range"
                    min={0}
                    max={c.avg}
                    step={1}
                    value={current}
                    onChange={(e) =>
                      setSpending((s) => ({ ...s, [c.name]: Number(e.target.value) }))
                    }
                    style={{ flex: 1, accentColor: "var(--accent)" }}
                  />
                  <span style={{ fontSize: 10.5, color: "var(--text3)", flexShrink: 0, minWidth: 40, textAlign: "right" }}>
                    {fmt(c.avg)}€
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Result */}
        <div
          style={{
            marginTop: 24,
            padding: "16px 20px",
            background: isPositive ? "rgba(26,110,60,0.07)" : "var(--red-dim)",
            border: isPositive ? "1px solid rgba(26,110,60,0.2)" : "1px solid rgba(168,48,48,0.25)",
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 6 }}>
            {extraSavingsAnnual > 0
              ? "Si aplicas estos ajustes, en un año ahorrarás"
              : isPositive
                ? "Con tus hábitos actuales, en un año ahorrarás"
                : "Con tus hábitos actuales, en un año gastarás de más"}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span
              style={{
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: "-1.5px",
                color: isPositive ? "var(--green)" : "var(--red)",
                fontFamily: "var(--font-playfair), Georgia, serif",
              }}
            >
              {isPositive ? "+" : "−"}{fmt(Math.abs(totalAnnual))}€
            </span>
            {extraSavingsAnnual > 0 && (
              <span style={{ fontSize: 12.5, color: "var(--green)", fontWeight: 500 }}>
                (+{fmt(extraSavingsAnnual)}€ extra)
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
