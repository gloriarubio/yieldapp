"use client";

import { useState } from "react";
import type { AmbiguousMerchantGroup } from "@/lib/categorization";

export type MerchantAnswer = {
  category: string;
  isSubscription: boolean;
  /** "no contabilizar": keep the data but out of every analysis */
  exclude?: boolean;
};

function formatMerchantName(pattern: string): string {
  // "AMZN MKTP ES" → "Amzn Mktp Es" — legible but recognizable
  return pattern
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function fmtAmount(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y?.slice(2)}`;
}

const pillStyle = (active: boolean, disabled: boolean): React.CSSProperties => ({
  padding: "7px 16px",
  borderRadius: 100,
  fontSize: 13,
  fontWeight: active ? 600 : 400,
  fontFamily: "inherit",
  cursor: disabled ? "default" : "pointer",
  border: active ? "1px solid var(--accent)" : "1px solid var(--border2)",
  background: active ? "var(--accent)" : "var(--card)",
  color: active ? "#fff" : disabled ? "var(--text3)" : "var(--text2)",
  opacity: disabled && !active ? 0.5 : 1,
  transition: "all 0.15s",
});

export function MerchantQuestion({
  group,
  answer,
  allCategories,
  onAnswer,
}: {
  group: AmbiguousMerchantGroup;
  answer: MerchantAnswer | undefined;
  /** Every category the user can pick from ("Otra categoría…") */
  allCategories: string[];
  onAnswer: (answer: MerchantAnswer) => void;
}) {
  const [showTxs, setShowTxs] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const selected = answer?.category;
  const isSub = answer?.isSubscription ?? false;
  const excluded = answer?.exclude === true;
  const isTransfer = group.kind === "transfer";

  // The selected category might be a custom one — show it as an extra pill
  const pills = [...group.suggestedCategories];
  if (selected && !pills.includes(selected)) pills.push(selected);

  const otherOptions = allCategories.filter((c) => !pills.includes(c));

  function pick(category: string) {
    onAnswer({ category, isSubscription: isSub, exclude: false });
    setCreating(false);
  }

  function confirmNewCategory() {
    const name = newName.trim();
    if (!name) return;
    pick(name.charAt(0).toUpperCase() + name.slice(1));
    setNewName("");
  }

  return (
    <div
      style={{
        background: "var(--card)",
        border: excluded ? "1px dashed var(--border2)" : "1px solid var(--border)",
        borderRadius: 14,
        padding: "20px 22px",
        opacity: excluded ? 0.75 : 1,
        transition: "opacity 0.2s",
      }}
    >
      {/* Header: merchant + stats + badge */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.2px" }}>
            {formatMerchantName(group.merchantPattern)}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text2)", marginTop: 3 }}>
            {group.count} {group.count === 1 ? "movimiento" : "movimientos"} · {fmtAmount(group.totalAmount)}€
          </div>
        </div>

        {isTransfer ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 100, background: "rgba(59,158,219,0.12)", border: "1px solid rgba(59,158,219,0.35)", color: "#1E5E8A", whiteSpace: "nowrap", flexShrink: 0 }}>
            ↔ Transferencia detectada
          </span>
        ) : group.isSubscriptionCandidate ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 100, background: "rgba(232,168,124,0.14)", border: "1px solid rgba(232,168,124,0.4)", color: "#9C5F2E", whiteSpace: "nowrap", flexShrink: 0 }}>
            ↻ Posible suscripción
          </span>
        ) : null}
      </div>

      {isTransfer && (
        <p style={{ fontSize: 12.5, color: "var(--text2)", margin: "0 0 10px", lineHeight: 1.5 }}>
          Solo tú sabes qué es este dinero: ¿ahorro, vivienda, un gasto… o no debería contar en tu análisis?
        </p>
      )}

      {/* Real transactions behind the question */}
      <button
        onClick={() => setShowTxs((s) => !s)}
        style={{ background: "none", border: "none", padding: 0, fontSize: 12, color: "var(--accent)", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginBottom: showTxs ? 8 : 14 }}
      >
        {showTxs ? "▾ Ocultar movimientos" : `▸ Ver ${Math.min(group.transactions.length, 8)} ${group.transactions.length === 1 ? "movimiento" : "movimientos"}`}
      </button>

      {showTxs && (
        <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "4px 12px", marginBottom: 14 }}>
          {group.transactions.map((t, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "56px minmax(0,1fr) auto",
                gap: 10,
                alignItems: "baseline",
                padding: "7px 0",
                borderTop: i === 0 ? "none" : "1px solid var(--border)",
                fontSize: 12,
              }}
            >
              <span style={{ color: "var(--text3)", fontVariantNumeric: "tabular-nums" }}>{fmtDate(t.date)}</span>
              <span style={{ color: "var(--text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.description}
              </span>
              <span style={{ color: "var(--text)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                {t.amount.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
              </span>
            </div>
          ))}
          {group.count > group.transactions.length && (
            <div style={{ padding: "7px 0", fontSize: 11.5, color: "var(--text3)", borderTop: "1px solid var(--border)" }}>
              … y {group.count - group.transactions.length} más
            </div>
          )}
        </div>
      )}

      {/* Category pills + otra + no contabilizar */}
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
        {pills.map((cat) => (
          <button key={cat} onClick={() => pick(cat)} style={pillStyle(!excluded && selected === cat, excluded)}>
            {cat}
          </button>
        ))}

        {/* Otra categoría… (todas las del usuario + crear nueva) */}
        {!creating && (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value === "__new__") setCreating(true);
              else if (e.target.value) pick(e.target.value);
            }}
            style={{
              padding: "7px 12px",
              borderRadius: 100,
              fontSize: 13,
              fontFamily: "inherit",
              cursor: "pointer",
              border: "1px solid var(--border2)",
              background: "var(--card)",
              color: "var(--text2)",
              outline: "none",
              appearance: "auto",
            }}
          >
            <option value="">Otra categoría…</option>
            {otherOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
            <option value="__new__">➕ Crear categoría nueva</option>
          </select>
        )}

        {creating && (
          <span style={{ display: "inline-flex", gap: 6 }}>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmNewCategory();
                if (e.key === "Escape") { setCreating(false); setNewName(""); }
              }}
              placeholder="Nombre de la categoría"
              style={{ padding: "7px 12px", borderRadius: 100, fontSize: 13, fontFamily: "inherit", border: "1px solid var(--accent)", background: "var(--card)", color: "var(--text)", outline: "none", width: 170 }}
            />
            <button onClick={confirmNewCategory} style={{ ...pillStyle(true, false), padding: "7px 13px" }}>✓</button>
          </span>
        )}

        {/* No contabilizar */}
        <button
          onClick={() =>
            onAnswer({
              category: selected ?? group.suggestedCategories[0],
              isSubscription: false,
              exclude: !excluded,
            })
          }
          style={{
            padding: "7px 16px",
            borderRadius: 100,
            fontSize: 13,
            fontWeight: excluded ? 600 : 400,
            fontFamily: "inherit",
            cursor: "pointer",
            border: excluded ? "1px solid var(--red)" : "1px solid var(--border2)",
            background: excluded ? "var(--red-dim)" : "var(--card)",
            color: excluded ? "var(--red)" : "var(--text3)",
            transition: "all 0.15s",
          }}
          title="Se guarda pero no cuenta en dashboard, totales ni análisis"
        >
          🚫 No contabilizar
        </button>
      </div>

      {excluded && (
        <p style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 10, marginBottom: 0 }}>
          Estos movimientos se guardarán pero no contarán en tu análisis. Los futuros se excluirán automáticamente.
        </p>
      )}

      {/* Independent subscription toggle */}
      {!excluded && group.isSubscriptionCandidate && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 12.5, color: "var(--text2)", cursor: "pointer", width: "fit-content" }}>
          <input
            type="checkbox"
            checked={isSub}
            onChange={(e) =>
              onAnswer({ category: selected ?? group.suggestedCategories[0], isSubscription: e.target.checked, exclude: false })
            }
            style={{ accentColor: "var(--accent)", width: 15, height: 15, cursor: "pointer" }}
          />
          Es una suscripción recurrente
        </label>
      )}
    </div>
  );
}
