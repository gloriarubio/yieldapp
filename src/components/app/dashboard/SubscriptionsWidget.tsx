const MONTH_NAMES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

function fmtDate(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const day = parseInt(parts[2]);
  const month = parseInt(parts[1]) - 1;
  return `${day} ${MONTH_NAMES[month]}`;
}

type SubData = {
  name: string;
  amount: number;
  lastPaymentDate: string;
  totalPayments: number;
};

export function SubscriptionsWidget({ subs }: { subs: SubData[] }) {
  const total = subs.reduce((a, s) => a + s.amount, 0);

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        height: "100%", // always match the sibling card in the grid row
        minWidth: 0,    // let long subscription names truncate instead of widening the card
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.6px",
            color: "var(--text3)",
          }}
        >
          Suscripciones del mes
        </div>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            color: "var(--green)",
            background: "var(--green-dim)",
            padding: "2px 8px",
            borderRadius: 100,
            border: "1px solid rgba(26,110,60,0.15)",
          }}
        >
          {subs.length} activas
        </div>
      </div>

      {subs.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px 0",
            fontSize: 13,
            color: "var(--text3)",
            textAlign: "center",
          }}
        >
          Sin suscripciones detectadas este mes
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column" }}>
        {subs.map((s, i) => (
          <div
            key={s.name}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "9px 0",
              borderBottom: i < subs.length - 1 ? "1px solid var(--border)" : "none",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 13,
                  color: "var(--text2)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {s.name}
              </span>
              <span style={{ fontSize: 11, color: "var(--text3)" }}>
                último pago: {fmtDate(s.lastPaymentDate)}
                {" · "}
                {s.totalPayments} {s.totalPayments === 1 ? "pago" : "pagos"} en total
              </span>
            </div>
            <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 500, flexShrink: 0 }}>
              -{s.amount.toLocaleString("es-ES", { minimumFractionDigits: 2 })}€
            </span>
          </div>
        ))}
      </div>

      {/* Total row — only when there are subscriptions */}
      {subs.length > 0 && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 13,
          }}
        >
          <span style={{ color: "var(--text2)", fontWeight: 500 }}>Total este mes</span>
          <span style={{ color: "var(--accent)", fontWeight: 700, fontSize: 15 }}>
            -{total.toLocaleString("es-ES", { minimumFractionDigits: 2 })}€
          </span>
        </div>
      )}
    </div>
  );
}
