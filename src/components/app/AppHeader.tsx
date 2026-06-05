"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useMonth } from "@/components/app/MonthContext";

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

// Pages where the month selector is relevant
const MONTH_SELECTOR_ROUTES = ["/app/dashboard", "/app/transacciones"];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

export function AppHeader() {
  const { monthIdx, year, setMonth } = useMonth();
  const [firstName, setFirstName] = useState("");
  const pathname = usePathname();

  const showSelector = MONTH_SELECTOR_ROUTES.some((r) => pathname.startsWith(r));

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      setFirstName(data?.user?.name?.split(" ")[0] ?? "");
    });
  }, []);

  function goPrev() {
    if (monthIdx === 0) setMonth(11, year - 1);
    else setMonth(monthIdx - 1, year);
  }

  function goNext() {
    if (monthIdx === 11) setMonth(0, year + 1);
    else setMonth(monthIdx + 1, year);
  }

  return (
    <header
      style={{
        height: 60,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 28px",
        background: "var(--bg)",
        borderBottom: "1px solid var(--border)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.2px" }}>
        {getGreeting()}{firstName ? `, ${firstName}.` : "."}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {showSelector && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "var(--card)",
              border: "1px solid var(--border2)",
              borderRadius: 100,
              padding: "5px 4px 5px 12px",
              fontSize: 12.5,
              fontWeight: 500,
              color: "var(--text2)",
            }}
          >
            <button
              onClick={goPrev}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 14, lineHeight: 1, padding: "0 2px" }}
            >
              ‹
            </button>
            <span style={{ minWidth: 80, textAlign: "center", color: "var(--text)" }}>
              {MONTHS[monthIdx]} {year}
            </span>
            <button
              onClick={goNext}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 14, lineHeight: 1, padding: "0 2px" }}
            >
              ›
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
