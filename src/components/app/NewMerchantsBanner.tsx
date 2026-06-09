"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { authClient } from "@/lib/auth-client";

// Discreet banner below the app header when a monthly upload found new
// unclassified merchants (unread "new_merchants" notification).
export function NewMerchantsBanner() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    authClient.getSession().then(({ data }) => setUserId(data?.user?.id ?? null));
  }, []);

  const notifications = useQuery(
    api.notifications.getUnreadNotifications,
    userId ? {} : "skip"
  );

  const newMerchants = notifications?.find((n) => n.type === "new_merchants");
  if (!newMerchants || newMerchants.merchantPatterns.length === 0) return null;

  const count = newMerchants.merchantPatterns.length;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "9px 28px",
        background: "rgba(232,168,124,0.1)",
        borderBottom: "1px solid rgba(232,168,124,0.3)",
        fontSize: 13,
        color: "var(--text2)",
      }}
    >
      <span>
        Encontramos <strong style={{ color: "var(--text)" }}>{count}</strong>{" "}
        {count === 1 ? "comercio nuevo" : "comercios nuevos"} sin clasificar
      </span>
      <Link
        href="/app/clasificar"
        style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "underline", whiteSpace: "nowrap" }}
      >
        Clasificar ahora →
      </Link>
    </div>
  );
}
