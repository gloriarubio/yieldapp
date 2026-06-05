"use client";

import { useEffect, useRef } from "react";

type Feature = { text: string; ia?: boolean; sub?: string };

const plans: Array<{
  name: string;
  badge: string;
  num: string;
  period?: string;
  tagline: string;
  cta: string;
  href: string;
  sectionLabel: string;
  features: Feature[];
  footnote?: string;
  featured?: boolean;
  revealDelay: string;
}> = [
  {
    name: "Free",
    badge: "Gratis para siempre",
    num: "0€",
    tagline: "Conoce tu situación financiera real",
    cta: "Empezar gratis ↗",
    href: "/sign-up",
    sectionLabel: "Al subir tu primer fichero",
    features: [
      { text: "Hasta 12 meses de historial" },
      { text: "Categorización automática", ia: true },
      { text: "Detección de suscripciones" },
      { text: "Dashboard completo del período" },
      {
        text: "3 insights sobre el período",
        ia: true,
        sub: "Análisis global de tus patrones y tendencias",
      },
    ],
    footnote: "Datos accesibles pero sin nuevas subidas",
    revealDelay: "r1",
  },
  {
    name: "Pro",
    badge: "Más popular",
    num: "7€",
    period: "/ mes",
    tagline: "El hábito mensual de tus finanzas",
    cta: "Activar Pro ↗",
    href: "/app/ajustes?tab=suscripcion&plan=month",
    sectionLabel: "Todo lo de Free, más",
    features: [
      { text: "Extractos recurrentes ilimitados" },
      { text: "Historial siempre actualizado" },
      { text: "Categorías que aprenden de ti", ia: true },
      {
        text: "3 insights personalizados por mes",
        ia: true,
        sub: "Más detallados, generados al subir cada extracto",
      },
      { text: "Proyecciones interactivas" },
      { text: "Asistente conversacional", ia: true },
      { text: "API + automatizaciones" },
    ],
    featured: true,
    revealDelay: "r2",
  },
];

function IaChip({ inverted }: { inverted: boolean }) {
  return (
    <span
      style={{
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: "0.5px",
        padding: "1.5px 7px",
        borderRadius: 100,
        flexShrink: 0,
        background: inverted ? "rgba(255,255,255,0.15)" : "var(--green-dim)",
        color: inverted ? "rgba(255,255,255,0.9)" : "var(--green)",
        border: inverted ? "1px solid rgba(255,255,255,0.3)" : "1px solid rgba(26,110,60,0.18)",
      }}
    >
      IA
    </span>
  );
}

export function Pricing() {
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
    <section ref={sectionRef} id="pricing" style={{ padding: "110px 52px", maxWidth: 1160, margin: "0 auto", textAlign: "center" }}>
      <div className="reveal" style={{ marginBottom: 6 }}>
        <span style={{ fontSize: "11.5px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1.8px", color: "var(--accent)" }}>Precios</span>
      </div>
      <div className="reveal r1" style={{ marginBottom: 52 }}>
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(34px,4vw,58px)", fontWeight: 500, lineHeight: 1.13, letterSpacing: "-1.5px", color: "var(--text)", marginBottom: 18 }}>
          Simple y transparente
        </h2>
        <p style={{ fontSize: 16, fontWeight: 300, color: "var(--text2)", lineHeight: 1.72 }}>
          Empieza gratis. Escala cuando lo necesites. Sin permanencia.
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "stretch", justifyContent: "center", gap: 18, textAlign: "left", flexWrap: "wrap" }}>
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`reveal ${plan.revealDelay}`}
            style={{
              flex: 1, maxWidth: 400, minWidth: 300,
              border: plan.featured ? "none" : "1px solid var(--border)",
              borderRadius: 16,
              padding: "36px 32px 32px",
              background: plan.featured ? "var(--accent)" : "var(--card)",
              position: "relative",
              display: "flex", flexDirection: "column",
              boxShadow: plan.featured ? "0 30px 60px rgba(30,61,44,0.25)" : undefined,
              transition: "transform 0.3s var(--ease), box-shadow 0.3s var(--ease)",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-5px)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; }}
          >
            {/* Badge */}
            <div
              style={{
                alignSelf: "flex-start",
                fontSize: "10.5px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "1px",
                padding: "4px 14px",
                borderRadius: 100,
                marginBottom: 18,
                background: plan.featured ? "#fff" : "var(--card2)",
                color: plan.featured ? "var(--accent)" : "var(--text2)",
                border: plan.featured ? "none" : "1px solid var(--border2)",
              }}
            >
              {plan.badge}
            </div>

            <div style={{ fontSize: 15, fontWeight: 600, color: plan.featured ? "rgba(255,255,255,0.85)" : "var(--text2)", marginBottom: 8 }}>
              {plan.name}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-2.5px", lineHeight: 1, color: plan.featured ? "#fff" : "var(--text)" }}>
                {plan.num}
              </span>
              {plan.period && (
                <span style={{ fontSize: 15, color: plan.featured ? "rgba(255,255,255,0.6)" : "var(--text2)" }}>{plan.period}</span>
              )}
            </div>
            <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", fontSize: 14.5, color: plan.featured ? "rgba(255,255,255,0.7)" : "var(--text2)", marginBottom: 24 }}>
              {plan.tagline}
            </p>

            <a
              href={plan.href}
              style={{
                width: "100%", padding: 12, borderRadius: 100,
                fontSize: "13.5px", fontWeight: 600, textAlign: "center",
                display: "block", textDecoration: "none",
                background: plan.featured ? "#fff" : "none",
                color: plan.featured ? "var(--accent)" : "var(--text)",
                border: plan.featured ? "none" : "1.5px solid var(--border2)",
                marginBottom: 26,
                transition: "all 0.2s var(--ease)",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                if (plan.featured) { el.style.background = "rgba(255,255,255,0.9)"; el.style.transform = "translateY(-1px)"; }
                else { el.style.borderColor = "var(--text)"; }
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = plan.featured ? "#fff" : "none";
                el.style.transform = "";
                el.style.borderColor = "";
              }}
            >
              {plan.cta}
            </a>

            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "1px",
                color: plan.featured ? "rgba(255,255,255,0.5)" : "var(--text3)",
                paddingBottom: 12,
                borderBottom: plan.featured ? "1px solid rgba(255,255,255,0.15)" : "1px solid var(--border)",
                marginBottom: 14,
              }}
            >
              {plan.sectionLabel}
            </div>

            <ul style={{ flex: 1, listStyle: "none", padding: 0, margin: 0 }}>
              {plan.features.map((f) => (
                <li key={f.text} style={{ padding: "6px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      width: 16, height: 16, flexShrink: 0, borderRadius: "50%",
                      background: plan.featured ? "rgba(255,255,255,0.15)" : "var(--green-dim)",
                      border: plan.featured ? "1px solid rgba(255,255,255,0.3)" : "1px solid rgba(26,110,60,.18)",
                      backgroundImage: plan.featured
                        ? "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='7' viewBox='0 0 9 7'%3E%3Cpath d='M1 3.5l2 2L8 1' stroke='white' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")"
                        : "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='7' viewBox='0 0 9 7'%3E%3Cpath d='M1 3.5l2 2L8 1' stroke='%231A6E3C' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
                      backgroundRepeat: "no-repeat", backgroundPosition: "center",
                    }} />
                    <span style={{ fontSize: 13, color: plan.featured ? "rgba(255,255,255,0.9)" : "var(--text)", fontWeight: 500 }}>
                      {f.text}
                    </span>
                    {f.ia && <IaChip inverted={!!plan.featured} />}
                  </div>
                  {f.sub && (
                    <div style={{ fontSize: 11.5, color: plan.featured ? "rgba(255,255,255,0.5)" : "var(--text3)", paddingLeft: 26, marginTop: 2 }}>
                      {f.sub}
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {plan.footnote && (
              <div
                style={{
                  marginTop: 18,
                  fontSize: 12,
                  color: "var(--text2)",
                  background: "var(--card2)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "9px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span aria-hidden>❄</span> {plan.footnote}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Annual plan note */}
      <p className="reveal r3" style={{ marginTop: 28, fontSize: 13.5, color: "var(--text2)" }}>
        Con el{" "}
        <a
          href="/app/ajustes?tab=suscripcion&plan=year"
          style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "underline" }}
        >
          plan anual
        </a>{" "}
        — 59€/año — ahorras 25€ al año.
      </p>
    </section>
  );
}
