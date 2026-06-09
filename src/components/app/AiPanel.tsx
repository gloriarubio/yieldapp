"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { authClient } from "@/lib/auth-client";

const SUGGESTIONS = [
  "¿En qué categoría gasto más?",
  "¿Qué categorías suben y cuáles bajan?",
  "¿Cuál es mi mayor gasto del periodo?",
  "¿Qué mes ha sido el mejor en ahorro?",
];

export function AiPanel() {
  const [userId, setUserId] = useState<string | null>(null);

  const subscription = useQuery(
    api.subscriptions.getSubscription,
    userId ? {} : "skip"
  );
  const locked = subscription?.plan === "free";

  const conversations = useQuery(
    api.assistant.listConversations,
    userId && !locked ? {} : "skip"
  );

  useEffect(() => {
    authClient.getSession().then(({ data }) => setUserId(data?.user?.id ?? null));
  }, []);

  return (
    <aside
      style={{
        width: 280,
        flexShrink: 0,
        borderLeft: "1px solid var(--border)",
        background: "var(--card)",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "sticky",
        top: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 60,
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
          gap: 8,
          fontSize: 12.5,
          fontWeight: 600,
          color: "var(--text)",
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--green)", animation: "pulse 2s infinite", flexShrink: 0 }} />
        Asistente Yield
      </div>

      {/* Locked state — conversational assistant is Pro-only */}
      {locked && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "0 24px", textAlign: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--card2)", border: "1px solid var(--border2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text2)" }}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <rect x="4" y="9" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M7 9V6.5a3 3 0 016 0V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", margin: 0 }}>
            El asistente es una función Pro
          </p>
          <p style={{ fontSize: 11.5, color: "var(--text2)", lineHeight: 1.6, margin: 0 }}>
            Pregunta lo que quieras sobre tus finanzas y obtén respuestas con tus números reales.
          </p>
          <Link href="/app/ajustes?tab=suscripcion" style={{ background: "var(--accent)", color: "#fff", borderRadius: 100, padding: "8px 18px", fontSize: 12, fontWeight: 600, textDecoration: "none", marginTop: 4 }}>
            Activar Pro
          </Link>
        </div>
      )}

      {/* Quick-access — links into the full /app/asistente page */}
      {!locked && (
        <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ fontSize: 11.5, color: "var(--text3)", lineHeight: 1.6, margin: 0 }}>
            Pregunta sobre tus finanzas y te respondo con tus números reales.
          </p>

          {/* Suggestions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {SUGGESTIONS.map((s) => (
              <Link
                key={s}
                href={`/app/asistente?q=${encodeURIComponent(s)}`}
                style={{ background: "var(--bg)", border: "1px solid var(--border2)", borderRadius: 8, padding: "7px 10px", fontSize: 11.5, color: "var(--text2)", textAlign: "left", textDecoration: "none", transition: "all 0.15s" }}
                onMouseEnter={(e) => { const el = e.currentTarget; el.style.borderColor = "var(--accent)"; el.style.color = "var(--accent)"; }}
                onMouseLeave={(e) => { const el = e.currentTarget; el.style.borderColor = "var(--border2)"; el.style.color = "var(--text2)"; }}
              >
                {s}
              </Link>
            ))}
          </div>

          {/* Recent conversations */}
          {conversations && conversations.length > 0 && (
            <div>
              <p style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.4px", margin: "0 0 6px" }}>
                Recientes
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {conversations.slice(0, 5).map((c) => (
                  <Link
                    key={c._id}
                    href={`/app/asistente?c=${c._id}`}
                    style={{ display: "block", padding: "6px 8px", borderRadius: 7, fontSize: 12, color: "var(--text2)", textDecoration: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", transition: "background 0.12s" }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--card2)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                  >
                    {c.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer CTA */}
      {!locked && (
        <div style={{ padding: "12px 14px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
          <Link
            href="/app/asistente"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", padding: "9px 12px", borderRadius: 9, background: "var(--accent)", color: "#fff", fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}
          >
            Abrir asistente
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 6h10M6.5 1.5L11 6l-4.5 4.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
        </div>
      )}
    </aside>
  );
}
