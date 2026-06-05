"use client";

const legal = ["Política de privacidad", "Términos de uso", "Política de cookies", "Seguridad"];

export function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--border)", padding: "64px 52px 40px", maxWidth: 1160, margin: "0 auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 1fr 1fr", gap: 48, marginBottom: 52 }}>
        {/* Brand */}
        <div>
          <a href="#" style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600, fontSize: 17, letterSpacing: "-0.2px", color: "var(--text)", textDecoration: "none", marginBottom: 14 }}>
            <svg width="28" height="20" viewBox="0 0 30 22" fill="none">
              <path d="M2 18C5.5 18 8 5 13.5 5C19 5 19.5 13 25.5 9.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
              <circle cx="25.5" cy="9.5" r="2.5" fill="currentColor"/>
            </svg>
            Yield
          </a>
          <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.65, maxWidth: 240 }}>
            Entiende tu dinero en 2 minutos.<br />Para cualquier persona, sin conocimientos financieros.
          </p>
        </div>
        {/* Recursos */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.4px", color: "var(--text3)", marginBottom: 16 }}>Recursos</div>
          <a href="/docs/api" style={{ display: "block", fontSize: 13, color: "var(--text2)", marginBottom: 10, textDecoration: "none", transition: "color 0.2s" }}
            onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "var(--text)")}
            onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "var(--text2)")}
          >
            Documentación API
          </a>
        </div>
        {/* Legal */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.4px", color: "var(--text3)", marginBottom: 16 }}>Legal</div>
          {legal.map((item) => (
            <a key={item} href="#" style={{ display: "block", fontSize: 13, color: "var(--text2)", marginBottom: 10, textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "var(--text)")}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "var(--text2)")}
            >
              {item}
            </a>
          ))}
        </div>
        {/* Contact */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.4px", color: "var(--text3)", marginBottom: 16 }}>Contacto</div>
          <a href="mailto:hola@yield.es" style={{ display: "block", fontSize: 13, color: "var(--text2)", textDecoration: "none", transition: "color 0.2s" }}
            onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "var(--text)")}
            onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "var(--text2)")}
          >
            hola@yield.es
          </a>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 24, borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text3)" }}>
        <span>© 2026 Yield · Hecho con cuidado en España</span>
        <span>Todos los derechos reservados</span>
      </div>
    </footer>
  );
}
