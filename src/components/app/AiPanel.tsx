"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { authClient } from "@/lib/auth-client";

const SUGGESTIONS = [
  "¿En qué categoría gasto más?",
  "¿Cuánto llevo en Amazon?",
  "¿Cuándo puedo ahorrar 3.000€?",
];

const BOT_REPLY =
  "Tu mayor gasto en mayo es Supermercado con 502€, un 23% del total. Subió un 12% respecto a abril. Te propongo 3 acciones concretas para reducirlo el mes que viene.";

interface Message {
  role: "user" | "bot";
  text: string;
}

export function AiPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // El asistente conversacional es una función Pro
  const subscription = useQuery(
    api.subscriptions.getSubscription,
    userId ? { userId } : "skip"
  );
  const locked = subscription?.plan === "free";

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      setUserId(data?.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  function send(text: string) {
    const q = text.trim();
    if (!q) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, { role: "bot", text: BOT_REPLY }]);
    }, 1600);
  }

  function clear() {
    setMessages([]);
    setInput("");
    setTyping(false);
  }

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
          justifyContent: "space-between",
          padding: "0 16px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>
          <span
            style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--green)", animation: "pulse 2s infinite", flexShrink: 0 }}
          />
          Asistente Yield
        </div>
        {messages.length > 0 && (
          <button
            onClick={clear}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--text3)", fontFamily: "inherit", padding: "3px 6px", borderRadius: 6, transition: "color 0.15s" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text2)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text3)")}
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Locked state — conversational assistant is Pro-only */}
      {locked && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: "0 24px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "var(--card2)",
              border: "1px solid var(--border2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text2)",
            }}
          >
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
          <Link
            href="/app/ajustes?tab=suscripcion"
            style={{
              background: "var(--accent)",
              color: "#fff",
              borderRadius: 100,
              padding: "8px 18px",
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
              marginTop: 4,
            }}
          >
            Activar Pro
          </Link>
        </div>
      )}

      {/* Messages */}
      {!locked && (
      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ paddingTop: 8 }}>
            <p style={{ fontSize: 11.5, color: "var(--text3)", marginBottom: 12, lineHeight: 1.6 }}>
              Pregúntame lo que quieras sobre tus finanzas de este mes.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  style={{
                    background: "var(--bg)",
                    border: "1px solid var(--border2)",
                    borderRadius: 8,
                    padding: "7px 10px",
                    fontSize: 11.5,
                    color: "var(--text2)",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { const el = e.currentTarget; el.style.borderColor = "var(--accent)"; el.style.color = "var(--accent)"; }}
                  onMouseLeave={(e) => { const el = e.currentTarget; el.style.borderColor = "var(--border2)"; el.style.color = "var(--text2)"; }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) =>
          msg.role === "user" ? (
            <div key={i} style={{ alignSelf: "flex-end", maxWidth: "90%" }}>
              <div
                style={{
                  background: "var(--card2)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px 10px 3px 10px",
                  padding: "8px 11px",
                  fontSize: 12,
                  color: "var(--text2)",
                  lineHeight: 1.5,
                }}
              >
                {msg.text}
              </div>
            </div>
          ) : (
            <div key={i} style={{ alignSelf: "flex-start", maxWidth: "95%" }}>
              <div
                style={{
                  background: "rgba(26,110,60,0.07)",
                  border: "1px solid rgba(26,110,60,0.15)",
                  borderRadius: "10px 10px 10px 3px",
                  padding: "8px 11px",
                  fontSize: 12,
                  color: "var(--text)",
                  lineHeight: 1.55,
                }}
              >
                {msg.text}
              </div>
            </div>
          )
        )}

        {typing && (
          <div style={{ alignSelf: "flex-start" }}>
            <div
              style={{
                background: "rgba(26,110,60,0.07)",
                border: "1px solid rgba(26,110,60,0.15)",
                borderRadius: "10px 10px 10px 3px",
                padding: "10px 14px",
                display: "inline-flex",
                gap: 4,
                alignItems: "center",
              }}
            >
              {[0, 0.2, 0.4].map((d, i) => (
                <span key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--text3)", animation: `blink 1.2s ${d}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      )}

      {/* Input */}
      {!locked && (
      <div
        style={{
          padding: "10px 12px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(input); }}
          placeholder="Pregunta algo sobre tus finanzas…"
          style={{
            flex: 1,
            background: "var(--bg)",
            border: "1px solid var(--border2)",
            borderRadius: 100,
            padding: "7px 12px",
            fontSize: 12,
            color: "var(--text)",
            fontFamily: "inherit",
            outline: "none",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border2)")}
        />
        <button
          onClick={() => send(input)}
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: input.trim() ? "var(--accent)" : "var(--card2)",
            border: "none",
            cursor: input.trim() ? "pointer" : "default",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "background 0.2s",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 6h10M6.5 1.5L11 6l-4.5 4.5" stroke={input.trim() ? "#fff" : "var(--text3)"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      )}
    </aside>
  );
}
