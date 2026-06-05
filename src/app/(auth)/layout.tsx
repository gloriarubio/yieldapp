import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "var(--bg)",
      }}
    >
      {/* Logo */}
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          fontWeight: 600,
          fontSize: 17,
          letterSpacing: "-0.2px",
          color: "var(--text)",
          textDecoration: "none",
          marginBottom: 36,
        }}
      >
        <svg width="28" height="20" viewBox="0 0 30 22" fill="none" style={{ flexShrink: 0 }}>
          <path d="M2 18C5.5 18 8 5 13.5 5C19 5 19.5 13 25.5 9.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none"/>
          <circle cx="25.5" cy="9.5" r="2.5" fill="currentColor"/>
        </svg>
        Yield
      </Link>

      {children}
    </div>
  );
}
