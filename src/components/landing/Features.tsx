"use client";

import { useEffect, useRef } from "react";

const features = [
  {
    title: "Dashboard en tiempo real",
    description: "Resumen mensual completo: ingresos, gastos, ahorro neto y capacidad real de ahorro. Todo en un vistazo.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="1.5" y="9" width="3.5" height="7.5" rx="1" fill="currentColor" opacity=".4"/>
        <rect x="7.2" y="6" width="3.5" height="10.5" rx="1" fill="currentColor" opacity=".65"/>
        <rect x="13" y="2.5" width="3.5" height="14" rx="1" fill="currentColor"/>
      </svg>
    ),
  },
  {
    title: "Categorización automática",
    description: "Cada transacción se clasifica al instante: supermercado, transporte, suscripciones, ocio… sin tocar nada.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.5" opacity=".35"/>
        <path d="M9 4v5l3.5 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    title: "Proyecciones de ahorro",
    description: "Simulador a 3, 6 y 12 meses. Descubre cuánto ahorrarías si reduces una categoría de gasto concreta.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M2.5 13.5l4-4.5 3 3 5.5-7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="15" cy="3.5" r="2" fill="currentColor" opacity=".4"/>
      </svg>
    ),
  },
  {
    title: "Asistente IA conversacional",
    description: '"¿Cuánto llevo en Amazon este año?" "¿Cuándo podré ahorrar 3.000€?" Pregunta lo que quieras.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M3 10h1.5l2-6 3 10 2-7 1.5 3H15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    title: "Suscripciones detectadas",
    description: "Yield identifica todos los cobros recurrentes y te muestra cuánto suman al mes. Siempre sorprende la cifra.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2.5" y="5" width="13" height="9.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" opacity=".35"/>
        <path d="M2.5 8h13" stroke="currentColor" strokeWidth="1.2" opacity=".5"/>
        <circle cx="6" cy="11.5" r="1.2" fill="currentColor"/>
        <circle cx="9" cy="11.5" r="1.2" fill="currentColor" opacity=".5"/>
      </svg>
    ),
  },
  {
    title: "Exportación de datos",
    description: "Descarga tu historial completo en Excel o PDF cuando quieras. Tus datos son siempre tuyos.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="3" y="2.5" width="12" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5" opacity=".35"/>
        <path d="M6 6.5h6M6 9.5h6M6 12.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export function Features() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("on"); obs.unobserve(e.target); } }),
      { threshold: 0.1 }
    );
    el.querySelectorAll(".reveal").forEach((r) => obs.observe(r));
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={sectionRef} id="features" style={{ padding: "100px 52px 110px", maxWidth: 1160, margin: "0 auto" }}>
      <div className="reveal" style={{ marginBottom: 6 }}>
        <span style={{ fontSize: "11.5px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1.8px", color: "var(--accent)" }}>
          Funcionalidades
        </span>
      </div>
      <div className="reveal r1" style={{ marginBottom: 62 }}>
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(34px,4vw,58px)", fontWeight: 500, lineHeight: 1.13, letterSpacing: "-1.5px", color: "var(--text)" }}>
          Todo lo que necesitas<br />para controlar tu dinero
        </h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        {features.map(({ icon, title, description }, i) => (
          <div
            key={i}
            className="reveal"
            style={{
              padding: 36,
              background: "var(--card)",
              borderTop: i >= 3 ? "1px solid var(--border)" : undefined,
              borderLeft: i % 3 !== 0 ? "1px solid var(--border)" : undefined,
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--card2)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--card)")}
          >
            <div style={{ width: 42, height: 42, borderRadius: 10, background: "var(--green-dim)", border: "1px solid rgba(82,208,126,.13)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--green)", marginBottom: 20 }}>
              {icon}
            </div>
            <h3 style={{ fontSize: "14.5px", fontWeight: 600, marginBottom: 8, color: "var(--text)" }}>{title}</h3>
            <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.62 }}>{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
