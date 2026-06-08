"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { authClient } from "@/lib/auth-client";

const SUGGESTIONS = [
  "¿Qué categorías suben y cuáles bajan estos últimos meses?",
  "¿Cuál es mi mayor gasto de todo el periodo?",
  "¿Qué mes ha sido el mejor en ahorro?",
  "¿Cuánto gasto de media al mes y en qué se va?",
];

export default function AsistentePage() {
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<Id<"assistant_conversations"> | null>(
    (searchParams.get("c") as Id<"assistant_conversations"> | null) ?? null
  );
  const [input, setInput] = useState(searchParams.get("q") ?? "");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const subscription = useQuery(
    api.subscriptions.getSubscription,
    userId ? { userId } : "skip"
  );
  const locked = subscription?.plan === "free";

  const conversations = useQuery(
    api.assistant.listConversations,
    userId ? { userId } : "skip"
  );
  const messages = useQuery(
    api.assistant.getMessages,
    userId && activeId ? { userId, conversationId: activeId } : "skip"
  );

  const createConversation = useMutation(api.assistant.createConversation);
  const addUserMessage = useMutation(api.assistant.addUserMessage);
  const deleteConversation = useMutation(api.assistant.deleteConversation);
  const ask = useAction(api.assistantActions.ask);

  useEffect(() => {
    authClient.getSession().then(({ data }) => setUserId(data?.user?.id ?? null));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || sending || !userId) return;
    let cid = activeId;
    if (!cid) {
      cid = await createConversation({ userId });
      setActiveId(cid);
    }
    setInput("");
    await addUserMessage({ userId, conversationId: cid, text: q });
    setSending(true);
    try {
      await ask({ userId, conversationId: cid });
    } finally {
      setSending(false);
    }
  }

  function newConversation() {
    setActiveId(null);
    setInput("");
    inputRef.current?.focus();
  }

  async function remove(id: Id<"assistant_conversations">) {
    if (!userId) return;
    await deleteConversation({ userId, conversationId: id });
    if (id === activeId) setActiveId(null);
  }

  // --- Pro lock ---
  if (locked) {
    return (
      <div style={{ maxWidth: 460, margin: "60px auto 0", textAlign: "center" }}>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 12,
            background: "var(--card2)",
            border: "1px solid var(--border2)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text2)",
            marginBottom: 16,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <rect x="4" y="9" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7 9V6.5a3 3 0 016 0V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--text)", margin: "0 0 8px", fontFamily: "var(--font-playfair), Georgia, serif" }}>
          El asistente es una función Pro
        </h1>
        <p style={{ fontSize: 13.5, color: "var(--text2)", lineHeight: 1.6, margin: "0 0 20px" }}>
          Pregunta lo que quieras sobre tus finanzas y obtén respuestas con tus números reales. Tus conversaciones se guardan.
        </p>
        <Link
          href="/app/ajustes?tab=suscripcion"
          style={{ background: "var(--accent)", color: "#fff", borderRadius: 100, padding: "10px 22px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
        >
          Activar Pro
        </Link>
      </div>
    );
  }

  const hasMessages = messages && messages.length > 0;

  return (
    <div style={{ display: "flex", gap: 0, height: "calc(100vh - 116px)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", background: "var(--card)" }}>
      {/* Conversation list */}
      <div style={{ width: 250, flexShrink: 0, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
        <div style={{ padding: 12 }}>
          <button
            onClick={newConversation}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "9px 12px", borderRadius: 9, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit" }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 2v9M2 6.5h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            Nueva conversación
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 8px" }}>
          {conversations?.length === 0 && (
            <p style={{ fontSize: 11.5, color: "var(--text3)", padding: "8px 10px", lineHeight: 1.6 }}>
              Aún no tienes conversaciones. Empieza una pregunta abajo.
            </p>
          )}
          {conversations?.map((c) => {
            const active = c._id === activeId;
            return (
              <div
                key={c._id}
                onClick={() => setActiveId(c._id)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderRadius: 8, cursor: "pointer", marginBottom: 2, background: active ? "var(--card2)" : "transparent" }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "var(--card)"; }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: active ? "var(--text)" : "var(--text2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.title}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); remove(c._id); }}
                  title="Eliminar"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: 2, display: "flex", flexShrink: 0 }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--red)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text3)")}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {!hasMessages && (
            <div style={{ maxWidth: 560, margin: "0 auto", paddingTop: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)" }} />
                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", fontFamily: "var(--font-playfair), Georgia, serif" }}>Asistente Yield</span>
              </div>
              <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6, marginBottom: 18 }}>
                Pregúntame lo que quieras sobre tus finanzas. Analizo tus extractos y respondo con tus números reales.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    style={{ background: "var(--card)", border: "1px solid var(--border2)", borderRadius: 10, padding: "11px 13px", fontSize: 12.5, color: "var(--text2)", cursor: "pointer", textAlign: "left", fontFamily: "inherit", lineHeight: 1.45, transition: "all 0.15s" }}
                    onMouseEnter={(e) => { const el = e.currentTarget; el.style.borderColor = "var(--accent)"; el.style.color = "var(--accent)"; }}
                    onMouseLeave={(e) => { const el = e.currentTarget; el.style.borderColor = "var(--border2)"; el.style.color = "var(--text2)"; }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasMessages && (
            <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
              {messages!.map((m) =>
                m.role === "user" ? (
                  <div key={m._id} style={{ alignSelf: "flex-end", maxWidth: "82%" }}>
                    <div style={{ background: "var(--card2)", border: "1px solid var(--border)", borderRadius: "12px 12px 4px 12px", padding: "10px 14px", fontSize: 13.5, color: "var(--text)", lineHeight: 1.5 }}>
                      {m.text}
                    </div>
                  </div>
                ) : (
                  <div key={m._id} style={{ alignSelf: "flex-start", maxWidth: "92%" }}>
                    <div style={{ background: "rgba(26,110,60,0.06)", border: "1px solid rgba(26,110,60,0.15)", borderRadius: "12px 12px 12px 4px", padding: "11px 15px", fontSize: 13.5, color: "var(--text)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                      {m.text}
                    </div>
                  </div>
                )
              )}
              {sending && (
                <div style={{ alignSelf: "flex-start" }}>
                  <div style={{ background: "rgba(26,110,60,0.06)", border: "1px solid rgba(26,110,60,0.15)", borderRadius: "12px 12px 12px 4px", padding: "12px 16px", display: "inline-flex", gap: 4, alignItems: "center" }}>
                    {[0, 0.2, 0.4].map((d, i) => (
                      <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--text3)", animation: `blink 1.2s ${d}s infinite` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border)" }}>
          <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", alignItems: "center", gap: 10 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(input); }}
              placeholder="Pregunta algo sobre tus finanzas…"
              style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--border2)", borderRadius: 100, padding: "11px 16px", fontSize: 13.5, color: "var(--text)", fontFamily: "inherit", outline: "none" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border2)")}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || sending}
              style={{ width: 38, height: 38, borderRadius: "50%", background: input.trim() && !sending ? "var(--accent)" : "var(--card2)", border: "none", cursor: input.trim() && !sending ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.2s" }}
            >
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                <path d="M1 6h10M6.5 1.5L11 6l-4.5 4.5" stroke={input.trim() && !sending ? "#fff" : "var(--text3)"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
