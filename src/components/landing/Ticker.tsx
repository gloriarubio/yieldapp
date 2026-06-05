"use client";

const items = [
  { text: "PDF · Excel · CSV", accent: false },
  { text: "Análisis automático", accent: true },
  { text: "Categorización con IA", accent: false },
  { text: "Proyecciones de ahorro", accent: true },
  { text: "Suscripciones detectadas", accent: false },
  { text: "Sin esfuerzo", accent: true },
  { text: "Cualquier banco", accent: false },
  { text: "Dashboard en tiempo real", accent: true },
  { text: "Asistente conversacional", accent: false },
  { text: "2 minutos de media", accent: true },
];

export function Ticker() {
  const doubled = [...items, ...items];

  return (
    <div
      style={{
        overflow: "hidden",
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg2)",
        padding: "13px 0",
      }}
      onMouseEnter={(e) => {
        const track = (e.currentTarget as HTMLElement).querySelector(".marquee-track") as HTMLElement;
        if (track) track.style.animationPlayState = "paused";
      }}
      onMouseLeave={(e) => {
        const track = (e.currentTarget as HTMLElement).querySelector(".marquee-track") as HTMLElement;
        if (track) track.style.animationPlayState = "";
      }}
    >
      <div className="marquee-track animate-marquee" style={{ display: "flex", width: "max-content" }}>
        {doubled.map((item, i) => (
          <span
            key={i}
            style={{
              whiteSpace: "nowrap",
              fontSize: "12.5px",
              fontWeight: 500,
              color: item.accent ? "var(--accent)" : "var(--text2)",
              padding: "0 28px",
            }}
          >
            {item.text}
          </span>
        ))}
      </div>
    </div>
  );
}
