"use client";

import { useRouter } from "next/navigation";

export type CategoryRow = {
  label: string;
  amount: number;
  pct: number;
  bar: number; // 0-100, relative to the row with highest amount
  color: string;
  trackColor: string;
};

export function CategoryRanking({ rows }: { rows: CategoryRow[] }) {
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "18px 20px",
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 168,
          height: "100%", // always match the sibling card in the grid row
        }}
      >
        <span style={{ fontSize: 13, color: "var(--text3)" }}>
          Sin gastos registrados este mes
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "18px 20px",
        minWidth: 0,
        height: "100%", // always match the sibling card in the grid row
        display: "flex",
        flexDirection: "column",
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
        Gastos por categoría
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {rows.map((row) => (
          <button
            key={row.label}
            onClick={() =>
              router.push(`/app/transacciones?cat=${encodeURIComponent(row.label)}`)
            }
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "none",
              border: "none",
              padding: "7px 8px",
              borderRadius: 8,
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
              transition: "background 0.15s",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.background = "var(--card2)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.background = "transparent")
            }
          >
            {/* Color dot */}
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: row.color,
                flexShrink: 0,
              }}
            />

            {/* Category name */}
            <span
              style={{
                fontSize: 12.5,
                color: "var(--text2)",
                width: 90,
                flexShrink: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                textAlign: "left",
              }}
            >
              {row.label}
            </span>

            {/* Progress bar */}
            <div
              style={{
                flex: 1,
                height: 6,
                borderRadius: 100,
                background: row.trackColor,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${row.bar}%`,
                  height: "100%",
                  borderRadius: 100,
                  background: row.color,
                }}
              />
            </div>

            {/* Amount */}
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
              {row.amount.toLocaleString("es-ES", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
              €
            </span>

            {/* Percentage */}
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
          </button>
        ))}
      </div>
    </div>
  );
}
