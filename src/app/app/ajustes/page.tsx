"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { authClient } from "@/lib/auth-client";

// Base URL of the public HTTP API: the .convex.cloud client URL maps to
// .convex.site for HTTP actions
const API_BASE = (process.env.NEXT_PUBLIC_CONVEX_URL ?? "").replace(
  ".convex.cloud",
  ".convex.site"
);

type Tab = "suscripcion" | "api" | "notificaciones";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "suscripcion", label: "Suscripción" },
  { id: "api", label: "API" },
  { id: "notificaciones", label: "Notificaciones" },
];

function initialTab(): Tab {
  if (typeof window === "undefined") return "suscripcion";
  const t = new URLSearchParams(window.location.search).get("tab");
  return t === "api" || t === "notificaciones" || t === "suscripcion" ? t : "suscripcion";
}

// ?checkout=success|cancelled — set by the Stripe Checkout return URLs
function checkoutResult(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("checkout");
}

function formatDate(ts: number | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const cardStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  padding: 24,
};

const inputStyle: React.CSSProperties = {
  background: "var(--card2)",
  border: "1px solid var(--border2)",
  borderRadius: 9,
  padding: "9px 12px",
  fontSize: 13,
  color: "var(--text)",
  outline: "none",
  fontFamily: "inherit",
};

export default function AjustesPage() {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      setUserId(data?.user?.id ?? null);
    });
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 860 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--text)", margin: 0 }}>
          Ajustes
        </h1>
        <p style={{ fontSize: 13, color: "var(--text2)", marginTop: 4 }}>
          Configura tu cuenta y el acceso de servicios externos.
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)" }}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: "none",
                border: "none",
                borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                padding: "9px 16px 11px",
                fontSize: 13.5,
                fontWeight: active ? 600 : 400,
                color: active ? "var(--text)" : "var(--text2)",
                cursor: "pointer",
                fontFamily: "inherit",
                marginBottom: -1,
                transition: "color 0.15s",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "suscripcion" && <SuscripcionTab userId={userId} />}
      {tab === "api" && <ApiTab userId={userId} onUpgrade={() => setTab("suscripcion")} />}
      {tab === "notificaciones" && <NotificacionesTab />}
    </div>
  );
}

// ─── Pestaña Suscripción ─────────────────────────────────────────────────────

const PLAN_OPTIONS = [
  {
    interval: "month" as const,
    name: "Pro mensual",
    price: "7€",
    period: "/ mes",
    note: "Sin permanencia, cancela cuando quieras",
  },
  {
    interval: "year" as const,
    name: "Pro anual",
    price: "59€",
    period: "/ año",
    note: "Equivale a 4,9€/mes — ahorras 25€ al año",
  },
];

function SuscripcionTab({ userId }: { userId: string | null }) {
  const [redirecting, setRedirecting] = useState<"month" | "year" | "portal" | null>(null);
  const [error, setError] = useState("");
  // Read once on mount — Checkout redirects back with ?checkout=
  const [result] = useState(checkoutResult);

  const subscription = useQuery(
    api.subscriptions.getSubscription,
    userId ? {} : "skip"
  );
  const createCheckout = useAction(api.stripeActions.createCheckoutSession);
  const createPortal = useAction(api.stripeActions.createPortalSession);

  const isPro = subscription?.plan === "pro";

  // Stripe opens in a NEW tab. The blank tab must be opened synchronously in
  // the click handler — opening it after the await would trip popup blockers.
  async function handleUpgrade(interval: "month" | "year") {
    if (!userId || redirecting) return;
    const tab = window.open("", "_blank");
    setRedirecting(interval);
    setError("");
    try {
      const { url } = await createCheckout({ interval });
      if (tab) tab.location.assign(url);
      else window.location.assign(url); // popup blocked → same-tab fallback
    } catch (err) {
      tab?.close();
      setError(err instanceof Error ? err.message : "No se pudo iniciar el pago");
    } finally {
      setRedirecting(null);
    }
  }

  async function handlePortal() {
    if (!userId || redirecting) return;
    const tab = window.open("", "_blank");
    setRedirecting("portal");
    setError("");
    try {
      const { url } = await createPortal({});
      if (tab) tab.location.assign(url);
      else window.location.assign(url);
    } catch (err) {
      tab?.close();
      setError(err instanceof Error ? err.message : "No se pudo abrir el portal");
    } finally {
      setRedirecting(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Checkout result banners */}
      {result === "success" && (
        <div
          style={{
            background: "var(--green-dim)",
            border: "1px solid rgba(26,110,60,0.25)",
            borderRadius: 10,
            padding: "12px 16px",
            fontSize: 13,
            color: "var(--green)",
            fontWeight: 600,
          }}
        >
          ¡Pago completado! Tu plan Pro se activará en unos segundos.
          {!isPro && " Si no se refleja, recarga la página."}
        </div>
      )}
      {result === "cancelled" && (
        <div
          style={{
            background: "var(--card2)",
            border: "1px solid var(--border2)",
            borderRadius: 10,
            padding: "12px 16px",
            fontSize: 13,
            color: "var(--text2)",
          }}
        >
          Pago cancelado. Puedes intentarlo de nuevo cuando quieras.
        </div>
      )}

      {/* Current plan */}
      <section style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", margin: 0 }}>
              Plan actual:{" "}
              <span style={{ color: isPro ? "var(--green)" : "var(--text2)" }}>
                {subscription === undefined ? "…" : isPro ? "Pro" : "Free"}
              </span>
            </h2>
            <p style={{ fontSize: 12.5, color: "var(--text2)", marginTop: 6, marginBottom: 0 }}>
              {isPro ? (
                <>
                  {subscription?.interval === "year" ? "Facturación anual" : "Facturación mensual"}
                  {subscription?.currentPeriodEnd && (
                    <>
                      {" · "}
                      {subscription.cancelAtPeriodEnd ? "Acceso hasta el " : "Se renueva el "}
                      {new Date(subscription.currentPeriodEnd).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </>
                  )}
                </>
              ) : (
                "Incluye tu primera subida completa con análisis. Para subir extractos cada mes, pásate a Pro."
              )}
            </p>
          </div>
          {isPro && (
            <button
              onClick={handlePortal}
              disabled={redirecting !== null}
              style={{
                background: "var(--card2)",
                color: "var(--text)",
                border: "1px solid var(--border2)",
                borderRadius: 9,
                padding: "9px 16px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
                flexShrink: 0,
                opacity: redirecting === "portal" ? 0.6 : 1,
              }}
            >
              {redirecting === "portal" ? "Abriendo…" : "Gestionar suscripción"}
            </button>
          )}
        </div>
      </section>

      {/* Upgrade options (only for Free users) */}
      {!isPro && subscription !== undefined && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {PLAN_OPTIONS.map((p) => (
            <section key={p.interval} style={{ ...cardStyle, minWidth: 0 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", margin: 0 }}>
                {p.name}
              </h3>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 8 }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: "var(--text)", letterSpacing: "-1px" }}>
                  {p.price}
                </span>
                <span style={{ fontSize: 13, color: "var(--text2)" }}>{p.period}</span>
              </div>
              <p style={{ fontSize: 12, color: "var(--text2)", marginTop: 6, marginBottom: 16 }}>
                {p.note}
              </p>
              <button
                onClick={() => handleUpgrade(p.interval)}
                disabled={!userId || redirecting !== null}
                style={{
                  width: "100%",
                  background: "var(--accent)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 9,
                  padding: "10px 18px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: redirecting ? "default" : "pointer",
                  opacity: redirecting === p.interval ? 0.6 : 1,
                  fontFamily: "inherit",
                }}
              >
                {redirecting === p.interval ? "Redirigiendo a Stripe…" : `Activar ${p.name}`}
              </button>
            </section>
          ))}
        </div>
      )}

      {error && <p style={{ fontSize: 12.5, color: "var(--red)", margin: 0 }}>{error}</p>}

      <p style={{ fontSize: 11.5, color: "var(--text3)", margin: 0 }}>
        Pago seguro gestionado por Stripe. Puedes cancelar o cambiar de plan en
        cualquier momento desde «Gestionar suscripción».
      </p>
    </div>
  );
}

// ─── Pestaña API ─────────────────────────────────────────────────────────────

function ApiTab({ userId, onUpgrade }: { userId: string | null; onUpgrade: () => void }) {
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const keys = useQuery(api.apiKeys.listApiKeys, userId ? {} : "skip");
  const createApiKey = useAction(api.apiKeys.createApiKey);
  const revokeApiKey = useMutation(api.apiKeys.revokeApiKey);
  // La API es una función Pro (el backend también lo comprueba al crear claves)
  const subscription = useQuery(
    api.subscriptions.getSubscription,
    userId ? {} : "skip"
  );
  const isFree = subscription?.plan === "free";

  async function handleCreate() {
    if (!userId || creating) return;
    setCreating(true);
    setError("");
    try {
      const { key } = await createApiKey({
        name: newKeyName.trim() || "API key",
      });
      setCreatedKey(key);
      setCopied(false);
      setNewKeyName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la clave");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(keyId: Id<"api_keys">) {
    if (!userId) return;
    await revokeApiKey({ keyId });
  }

  async function copyKey() {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Free plan notice — API access is a Pro feature */}
      {isFree && (
        <div
          style={{
            background: "var(--card2)",
            border: "1px solid var(--border2)",
            borderRadius: 10,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            fontSize: 13,
            color: "var(--text2)",
          }}
        >
          <span>
            🔒 La API y las automatizaciones son funciones <strong style={{ color: "var(--text)" }}>Pro</strong>.
            Tus claves no se borran: quedan en pausa y se reactivan al volver a Pro.
          </span>
          <button
            onClick={onUpgrade}
            style={{
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 9,
              padding: "7px 14px",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            Activar Pro
          </button>
        </div>
      )}

      {/* ── Docs banner ─────────────────────────────────────────────── */}
      <div
        style={{
          ...cardStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "18px 24px",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text)", margin: 0 }}>
            Documentación de la API
          </h2>
          <p style={{ fontSize: 12.5, color: "var(--text2)", marginTop: 4, marginBottom: 0 }}>
            Endpoints, ejemplos y guía de integración con n8n, Zapier o tus scripts.
            {" "}URL base:{" "}
            <code style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: 11.5, color: "var(--accent)" }}>
              {API_BASE || "(configura NEXT_PUBLIC_CONVEX_URL)"}
            </code>
          </p>
        </div>
        <Link
          href="/docs/api"
          style={{
            background: "var(--accent)",
            color: "#fff",
            borderRadius: 9,
            padding: "9px 18px",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          Ver documentación →
        </Link>
      </div>

      {/* ── API keys ─────────────────────────────────────────────────── */}
      <section style={cardStyle}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", margin: 0 }}>
          Claves de API
        </h2>
        <p style={{ fontSize: 12.5, color: "var(--text2)", marginTop: 6, marginBottom: 18 }}>
          Las claves dan acceso completo de lectura y escritura a tus datos vía la API.
          Envíalas en la cabecera{" "}
          <code style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: 12, color: "var(--accent)" }}>
            Authorization: Bearer yld_...
          </code>
        </p>

        {/* Create */}
        <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
          <input
            type="text"
            placeholder="Nombre (p. ej. n8n producción)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={handleCreate}
            disabled={!userId || creating || isFree}
            title={isFree ? "Crear claves de API requiere el plan Pro" : undefined}
            style={{
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 9,
              padding: "9px 18px",
              fontSize: 13,
              fontWeight: 600,
              cursor: creating || isFree ? "default" : "pointer",
              opacity: creating || isFree ? 0.5 : 1,
              fontFamily: "inherit",
            }}
          >
            {creating ? "Creando…" : "Crear clave"}
          </button>
        </div>

        {error && (
          <p style={{ fontSize: 12.5, color: "var(--red)", marginTop: 6 }}>{error}</p>
        )}

        {/* Newly created key — shown exactly once */}
        {createdKey && (
          <div
            style={{
              background: "var(--green-dim)",
              border: "1px solid rgba(26,110,60,0.25)",
              borderRadius: 10,
              padding: "14px 16px",
              marginTop: 12,
            }}
          >
            <p style={{ fontSize: 12.5, color: "var(--green)", fontWeight: 600, margin: 0 }}>
              Clave creada. Cópiala ahora — no se volverá a mostrar.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
              <code
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  fontSize: 12.5,
                  color: "var(--text)",
                  background: "var(--card2)",
                  border: "1px solid var(--border2)",
                  borderRadius: 7,
                  padding: "7px 10px",
                  flex: 1,
                  overflowX: "auto",
                  whiteSpace: "nowrap",
                }}
              >
                {createdKey}
              </code>
              <button
                onClick={copyKey}
                style={{
                  background: "var(--card2)",
                  color: copied ? "var(--green)" : "var(--text)",
                  border: "1px solid var(--border2)",
                  borderRadius: 7,
                  padding: "7px 14px",
                  fontSize: 12.5,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  flexShrink: 0,
                }}
              >
                {copied ? "Copiada ✓" : "Copiar"}
              </button>
              <button
                onClick={() => setCreatedKey(null)}
                title="Cerrar"
                style={{
                  background: "none",
                  color: "var(--text3)",
                  border: "none",
                  fontSize: 16,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  flexShrink: 0,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Keys table */}
        {keys && keys.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 80px",
                gap: 8,
                padding: "8px 12px",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text3)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              <span>Nombre</span>
              <span>Clave</span>
              <span>Creada</span>
              <span>Último uso</span>
              <span />
            </div>
            {keys.map((k) => (
              <div
                key={k.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 80px",
                  gap: 8,
                  alignItems: "center",
                  padding: "10px 12px",
                  borderTop: "1px solid var(--border)",
                  fontSize: 12.5,
                  color: k.revoked ? "var(--text3)" : "var(--text)",
                  textDecoration: k.revoked ? "line-through" : "none",
                  minWidth: 0,
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {k.name}
                </span>
                <span style={{ fontFamily: "var(--font-dm-mono), monospace", fontSize: 12, color: "var(--text2)" }}>
                  {k.prefix}…
                </span>
                <span style={{ color: "var(--text2)" }}>{formatDate(k.createdAt)}</span>
                <span style={{ color: "var(--text2)" }}>{formatDate(k.lastUsedAt)}</span>
                {k.revoked ? (
                  <span style={{ fontSize: 11.5, color: "var(--text3)" }}>Revocada</span>
                ) : (
                  <button
                    onClick={() => handleRevoke(k.id)}
                    style={{
                      background: "none",
                      color: "var(--red)",
                      border: "1px solid var(--border2)",
                      borderRadius: 7,
                      padding: "4px 10px",
                      fontSize: 11.5,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Revocar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {keys && keys.length === 0 && (
          <p style={{ fontSize: 12.5, color: "var(--text3)", marginTop: 14 }}>
            Todavía no has creado ninguna clave.
          </p>
        )}
      </section>
    </div>
  );
}

// ─── Pestaña Notificaciones (placeholder) ────────────────────────────────────

function NotificacionesTab() {
  return (
    <section style={{ ...cardStyle, textAlign: "center", padding: "48px 24px" }}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "var(--card2)",
          border: "1px solid var(--border2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 14px",
          color: "var(--text2)",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path
            d="M9 2a5 5 0 00-5 5v2.5L2.5 12.5h13L14 9.5V7a5 5 0 00-5-5z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M7 15a2 2 0 004 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", margin: 0 }}>
        Notificaciones
      </h2>
      <p style={{ fontSize: 12.5, color: "var(--text2)", marginTop: 6, maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>
        Próximamente podrás configurar aquí los avisos de nuevos comercios,
        resúmenes mensuales y alertas de gasto.
      </p>
    </section>
  );
}
