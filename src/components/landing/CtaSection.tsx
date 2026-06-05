"use client";

import { useEffect, useRef } from "react";

export function CtaSection() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("on"); obs.unobserve(e.target); } }),
      { threshold: 0.1 }
    );
    el.querySelectorAll(".reveal").forEach((r) => obs.observe(r));
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ textAlign: "center", padding: "100px 52px", borderTop: "1px solid var(--border)", position: "relative", overflow: "hidden" }}
    >
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(200,180,154,.04) 0%, transparent 70%)" }} />
      <h2
        className="reveal"
        style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(32px,4vw,52px)", fontWeight: 500, letterSpacing: "-1.5px", lineHeight: 1.15, marginBottom: 18, color: "var(--text)", position: "relative" }}
      >
        ¿Listo para entender<br />
        <em style={{ fontStyle: "italic", fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 400, color: "var(--accent)" }}>de verdad</em>
        {" "}tus finanzas?
      </h2>
      <p
        className="reveal r1"
        style={{ fontSize: 16, color: "var(--text2)", marginBottom: 38, position: "relative" }}
      >
        Empieza gratis. Sin tarjeta de crédito. Sin compromiso.
      </p>
      <a
        href="#"
        className="reveal r2"
        style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          fontSize: 15, padding: "14px 36px", borderRadius: 100,
          background: "var(--accent)", color: "#fff",
          textDecoration: "none", fontWeight: 500,
          position: "relative",
          transition: "all 0.2s var(--ease)",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = "var(--accent2)";
          el.style.transform = "translateY(-1px)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = "var(--accent)";
          el.style.transform = "";
        }}
      >
        Empezar gratis →
      </a>
    </div>
  );
}
