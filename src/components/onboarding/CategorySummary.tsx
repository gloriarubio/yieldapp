"use client";

import { useState } from "react";
import { getCategoryColor } from "@/lib/taxonomy";

export type CategorySummaryRow = {
  name: string;
  amount: number;
  count: number; // number of transactions in the category
  pct: number;
  bar: number; // 0-100 relative to the largest category
};

// Simplified version of the dashboard's CategoryRanking with inline renaming.
// Renames here are cosmetic — they're persisted with the rules on finish.
export function CategorySummary({
  rows,
  onRename,
}: {
  rows: CategorySummaryRow[];
  onRename: (from: string, to: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  function commit(name: string) {
    const next = draft.trim();
    setEditing(null);
    if (next && next !== name) onRename(name, next);
  }

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: "20px 22px",
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.6px",
          color: "var(--text3)",
          marginBottom: 14,
        }}
      >
        Tus gastos por categoría
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((row) => {
          const { color, trackColor } = getCategoryColor(row.name);
          const isEditing = editing === row.name;

          return (
            <div
              key={row.name}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 4px" }}
            >
              <span
                style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }}
              />

              {isEditing ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commit(row.name)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit(row.name);
                    if (e.key === "Escape") setEditing(null);
                  }}
                  style={{
                    width: 130,
                    flexShrink: 0,
                    fontSize: 12.5,
                    fontFamily: "inherit",
                    color: "var(--text)",
                    background: "var(--card2)",
                    border: "1px solid var(--border2)",
                    borderRadius: 6,
                    padding: "3px 8px",
                    outline: "none",
                  }}
                />
              ) : (
                <button
                  onClick={() => {
                    setEditing(row.name);
                    setDraft(row.name);
                  }}
                  title="Haz clic para renombrar"
                  style={{
                    width: 130,
                    flexShrink: 0,
                    textAlign: "left",
                    fontSize: 12.5,
                    fontFamily: "inherit",
                    color: "var(--text2)",
                    background: "none",
                    border: "none",
                    padding: "3px 0",
                    cursor: "text",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    borderBottom: "1px dashed transparent",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.borderBottom = "1px dashed var(--text3)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.borderBottom = "1px dashed transparent")
                  }
                >
                  {row.name}
                </button>
              )}

              <div
                style={{
                  flex: 1,
                  height: 6,
                  borderRadius: 100,
                  background: trackColor,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{ width: `${row.bar}%`, height: "100%", borderRadius: 100, background: color }}
                />
              </div>

              <span
                style={{
                  fontSize: 11.5,
                  color: "var(--text3)",
                  flexShrink: 0,
                  textAlign: "right",
                  minWidth: 56,
                }}
              >
                {row.count} {row.count === 1 ? "mov." : "movs."}
              </span>
              <span
                style={{
                  fontSize: 12.5,
                  color: "var(--text)",
                  fontWeight: 600,
                  flexShrink: 0,
                  textAlign: "right",
                  minWidth: 60,
                }}
              >
                {row.amount.toLocaleString("es-ES", { maximumFractionDigits: 0 })}€
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  color: "var(--text3)",
                  flexShrink: 0,
                  textAlign: "right",
                  minWidth: 30,
                }}
              >
                {row.pct}%
              </span>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 14 }}>
        Haz clic en el nombre de una categoría para renombrarla.
      </p>
    </div>
  );
}
