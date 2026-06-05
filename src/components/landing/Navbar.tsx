"use client";

import { useEffect, useState } from "react";

const navLinks = [
  { label: "Cómo funciona", href: "#how" },
  { label: "Funcionalidades", href: "#features" },
  { label: "Precios", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export function Navbar() {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: stuck ? "14px 52px" : "22px 52px",
        background: stuck ? "rgba(244,239,229,0.88)" : "transparent",
        backdropFilter: stuck ? "blur(28px) saturate(1.4)" : "none",
        borderBottom: stuck ? "1px solid var(--border)" : "1px solid transparent",
        transition: "padding 0.3s var(--ease), background 0.3s var(--ease), border-color 0.3s",
      }}
    >
      {/* Logo */}
      <a
        href="#"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontWeight: 600,
          fontSize: 17,
          letterSpacing: "-0.2px",
          color: "var(--text)",
          textDecoration: "none",
        }}
      >
        <svg width="30" height="22" viewBox="0 0 30 22" fill="none" style={{ flexShrink: 0 }}>
          <path d="M2 18C5.5 18 8 5 13.5 5C19 5 19.5 13 25.5 9.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none"/>
          <circle cx="25.5" cy="9.5" r="2.5" fill="currentColor"/>
          <circle cx="25.5" cy="9.5" r="2.5" fill="currentColor" opacity="0.25">
            <animate attributeName="r" values="2.5;5.5;2.5" dur="2.2s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.25;0;0.25" dur="2.2s" repeatCount="indefinite"/>
          </circle>
        </svg>
        Yield
      </a>

      {/* Nav links */}
      <ul style={{ display: "flex", alignItems: "center", gap: 36, listStyle: "none" }}>
        {navLinks.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              style={{ fontSize: "13.5px", fontWeight: 500, color: "var(--text2)", textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "var(--text)")}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "var(--text2)")}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>

      {/* Right CTAs */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <a
          href="/sign-in"
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 20px", borderRadius: 100, fontSize: "13.5px", fontWeight: 500, color: "var(--text2)", textDecoration: "none", transition: "color 0.2s" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text2)")}
        >
          Iniciar sesión
        </a>

        <a
          href="/sign-up"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "9px 20px",
            borderRadius: 100,
            fontSize: "13.5px",
            fontWeight: 500,
            background: "var(--accent)",
            color: "#fff",
            textDecoration: "none",
            letterSpacing: "-0.1px",
            boxShadow: "0 2px 12px rgba(30,61,44,0.15)",
            transition: "all 0.2s var(--ease)",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = "var(--accent2)";
            el.style.transform = "translateY(-1px)";
            el.style.boxShadow = "0 6px 20px rgba(30,61,44,0.25)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = "var(--accent)";
            el.style.transform = "";
            el.style.boxShadow = "0 2px 12px rgba(30,61,44,0.15)";
          }}
        >
          Empezar gratis
        </a>
      </div>
    </nav>
  );
}
