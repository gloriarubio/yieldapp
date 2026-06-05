interface KpiCardProps {
  label: string;
  value: string;
  delta?: string | null;
  positive: boolean;
  accent?: boolean;
}

export function KpiCard({ label, value, delta, positive, accent }: KpiCardProps) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: accent ? "1px solid var(--accent)" : "1px solid var(--border)",
        borderRadius: 12,
        padding: "18px 20px",
        boxShadow: accent ? "0 0 0 1px var(--accent)" : undefined,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.6px",
          color: "var(--text3)",
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 32,
          fontWeight: 500,
          letterSpacing: "-1.5px",
          lineHeight: 1,
          color: "var(--text)",
          marginBottom: 8,
          fontFamily: "var(--font-playfair), Georgia, serif",
        }}
      >
        {value}
      </div>
      {delta != null && (
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 500,
            color: positive ? "var(--green)" : "var(--red)",
          }}
        >
          {delta}
        </div>
      )}
    </div>
  );
}
