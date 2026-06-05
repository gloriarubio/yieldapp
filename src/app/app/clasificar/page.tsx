"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { useTaxonomy } from "@/hooks/useTaxonomy";
import { normalizeMerchant, type AmbiguousMerchantGroup } from "@/lib/categorization";
import { MerchantQuestion, type MerchantAnswer } from "@/components/onboarding/MerchantQuestion";

// Mini version of onboarding step 3: classify only the new merchants found
// by the latest monthly upload (from the unread "new_merchants" notification).
export default function ClasificarPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, MerchantAnswer>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const { activeCategories } = useTaxonomy(userId);
  const saveOnboardingRules = useMutation(api.categoryRules.saveOnboardingRules);
  const markNotificationRead = useMutation(api.notifications.markNotificationRead);

  useEffect(() => {
    authClient.getSession().then(({ data }) => setUserId(data?.user?.id ?? null));
  }, []);

  const notifications = useQuery(
    api.notifications.getUnreadNotifications,
    userId ? { userId } : "skip"
  );
  const transactions = useQuery(
    api.transactions.listTransactions,
    userId ? { userId } : "skip"
  );

  const notification = notifications?.find((n) => n.type === "new_merchants");

  // Rebuild the question groups from the stored transactions
  const groups: AmbiguousMerchantGroup[] = useMemo(() => {
    if (!notification || !transactions) return [];

    const categoryNames = activeCategories.map((c) => c.name);

    return notification.merchantPatterns
      .map((pattern) => {
        const txs = transactions.filter((t) => {
          const p = t.merchantPattern ?? normalizeMerchant(t.description);
          return t.amount < 0 && (p === pattern || p.includes(pattern));
        });
        if (txs.length === 0) return null;

        // Mode of the currently assigned categories
        const freq = new Map<string, number>();
        for (const t of txs) freq.set(t.category, (freq.get(t.category) ?? 0) + 1);
        const mode = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];

        const alternates = categoryNames.filter((c) => c !== mode && c !== "Ingresos").slice(0, 2);

        const amounts = txs.map((t) => Math.abs(t.amount));
        const sameAmount = amounts.every((a) => Math.abs(a - amounts[0]) < 0.01);
        const months = new Set(txs.map((t) => t.date.slice(0, 7)));

        return {
          merchantPattern: pattern,
          totalAmount: amounts.reduce((a, b) => a + b, 0),
          count: txs.length,
          examples: txs.slice(0, 2).map((t) => t.description),
          suggestedCategories: [mode, ...alternates].slice(0, 3),
          isSubscriptionCandidate: sameAmount && months.size === txs.length && txs.length >= 2,
        };
      })
      .filter((g): g is AmbiguousMerchantGroup => g !== null);
  }, [notification, transactions, activeCategories]);

  // Preselect the current (AI) category on each group — derived at render,
  // explicit user choices in `answers` take precedence
  function answerFor(g: AmbiguousMerchantGroup): MerchantAnswer {
    return (
      answers[g.merchantPattern] ?? {
        category: g.suggestedCategories[0],
        isSubscription: g.isSubscriptionCandidate,
      }
    );
  }

  const allAnswered = groups.every((g) => answerFor(g).category);

  async function save() {
    if (!userId || !notification) return;
    setSaving(true);
    setError("");
    try {
      await saveOnboardingRules({
        userId,
        answers: groups.map((g) => ({
          merchantPattern: g.merchantPattern,
          category: answerFor(g).category,
          isSubscription: answerFor(g).isSubscription,
        })),
        completeOnboarding: false,
      });
      await markNotificationRead({ notificationId: notification._id });
      router.push("/app/dashboard");
    } catch {
      setSaving(false);
      setError("No se pudieron guardar tus respuestas. Inténtalo de nuevo.");
    }
  }

  if (!userId || notifications === undefined || transactions === undefined) {
    return <div style={{ color: "var(--text3)", fontSize: 13, padding: 20 }}>Cargando…</div>;
  }

  if (!notification || groups.length === 0) {
    return (
      <div style={{ color: "var(--text3)", fontSize: 14, padding: "40px 0", textAlign: "center" }}>
        No hay comercios pendientes de clasificar. ¡Todo al día!
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.5px", color: "var(--text)", marginBottom: 8, fontFamily: "var(--font-playfair), Georgia, serif" }}>
          Comercios nuevos sin clasificar
        </h1>
        <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>
          Tu último extracto incluye comercios que aún no conocemos. Confirma su categoría para que se clasifiquen automáticamente a partir de ahora.
        </p>
      </div>

      {groups.map((g) => (
        <MerchantQuestion
          key={g.merchantPattern}
          group={g}
          answer={answerFor(g)}
          onAnswer={(a) => setAnswers((prev) => ({ ...prev, [g.merchantPattern]: a }))}
        />
      ))}

      {error && <p style={{ fontSize: 13, color: "var(--red)" }}>{error}</p>}

      <button
        onClick={save}
        disabled={!allAnswered || saving}
        style={{
          alignSelf: "flex-start",
          background: allAnswered && !saving ? "var(--accent)" : "var(--border2)",
          color: allAnswered && !saving ? "#fff" : "var(--text3)",
          border: "none",
          borderRadius: 100,
          padding: "13px 28px",
          fontSize: 14,
          fontWeight: 600,
          cursor: allAnswered && !saving ? "pointer" : "default",
          fontFamily: "inherit",
        }}
      >
        {saving ? "Guardando..." : "Guardar clasificación"}
      </button>
    </div>
  );
}
