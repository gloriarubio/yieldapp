"use client";

import type { AmbiguousMerchantGroup } from "@/lib/categorization";

export type MerchantAnswer = {
  category: string;
  isSubscription: boolean;
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

export function MerchantQuestion({
  group,
  answer,
  onAnswer,
}: {
  group: AmbiguousMerchantGroup;
  answer: MerchantAnswer | undefined;
  onAnswer: (answer: MerchantAnswer) => void;
}) {
  const selected = answer?.category;
  const isSub = answer?.isSubscription ?? false;

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: "20px 22px",
      }}
    >
      {/* Header: merchant + stats */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.2px" }}>
            {formatMerchantName(group.merchantPattern)}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text2)", marginTop: 3 }}>
            {group.count} veces · {fmtAmount(group.totalAmount)}€
          </div>
        </div>

        {group.isSubscriptionCandidate && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11,
              fontWeight: 600,
              padding: "4px 10px",
              borderRadius: 100,
              background: "rgba(232,168,124,0.14)",
              border: "1px solid rgba(232,168,124,0.4)",
              color: "#9C5F2E",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            ↻ Posible suscripción
          </span>
        )}
      </div>

      {/* Original description examples */}
      <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 14, lineHeight: 1.5 }}>
        {group.examples.map((ex, i) => (
          <div key={i} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            «{ex}»
          </div>
        ))}
      </div>

      {/* Category pills — single select */}
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        {group.suggestedCategories.map((cat) => {
          const active = selected === cat;
          return (
            <button
              key={cat}
              onClick={() => onAnswer({ category: cat, isSubscription: isSub })}
              style={{
                padding: "7px 16px",
                borderRadius: 100,
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                fontFamily: "inherit",
                cursor: "pointer",
                border: active ? "1px solid var(--accent)" : "1px solid var(--border2)",
                background: active ? "var(--accent)" : "var(--card)",
                color: active ? "#fff" : "var(--text2)",
                transition: "all 0.15s",
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Independent subscription toggle */}
      {group.isSubscriptionCandidate && (
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 14,
            fontSize: 12.5,
            color: "var(--text2)",
            cursor: "pointer",
            width: "fit-content",
          }}
        >
          <input
            type="checkbox"
            checked={isSub}
            onChange={(e) =>
              onAnswer({ category: selected ?? group.suggestedCategories[0], isSubscription: e.target.checked })
            }
            style={{ accentColor: "var(--accent)", width: 15, height: 15, cursor: "pointer" }}
          />
          Es una suscripción recurrente
        </label>
      )}
    </div>
  );
}
