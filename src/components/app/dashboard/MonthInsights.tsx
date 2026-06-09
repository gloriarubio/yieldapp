"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";

type InsightType = "warning" | "trend" | "suggestion";
type Insight = { type: InsightType; text: string };

function InsightIcon({ type }: { type: InsightType }) {
  if (type === "warning") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
        <path d="M7 1.5L12.5 11.5H1.5L7 1.5Z" stroke="var(--red)" strokeWidth="1.3" strokeLinejoin="round" />
        <line x1="7" y1="5.5" x2="7" y2="8" stroke="var(--red)" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="7" cy="9.5" r="0.6" fill="var(--red)" />
      </svg>
    );
  }
  if (type === "trend") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
        <path d="M1.5 10L5 6.5L8 8.5L12.5 3" stroke="var(--accent)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9.5 3H12.5V6" stroke="var(--accent)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="7" cy="7" r="5" stroke="var(--green)" strokeWidth="1.3" />
      <path d="M5.5 6C5.5 5.17 6.17 4.5 7 4.5C7.83 4.5 8.5 5.17 8.5 6C8.5 6.55 8.2 7.03 7.75 7.3L7 7.75V8.5" stroke="var(--green)" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="7" cy="10" r="0.6" fill="var(--green)" />
    </svg>
  );
}

function insightTrack(type: InsightType): string {
  if (type === "warning") return "var(--red-dim)";
  if (type === "trend") return "rgba(30,61,44,0.07)";
  return "var(--green-dim)";
}

function SkeletonRow() {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ width: 24, height: 24, borderRadius: 6, background: "var(--border2)", flexShrink: 0 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ height: 11, borderRadius: 6, background: "var(--border2)", width: "75%" }} />
        <div style={{ height: 11, borderRadius: 6, background: "var(--border)", width: "50%" }} />
      </div>
    </div>
  );
}

type Props = {
  insights: Insight[] | null | undefined;
  /** Selected month, "YYYY-MM" — insights are generated for this month only */
  month: string;
  /** Whether the selected month has any transactions */
  hasData: boolean;
  userId: string;
  /**
   * Free plan: one global analysis over the WHOLE uploaded period instead of
   * per-month insights (stored under the sentinel month "all")
   */
  period?: boolean;
};

export function MonthInsights({ insights, month, hasData, userId, period = false }: Props) {
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const generateMonth = useAction(api.insightsActions.generateMonthInsights);
  const generatePeriod = useAction(api.insightsActions.generatePeriodInsights);

  async function handleGenerate() {
    setGenerating(true);
    setGenError(null);
    try {
      // The dashboard's getMonthInsights subscription picks up the result
      if (period) await generatePeriod({});
      else await generateMonth({ month });
    } catch {
      setGenError("Error al generar. Inténtalo de nuevo.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "18px 20px",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        height: "100%", // always match the sibling card in the grid row
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text3)" }}>
          {period ? "Análisis del período" : "Insights del mes"}
        </span>
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: "0.5px",
            color: "var(--accent)",
            background: "rgba(30,61,44,0.09)",
            border: "1px solid rgba(30,61,44,0.18)",
            padding: "1px 6px",
            borderRadius: 100,
            textTransform: "uppercase",
          }}
        >
          IA
        </span>
      </div>

      {/* Loading skeleton */}
      {insights === undefined && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      )}

      {/* No insights yet */}
      {insights === null && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            padding: "16px 0",
            flex: 1,
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 13, color: "var(--text3)", textAlign: "center", lineHeight: 1.5 }}>
            {hasData
              ? period
                ? "Genera un análisis global de tus patrones y tendencias en todo el período."
                : "No hay análisis generado para este mes."
              : "Sube un extracto para ver el análisis del mes."}
          </span>
          {hasData && (
            <>
              <button
                onClick={handleGenerate}
                disabled={generating}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "var(--accent)",
                  color: "#fff",
                  padding: "8px 18px",
                  borderRadius: 100,
                  fontSize: 12.5,
                  fontWeight: 600,
                  border: "none",
                  cursor: generating ? "wait" : "pointer",
                  opacity: generating ? 0.7 : 1,
                  fontFamily: "inherit",
                  letterSpacing: "-0.1px",
                  transition: "opacity 0.15s",
                }}
              >
                {generating ? "Generando…" : "Generar análisis"}
              </button>
              {genError && (
                <span style={{ fontSize: 12, color: "var(--red)" }}>{genError}</span>
              )}
            </>
          )}
        </div>
      )}

      {/* Insights list */}
      {Array.isArray(insights) && insights.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {insights.map((ins, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                padding: "9px 10px",
                borderRadius: 8,
                background: insightTrack(ins.type),
              }}
            >
              <span style={{ marginTop: 2 }}>
                <InsightIcon type={ins.type} />
              </span>
              <span style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.55 }}>
                {ins.text}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
