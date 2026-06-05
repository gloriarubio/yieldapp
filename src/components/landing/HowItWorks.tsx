"use client";

import { useEffect, useRef } from "react";

const steps = [
  {
    number: "01",
    title: "Sube tu extracto",
    description: "Descarga el extracto de tu banco y arrástralo a Yield. Sin conectar tu cuenta. Sin permisos. Sin riesgos.",
    badges: ["PDF", "Excel", "CSV"],
  },
  {
    number: "02",
    title: "La IA lo categoriza",
    description: "Nuestro motor analiza cada transacción y la clasifica en categorías claras. Supermercado, suscripciones, transporte, ocio… todo automático.",
    badges: [],
  },
  {
    number: "03",
    title: "Entiende tu dinero",
    description: "Tu dashboard personal está listo. Pregúntale al asistente, descubre dónde se va el dinero y empieza a cambiar hábitos con información real.",
    badges: [],
  },
];

export function HowItWorks() {
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
    <section ref={sectionRef} id="how" style={{ padding: "110px 52px", maxWidth: 1160, margin: "0 auto" }}>
      <div className="reveal" style={{ marginBottom: 6 }}>
        <span style={{ fontSize: "11.5px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1.8px", color: "var(--accent)" }}>
          Cómo funciona
        </span>
      </div>
      <div className="reveal r1" style={{ marginBottom: 62 }}>
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(34px,4vw,58px)", fontWeight: 500, lineHeight: 1.13, letterSpacing: "-1.5px", color: "var(--text)" }}>
          Tres pasos.<br />Dos minutos.<br />
          <em style={{ fontStyle: "italic", color: "var(--accent)" }}>Todo claro.</em>
        </h2>
      </div>

      <div className="reveal r2" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        {steps.map((step, i) => (
          <div
            key={i}
            style={{
              padding: "44px 38px",
              background: "var(--card)",
              borderLeft: i > 0 ? "1px solid var(--border)" : undefined,
            }}
          >
            <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 72, fontWeight: 500, lineHeight: 1, color: "rgba(10,10,10,0.18)", marginBottom: 26 }}>
              {step.number}
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 10, color: "var(--text)" }}>{step.title}</h3>
            <p style={{ fontSize: "13.5px", color: "var(--text2)", lineHeight: 1.65 }}>{step.description}</p>
            {step.badges.length > 0 && (
              <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
                {step.badges.map((b) => (
                  <span key={b} style={{ fontSize: "10.5px", fontWeight: 600, letterSpacing: "0.4px", padding: "4px 10px", borderRadius: 5, background: "var(--card2)", color: "var(--text2)", border: "1px solid var(--border)" }}>
                    {b}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
