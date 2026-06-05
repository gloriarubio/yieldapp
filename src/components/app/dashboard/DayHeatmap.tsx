"use client";

const MONTH_NAMES_ES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

function fmtEur(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

type Props = {
  /** Selected month, "YYYY-MM" */
  month: string;
  /** Transactions of the selected month (already filtered by the dashboard) */
  transactions: { date: string; amount: number }[];
};

// Calendar heatmap of real daily spending for the selected month.
export function DayHeatmap({ month, transactions }: Props) {
  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr);
  const monthIdx = parseInt(monthStr) - 1; // 0-based

  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  // Monday-based offset of the 1st of the month (getDay(): 0 = Sunday)
  const offset = (new Date(year, monthIdx, 1).getDay() + 6) % 7;

  // Sum of expenses per day of the month
  const spendPerDay: Record<number, number> = {};
  for (const tx of transactions) {
    if (tx.amount >= 0 || !tx.date.startsWith(month)) continue;
    const day = parseInt(tx.date.slice(8, 10));
    if (!day) continue;
    spendPerDay[day] = (spendPerDay[day] ?? 0) + Math.abs(tx.amount);
  }
  const maxSpend = Math.max(0, ...Object.values(spendPerDay));

  // Intensity relative to the heaviest day of the month
  function heatColor(spend: number): string {
    if (!spend || maxSpend === 0) return "var(--border)";
    const r = spend / maxSpend;
    if (r <= 0.25) return "rgba(26,110,60,0.15)";
    if (r <= 0.5) return "rgba(26,110,60,0.35)";
    if (r <= 0.75) return "rgba(168,48,48,0.25)";
    return "rgba(168,48,48,0.55)";
  }

  function isHot(spend: number): boolean {
    return maxSpend > 0 && spend / maxSpend > 0.75;
  }

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "18px 20px",
        height: "100%", // always match the sibling card in the grid row
      }}
    >
      <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text3)", marginBottom: 14 }}>
        Días con más gasto — {MONTH_NAMES_ES[monthIdx] ?? ""} {year}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
        {["L","M","X","J","V","S","D"].map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 9.5, color: "var(--text3)", fontWeight: 600, paddingBottom: 4 }}>{d}</div>
        ))}
        {Array.from({ length: offset }, (_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
          const spend = spendPerDay[d] ?? 0;
          return (
            <div
              key={d}
              title={`Día ${d}: ${spend ? `${fmtEur(spend)}€ de gasto` : "sin gasto"}`}
              style={{
                aspectRatio: "1",
                borderRadius: 4,
                background: heatColor(spend),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9.5,
                color: isHot(spend) ? "#fff" : "var(--text3)",
                cursor: "default",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.7")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
            >
              {d}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
        <span style={{ fontSize: 10, color: "var(--text3)" }}>Menos</span>
        {["rgba(26,110,60,0.15)", "rgba(26,110,60,0.35)", "rgba(168,48,48,0.25)", "rgba(168,48,48,0.55)"].map((c, i) => (
          <span key={i} style={{ width: 12, height: 12, borderRadius: 3, background: c, display: "inline-block" }} />
        ))}
        <span style={{ fontSize: 10, color: "var(--text3)" }}>Más</span>
      </div>
    </div>
  );
}
