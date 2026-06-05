"use client";

import { useCallback, useRef } from "react";
import { AppMockup } from "./AppMockup";

function MagneticCTA({ href, children, primary }: { href: string; children: React.ReactNode; primary?: boolean }) {
  const ref = useRef<HTMLAnchorElement>(null);

  const onMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * 8;
    const y = ((e.clientY - r.top) / r.height - 0.5) * 8;
    el.style.transform = `translate(${x}px,${y}px) translateY(-1px)`;
  }, []);

  const onLeave = useCallback(() => {
    if (ref.current) ref.current.style.transform = "";
  }, []);

  return (
    <a
      ref={ref}
      href={href}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "13px 30px",
        borderRadius: 100,
        fontSize: 15,
        fontWeight: 500,
        textDecoration: "none",
        transition: "background 0.2s var(--ease), box-shadow 0.2s var(--ease)",
        ...(primary
          ? {
              background: "var(--accent)",
              color: "#fff",
              boxShadow: "0 2px 12px rgba(30,61,44,0.15)",
            }
          : {
              color: "var(--text2)",
            }),
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        if (primary) {
          el.style.background = "var(--accent2)";
          el.style.boxShadow = "0 6px 20px rgba(30,61,44,0.25)";
        } else {
          el.style.color = "var(--text)";
        }
      }}
    >
      {children}
    </a>
  );
}

export function Hero() {
  const dashRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = dashRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - r.left - r.width / 2) / r.width;
    const dy = (e.clientY - r.top - r.height / 2) / r.height;
    el.style.transform = `perspective(1200px) rotateX(${5 - dy * 7}deg) rotateY(${dx * 7}deg)`;
  }, []);

  const handleMouseLeave = useCallback(() => {
    const el = dashRef.current;
    if (!el) return;
    el.style.transform = "perspective(1200px) rotateX(5deg)";
  }, []);

  return (
    <section
      ref={heroRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "140px 52px 80px",
        position: "relative",
        overflow: "hidden",
        textAlign: "center",
      }}
    >
      {/* Blobs */}
      {[
        { w: 560, h: 560, bg: "var(--accent)", op: 0.05, top: -120, left: -160, delay: "0s" },
        { w: 400, h: 400, bg: "var(--green)", op: 0.04, bottom: -60, right: -100, delay: "-7s" },
        { w: 300, h: 300, bg: "var(--accent)", op: 0.03, bottom: "20%", left: "30%", delay: "-3.5s" },
      ].map((b, i) => (
        <div
          key={i}
          className="animate-drift"
          style={{
            position: "absolute",
            borderRadius: "50%",
            width: b.w,
            height: b.h,
            background: b.bg,
            opacity: b.op,
            filter: "blur(100px)",
            pointerEvents: "none",
            animationDelay: b.delay,
            ...("top" in b ? { top: b.top } : {}),
            ...("bottom" in b ? { bottom: b.bottom } : {}),
            ...("left" in b ? { left: b.left } : {}),
            ...("right" in b ? { right: b.right } : {}),
          }}
        />
      ))}

      {/* Badge */}
      <span
        className="animate-fade-up"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 16px",
          borderRadius: 100,
          background: "var(--green-dim)",
          border: "1px solid rgba(82,208,126,0.18)",
          fontSize: "12.5px",
          fontWeight: 500,
          color: "var(--green)",
          marginBottom: 38,
          animationDelay: "0.15s",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", animation: "pulse 2s infinite", flexShrink: 0 }} />
        Análisis financiero con IA · Nuevo
      </span>

      {/* H1 */}
      <h1
        className="animate-fade-up"
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "clamp(48px, 7.5vw, 96px)",
          fontWeight: 600,
          letterSpacing: "-3.5px",
          lineHeight: 1.02,
          maxWidth: 860,
          marginBottom: 10,
          color: "var(--text)",
          animationDelay: "0.3s",
        }}
      >
        Entiende en qué gastas<br />
        tu dinero.{" "}
        <em style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", fontWeight: 400, color: "var(--accent)", letterSpacing: "-2px" }}>
          Por fin.
        </em>
      </h1>

      {/* Subtitle */}
      <p
        className="animate-fade-up"
        style={{
          fontSize: 17,
          fontWeight: 300,
          color: "var(--text2)",
          lineHeight: 1.72,
          maxWidth: 500,
          margin: "28px auto 44px",
          animationDelay: "0.48s",
        }}
      >
        Sube tus extractos bancarios — PDF, Excel o CSV — y obtén un dashboard
        claro con tus ingresos, gastos y capacidad real de ahorro. En menos de dos minutos.
      </p>

      {/* CTAs */}
      <div
        className="animate-fade-up"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 80, animationDelay: "0.64s" }}
      >
        <MagneticCTA href="/sign-up" primary>Empieza gratis →</MagneticCTA>
        <MagneticCTA href="#how">Ver cómo funciona</MagneticCTA>
      </div>

      {/* Dashboard — 3D tilt applied to the inner .dash element via ref */}
      <div
        className="animate-dash-entry"
        style={{ width: "100%", maxWidth: 960, animationDelay: "0.82s" }}
      >
        <AppMockup dashRef={dashRef} />
      </div>
    </section>
  );
}
