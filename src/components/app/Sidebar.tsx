"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { signOut, authClient } from "@/lib/auth-client";

const navItems = [
  {
    label: "Dashboard",
    href: "/app/dashboard",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".9"/>
        <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".4"/>
        <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".4"/>
        <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".6"/>
      </svg>
    ),
  },
  {
    label: "Transacciones",
    href: "/app/transacciones",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 4h12M2 8h9M2 12h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    label: "Proyecciones",
    href: "/app/proyecciones",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M1.5 12.5l4-4 3 2.5 5.5-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="14" cy="3.5" r="1.5" fill="currentColor" opacity=".4"/>
      </svg>
    ),
  },
  {
    label: "Extractos",
    href: "/app/extractos",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="3" y="1.5" width="10" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.4" opacity=".4"/>
        <path d="M6 5.5h4M6 8h4M6 10.5h2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <path d="M8 13v2M6 14l2 1.5 2-1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity=".5"/>
      </svg>
    ),
  },
];

const menuItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  width: "100%",
  padding: "8px 12px",
  borderRadius: 8,
  fontSize: 13,
  color: "var(--text2)",
  background: "none",
  border: "none",
  cursor: "pointer",
  fontFamily: "inherit",
  textDecoration: "none",
  transition: "background 0.12s, color 0.12s",
  textAlign: "left",
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const initial = firstName.charAt(0).toUpperCase() || "?";

  const subscription = useQuery(
    api.subscriptions.getSubscription,
    userId ? { userId } : "skip"
  );
  const isPro = subscription?.plan === "pro";

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      setFirstName(data?.user?.name?.split(" ")[0] ?? "");
      setUserId(data?.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function handleSignOut() {
    await signOut();
    router.push("/sign-in");
  }

  return (
    <aside
      style={{
        width: 200,
        flexShrink: 0,
        background: "var(--card)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "sticky",
        top: 0,
        overflowY: "auto",
      }}
    >
      {/* Logo */}
      <div style={{ padding: "20px 16px 18px", borderBottom: "1px solid var(--border)" }}>
        <Link
          href="/app/dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            fontWeight: 700,
            fontSize: 16,
            color: "var(--text)",
            textDecoration: "none",
            letterSpacing: "-0.2px",
          }}
        >
          <svg width="24" height="18" viewBox="0 0 30 22" fill="none" style={{ flexShrink: 0 }}>
            <path d="M2 18C5.5 18 8 5 13.5 5C19 5 19.5 13 25.5 9.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none"/>
            <circle cx="25.5" cy="9.5" r="2.5" fill="currentColor"/>
          </svg>
          Yield
        </Link>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 10px" }}>
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 10px",
                borderRadius: 9,
                fontSize: 13.5,
                fontWeight: active ? 500 : 400,
                color: active ? "var(--text)" : "var(--text2)",
                background: active ? "var(--card2)" : "transparent",
                textDecoration: "none",
                marginBottom: 2,
                transition: "all 0.15s",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: active ? "var(--green)" : "transparent",
                  border: active ? "none" : "1px solid var(--border2)",
                  flexShrink: 0,
                  transition: "all 0.15s",
                }}
              />
              <span style={{ color: active ? "var(--accent)" : "var(--text2)", flexShrink: 0 }}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        ref={dropdownRef}
        style={{ padding: "14px 16px", borderTop: "1px solid var(--border)", position: "relative" }}
      >
        {/* Dropdown */}
        {open && (
          <div
            style={{
              position: "absolute",
              bottom: "calc(100% + 6px)",
              left: 12,
              right: 12,
              background: "var(--card2)",
              border: "1px solid var(--border2)",
              borderRadius: 10,
              padding: 4,
              boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
              zIndex: 50,
            }}
          >
            <Link
              href="/app/ajustes"
              style={menuItemStyle}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--card)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; }}
              onClick={() => setOpen(false)}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M6.5 4v3l2 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              Ajustes
            </Link>
            <button
              onClick={handleSignOut}
              style={{ ...menuItemStyle, color: "var(--red)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--card)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M5 2H2.5A1.5 1.5 0 001 3.5v6A1.5 1.5 0 002.5 11H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <path d="M9 9l3-2.5L9 4M12 6.5H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Cerrar sesión
            </button>
          </div>
        )}

        {/* Avatar + Plan badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setOpen((o) => !o)}
            title={firstName || "Cuenta"}
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "var(--accent)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              flexShrink: 0,
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.8"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
          >
            {initial}
          </button>

          {/* Real plan from Stripe — Free badge links to the upgrade tab */}
          <Link
            href="/app/ajustes?tab=suscripcion"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 100,
              fontSize: 11,
              fontWeight: 600,
              background: isPro ? "var(--green-dim)" : "var(--card2)",
              color: isPro ? "var(--green)" : "var(--text2)",
              border: isPro ? "1px solid rgba(26,110,60,0.18)" : "1px solid var(--border2)",
              textDecoration: "none",
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: isPro ? "var(--green)" : "var(--text3)",
              }}
            />
            {subscription === undefined && userId ? "…" : isPro ? "Plan Pro" : "Plan Free"}
          </Link>
        </div>
      </div>
    </aside>
  );
}
