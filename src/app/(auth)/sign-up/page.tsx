"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUp, authClient } from "@/lib/auth-client";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    await authClient.signIn.social({ provider: "google", callbackURL: "/app/dashboard" });
    setGoogleLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: err } = await signUp.email({ name, email, password });
    setLoading(false);
    if (err) {
      setError(err.message ?? "No se pudo crear la cuenta. Inténtalo de nuevo.");
    } else {
      router.push("/app/dashboard");
    }
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--bg)",
    border: "1px solid var(--border2)",
    borderRadius: 9,
    padding: "10px 14px",
    fontSize: 14,
    color: "var(--text)",
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 400,
        background: "var(--card)",
        border: "1px solid var(--border2)",
        borderRadius: 16,
        padding: "36px 32px",
      }}
    >
      <h1
        style={{
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: "-0.4px",
          color: "var(--text)",
          marginBottom: 6,
          fontFamily: "var(--font-playfair), Georgia, serif",
        }}
      >
        Crea tu cuenta
      </h1>
      <p style={{ fontSize: 13.5, color: "var(--text2)", marginBottom: 28 }}>
        Empieza gratis — sin tarjeta de crédito.
      </p>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={googleLoading}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          background: "var(--bg)",
          border: "1px solid var(--border2)",
          borderRadius: 100,
          padding: "10px",
          fontSize: 14,
          fontWeight: 500,
          color: "var(--text)",
          fontFamily: "inherit",
          cursor: googleLoading ? "default" : "pointer",
          marginBottom: 20,
          transition: "border-color 0.15s",
          opacity: googleLoading ? 0.6 : 1,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border2)")}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="18" height="18">
          <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>
          <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.32-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
          <path fill="#FBBC05" d="M11.68 28.18A13.9 13.9 0 0 1 10.8 24c0-1.45.25-2.86.68-4.18v-5.7H4.34A23.93 23.93 0 0 0 0 24c0 3.88.93 7.55 2.56 10.79l7.12-5.52z"/>
          <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.34 5.7c1.74-5.2 6.59-9.07 12.32-9.07z"/>
        </svg>
        {googleLoading ? "Redirigiendo…" : "Continuar con Google"}
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        <span style={{ fontSize: 12, color: "var(--text3)" }}>o con email</span>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text2)", display: "block", marginBottom: 6 }}>
            Nombre
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Tu nombre"
            style={fieldStyle}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border2)")}
          />
        </div>

        <div>
          <label style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text2)", display: "block", marginBottom: 6 }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="tu@email.com"
            style={fieldStyle}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border2)")}
          />
        </div>

        <div>
          <label style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text2)", display: "block", marginBottom: 6 }}>
            Contraseña
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="Mínimo 8 caracteres"
            style={fieldStyle}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border2)")}
          />
        </div>

        {error && (
          <p style={{ fontSize: 13, color: "var(--red)", margin: 0 }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            background: loading ? "var(--text3)" : "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 100,
            padding: "11px",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: loading ? "default" : "pointer",
            transition: "background 0.2s",
            marginTop: 4,
          }}
        >
          {loading ? "Creando cuenta…" : "Empezar gratis →"}
        </button>
      </form>

      <p style={{ fontSize: 13, color: "var(--text3)", textAlign: "center", marginTop: 24 }}>
        ¿Ya tienes cuenta?{" "}
        <Link href="/sign-in" style={{ color: "var(--accent)", fontWeight: 500, textDecoration: "none" }}>
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
