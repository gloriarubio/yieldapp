"use client";

const R = 54, CX = 80, CY = 80, SW = 22;
const CIRC = 2 * Math.PI * R;

type CategoryData = { label: string; pct: number; color: string };

export function DonutChart({ categories, month }: { categories: CategoryData[]; month: string }) {
  let cum = 0;
  const segments = categories.map((c) => {
    const len = (c.pct / 100) * CIRC;
    const offset = -(cum / 100) * CIRC;
    cum += c.pct;
    return { ...c, len, offset };
  });

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "18px 20px",
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text3)", marginBottom: 4 }}>
        Gastos por categoría
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text3)", marginBottom: 14 }}>
        % del total de gastos del mes
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
        <svg viewBox="0 0 160 160" style={{ width: "38%", flexShrink: 0, minWidth: 0, display: "block" }}>
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(230,220,205,0.06)" strokeWidth={SW} />
          {segments.map((s, i) => (
            <circle
              key={i} cx={CX} cy={CY} r={R} fill="none"
              stroke={s.color} strokeWidth={SW}
              strokeDasharray={`${s.len.toFixed(2)} ${CIRC.toFixed(2)}`}
              strokeDashoffset={s.offset.toFixed(2)}
              transform={`rotate(-90 ${CX} ${CY})`}
            />
          ))}
          <text x={CX} y={CY + 4} textAnchor="middle" fontSize="13" fontWeight="500" fill="rgba(230,220,205,0.5)">
            {month}
          </text>
        </svg>

        <div style={{ flex: 1, minWidth: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 10px" }}>
          {categories.map((c) => (
            <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--text2)", minWidth: 0 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.label} <span style={{ color: "var(--text3)" }}>{c.pct}%</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
