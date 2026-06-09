"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { authClient } from "@/lib/auth-client";

type UploadPhase = "idle" | "uploading" | "processing" | "done" | "error";

const PHASE_LABELS: Record<UploadPhase, string> = {
  idle:       "",
  uploading:  "Subiendo archivo...",
  processing: "LlamaParse extrae el texto · Claude categoriza las transacciones...",
  done:       "",
  error:      "",
};

const PHASE_PCT: Record<UploadPhase, number> = {
  idle: 0, uploading: 20, processing: 60, done: 100, error: 0,
};

function fileTypeFromName(name: string): "pdf" | "csv" | "excel" {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "csv") return "csv";
  return "excel";
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ExtractosPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [fileName, setFileName] = useState("");
  const [resultCount, setResultCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(api.statements.generateUploadUrl);
  const processStatement = useAction(api.process.processStatement);
  const statements = useQuery(
    api.statements.listStatements,
    userId ? {} : "skip"
  );
  // Free plan: only the initial onboarding upload — afterwards uploads are
  // locked behind Pro (the backend enforces it too; this is just the UI)
  const subscription = useQuery(
    api.subscriptions.getSubscription,
    userId ? {} : "skip"
  );
  const onboarding = useQuery(
    api.users.getOnboardingStatus,
    userId ? {} : "skip"
  );
  const uploadsLocked =
    subscription?.plan === "free" && onboarding?.onboardingCompleted === true;

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      setUserId(data?.user?.id ?? null);
    });
  }, []);

  async function handleFile(files: FileList | null) {
    if (uploadsLocked) return;
    if (!files?.length || !userId || phase !== "idle") return;
    const file = files[0];
    const fileType = fileTypeFromName(file.name);

    setFileName(file.name);
    setErrorMsg("");
    setPhase("uploading");

    try {
      // 1. Obtener URL de subida de Convex storage
      const uploadUrl = await generateUploadUrl();

      // 2. Subir archivo directamente a Convex
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("Error al subir el archivo");
      const { storageId } = await uploadRes.json() as { storageId: Id<"_storage"> };

      // 3. Procesar: LlamaParse + Claude
      setPhase("processing");
      const { transactionCount } = await processStatement({
        storageId,
        filename: file.name,
        fileType,
      });

      setResultCount(transactionCount);
      setPhase("done");
      setTimeout(() => setPhase("idle"), 6000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error al procesar el archivo");
      setPhase("error");
      setTimeout(() => setPhase("idle"), 5000);
    }
  }

  const isProcessing = phase === "uploading" || phase === "processing";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Drop zone — swapped for an upgrade card when Free locked uploads */}
      {uploadsLocked ? (
        <div
          style={{
            border: "1px solid var(--border2)",
            borderRadius: 14,
            background: "var(--card)",
            padding: "40px 32px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "var(--card2)",
              border: "1px solid var(--border2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text2)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="4" y="9" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M7 9V6.5a3 3 0 016 0V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", marginBottom: 4 }}>
              Tus datos siguen accesibles, pero el plan Free no incluye nuevas subidas
            </p>
            <p style={{ fontSize: 13, color: "var(--text2)" }}>
              Pásate a Pro para subir extractos cada mes y mantener tu historial al día.
            </p>
          </div>
          <Link
            href="/app/ajustes?tab=suscripcion"
            style={{
              background: "var(--accent)",
              color: "#fff",
              borderRadius: 9,
              padding: "10px 22px",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              marginTop: 4,
            }}
          >
            Activar Pro — 7€/mes
          </Link>
        </div>
      ) : (
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files); }}
        onClick={() => phase === "idle" && inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? "var(--green)" : "var(--border2)"}`,
          borderRadius: 14,
          background: dragOver ? "var(--green-dim)" : "var(--card)",
          padding: "52px 40px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          cursor: phase === "idle" ? "pointer" : "default",
          transition: "all 0.2s",
          opacity: isProcessing ? 0.6 : 1,
        }}
      >
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: "var(--green-dim)", border: "1px solid rgba(26,110,60,0.18)",
          display: "flex", alignItems: "center", justifyContent: "center", color: "var(--green)",
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 16V4M8 8l4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3 16v2a2 2 0 002 2h14a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", marginBottom: 4 }}>
            Arrastra tu extracto bancario
          </p>
          <p style={{ fontSize: 13, color: "var(--text2)" }}>
            o{" "}
            <span style={{ color: "var(--accent)", fontWeight: 500, textDecoration: "underline" }}>
              selecciona un archivo
            </span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          {["PDF", "Excel", "CSV"].map((f) => (
            <span key={f} style={{
              fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100,
              background: "var(--bg)", border: "1px solid var(--border2)", color: "var(--text3)",
              letterSpacing: "0.3px",
            }}>
              {f}
            </span>
          ))}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.xlsx,.xls,.csv"
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files)}
        />
      </div>
      )}

      {/* Progress / resultado */}
      {phase !== "idle" && (
        <div style={{
          background: "var(--card)", border: `1px solid ${phase === "error" ? "rgba(208,96,96,0.3)" : "var(--border)"}`,
          borderRadius: 12, padding: "18px 20px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="2" y="1" width="10" height="12" rx="1.5" stroke="var(--text3)" strokeWidth="1.2"/>
                <path d="M5 4.5h4M5 7h4M5 9.5h2.5" stroke="var(--text3)" strokeWidth="1.1" strokeLinecap="round"/>
              </svg>
              <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>{fileName}</span>
            </div>
            <span style={{
              fontSize: 12, fontWeight: 600,
              color: phase === "done" ? "var(--green)" : phase === "error" ? "var(--red)" : "var(--text3)",
            }}>
              {phase === "error" ? "Error" : `${PHASE_PCT[phase]}%`}
            </span>
          </div>

          {phase !== "error" && (
            <div style={{ height: 6, background: "var(--bg)", borderRadius: 100, overflow: "hidden", marginBottom: 8 }}>
              <div style={{
                height: "100%",
                width: `${PHASE_PCT[phase]}%`,
                background: phase === "done" ? "var(--green)" : "var(--accent)",
                borderRadius: 100,
                transition: "width 1s ease",
              }} />
            </div>
          )}

          <p style={{
            fontSize: 12,
            color: phase === "done" ? "var(--green)" : phase === "error" ? "var(--red)" : "var(--text2)",
          }}>
            {phase === "done" && `✓ ${resultCount} transacciones encontradas y guardadas`}
            {phase === "error" && `✗ ${errorMsg}`}
            {(phase === "uploading" || phase === "processing") && PHASE_LABELS[phase]}
          </p>
        </div>
      )}

      {/* Historial */}
      <div>
        <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text3)", marginBottom: 12 }}>
          Historial de extractos
        </div>
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          {/* Header */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 90px 90px minmax(120px,auto)",
            padding: "10px 16px", background: "var(--card2)", borderBottom: "1px solid var(--border)",
            fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text3)",
          }}>
            <span>Documento</span>
            <span>Formato</span>
            <span>Transac.</span>
            <span>Estado</span>
          </div>

          {/* Empty state */}
          {(!statements || statements.length === 0) && (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text3)", fontSize: 13 }}>
              Aún no has subido ningún extracto
            </div>
          )}

          {/* Rows */}
          {statements?.map((doc, i) => (
            <div
              key={doc._id}
              style={{
                display: "grid", gridTemplateColumns: "1fr 90px 90px minmax(120px,auto)",
                padding: "12px 16px",
                borderBottom: i < statements.length - 1 ? "1px solid var(--border)" : "none",
                fontSize: 13, alignItems: "center", transition: "background 0.15s",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--card2)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
            >
              <div>
                <div style={{ color: "var(--text)", fontWeight: 500 }}>{doc.filename}</div>
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{formatDate(doc.uploadedAt)}</div>
              </div>
              <span style={{
                display: "inline-flex", padding: "2px 8px", borderRadius: 4,
                fontSize: 11, fontWeight: 600,
                background: "var(--bg)", border: "1px solid var(--border2)", color: "var(--text3)",
                width: "fit-content", textTransform: "uppercase",
              }}>
                {doc.fileType}
              </span>
              <span style={{ color: "var(--text2)" }}>
                {doc.transactionCount ?? "—"}
              </span>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 12, fontWeight: 500, padding: "3px 10px", borderRadius: 100,
                width: "fit-content",
                color: doc.status === "done" ? "var(--green)" : doc.status === "error" ? "var(--red)" : "var(--accent)",
                background: doc.status === "done" ? "var(--green-dim)" : doc.status === "error" ? "rgba(208,96,96,0.09)" : "rgba(200,180,154,0.1)",
                border: doc.status === "done" ? "1px solid rgba(26,110,60,0.2)" : doc.status === "error" ? "1px solid rgba(208,96,96,0.2)" : "1px solid rgba(200,180,154,0.2)",
              }}
                title={doc.errorMessage}
              >
                {doc.status === "done" && "✓ Procesado"}
                {doc.status === "error" && "✗ Error"}
                {doc.status === "processing" && "⏳ Procesando…"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
