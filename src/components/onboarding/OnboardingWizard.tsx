"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import {
  getAmbiguousMerchants,
  resolveMerchantCategories,
  type AICategorization,
  type AmbiguousMerchantGroup,
} from "@/lib/categorization";
import { MerchantQuestion, type MerchantAnswer } from "./MerchantQuestion";
import { CategorySummary, type CategorySummaryRow } from "./CategorySummary";

// ─── Types ───────────────────────────────────────────────────────────────────

type ProcessedTx = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  confidence: "high" | "low";
  isSubscription: boolean;
  merchantPattern: string;
  categorySource: "rule" | "ai";
};

const QUESTIONS_PER_PAGE = 5;

function fileTypeFromName(name: string): "pdf" | "csv" | "excel" {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "csv") return "csv";
  return "excel";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Wizard ──────────────────────────────────────────────────────────────────

// Wizard state lives in local useState only — nothing is persisted to Convex
// until the final step (saveOnboardingRules). If the user refreshes mid-wizard
// they return to step 1.
export function OnboardingWizard({ userId }: { userId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(api.statements.generateUploadUrl);
  const processOnboardingStatement = useAction(api.onboarding.processOnboardingStatement);
  const saveOnboardingRules = useMutation(api.categoryRules.saveOnboardingRules);
  const consolidateMerchants = useMutation(api.transactions.consolidateMerchantCategories);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);

  // Per-file live progress comes from the statements subscription below
  // (the server action patches statement.progress as it works); these track
  // completed files and the quick final stages.
  const [fileResults, setFileResults] = useState<Record<string, number>>({});
  const [finalStage, setFinalStage] = useState(0); // 0=files, 1=subs, 2=questions, 3=done
  const [finalCounts, setFinalCounts] = useState({ subscriptions: 0, questions: 0 });
  const [processError, setProcessError] = useState("");

  // Real-time progress: Convex re-runs this query every time the action
  // patches statement.progress
  const liveStatements = useQuery(
    api.statements.listStatements,
    step === 2 ? { userId } : "skip"
  );

  const [transactions, setTransactions] = useState<ProcessedTx[]>([]);
  const [groups, setGroups] = useState<AmbiguousMerchantGroup[]>([]);
  const [answers, setAnswers] = useState<Record<string, MerchantAnswer>>({});
  const [questionPage, setQuestionPage] = useState(0);
  const [renames, setRenames] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // ── Step 1: file selection ─────────────────────────────────────────────────

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const accepted = [...list].filter((f) => /\.(pdf|xlsx|xls|csv)$/i.test(f.name));
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...accepted.filter((f) => !names.has(f.name))];
    });
  }

  // ── Step 2: processing ─────────────────────────────────────────────────────

  async function runProcessing() {
    setStep(2);
    setProcessError("");
    setFileResults({});
    setFinalStage(0);
    setFinalCounts({ subscriptions: 0, questions: 0 });

    // 1. Upload + process every file IN PARALLEL. Each server action patches
    //    its statement.progress (extracting → categorizing x/total), which
    //    reaches the UI through the liveStatements subscription.
    const settled = await Promise.allSettled(
      files.map(async (file) => {
        const uploadUrl = await generateUploadUrl();
        const uploadRes = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!uploadRes.ok) throw new Error(`Error al subir ${file.name}`);
        const { storageId } = (await uploadRes.json()) as { storageId: Id<"_storage"> };

        const { transactions: rows } = await processOnboardingStatement({
          userId,
          storageId,
          filename: file.name,
          fileType: fileTypeFromName(file.name),
        });

        setFileResults((prev) => ({ ...prev, [file.name]: rows.length }));
        return rows.map((r, i): ProcessedTx => ({ ...r, id: `${file.name}-${i}` }));
      })
    );

    const failed = settled.find((s): s is PromiseRejectedResult => s.status === "rejected");
    if (failed) {
      setProcessError(
        failed.reason instanceof Error ? failed.reason.message : "Error al procesar los extractos"
      );
      return;
    }

    const raw = settled.flatMap((s) => (s as PromiseFulfilledResult<ProcessedTx[]>).value);

    // Each file was categorized by an independent Claude call, so the same
    // merchant could get different verdicts across months. Unify by majority
    // vote and persist the exact same resolution server-side.
    const winners = resolveMerchantCategories(raw);
    const all = raw.map((t) =>
      t.categorySource === "ai" && winners.has(t.merchantPattern)
        ? { ...t, category: winners.get(t.merchantPattern)! }
        : t
    );
    if (winners.size > 0) {
      try {
        await consolidateMerchants({
          userId,
          assignments: [...winners.entries()].map(([merchantPattern, category]) => ({
            merchantPattern,
            category,
          })),
        });
      } catch {
        // Best-effort: questions/rules will fix any leftover inconsistency
      }
    }

    // 2. Detected subscriptions
    setFinalStage(1);
    const subPatterns = new Set(
      all.filter((t) => t.isSubscription).map((t) => t.merchantPattern)
    );
    setFinalCounts((c) => ({ ...c, subscriptions: subPatterns.size }));
    await sleep(450);

    // 3. Build the ambiguous-merchant questions
    setFinalStage(2);
    const aiResults: AICategorization[] = all
      .filter((t) => t.categorySource === "ai")
      .map((t) => ({
        id: t.id,
        category: t.category,
        isSubscription: t.isSubscription,
        confidence: t.confidence,
        merchantPattern: t.merchantPattern,
      }));
    const ambiguous = getAmbiguousMerchants(aiResults, all);
    setFinalCounts((c) => ({ ...c, questions: ambiguous.length }));
    await sleep(450);
    setFinalStage(3);

    // Preselect Claude's suggestion on every question
    const preset: Record<string, MerchantAnswer> = {};
    for (const g of ambiguous) {
      preset[g.merchantPattern] = {
        category: g.suggestedCategories[0],
        isSubscription: g.isSubscriptionCandidate,
      };
    }

    setTransactions(all);
    setGroups(ambiguous);
    setAnswers(preset);
    setQuestionPage(0);

    await sleep(300);
    setStep(ambiguous.length > 0 ? 3 : 4);
  }

  // ── Step 3: questions ──────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(groups.length / QUESTIONS_PER_PAGE));
  const visibleGroups = groups.slice(
    questionPage * QUESTIONS_PER_PAGE,
    (questionPage + 1) * QUESTIONS_PER_PAGE
  );
  const visibleAnswered = visibleGroups.every((g) => answers[g.merchantPattern]?.category);

  function continueQuestions() {
    if (questionPage < totalPages - 1) {
      setQuestionPage((p) => p + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setStep(4);
    }
  }

  // ── Step 4: summary + renames ──────────────────────────────────────────────

  // Category of a transaction once the user's answers are applied
  function effectiveCategory(tx: ProcessedTx): string {
    const ans = answers[tx.merchantPattern];
    const base = ans ? ans.category : tx.category;
    return renames[base] ?? base;
  }

  const summaryRows: CategorySummaryRow[] = useMemo(() => {
    const totals = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.amount >= 0) continue;
      const cat = effectiveCategory(tx);
      totals.set(cat, (totals.get(cat) ?? 0) + Math.abs(tx.amount));
    }
    const total = [...totals.values()].reduce((a, b) => a + b, 0);
    if (total === 0) return [];
    const max = Math.max(...totals.values());
    return [...totals.entries()]
      .map(([name, amount]) => ({
        name,
        amount,
        pct: Math.round((amount / total) * 100),
        bar: Math.round((amount / max) * 100),
      }))
      .sort((a, b) => b.amount - a.amount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, answers, renames]);

  function handleRename(from: string, to: string) {
    setRenames((prev) => {
      const next = { ...prev };
      // If "from" is itself the result of a previous rename, chase the chain
      const originalKey = Object.keys(next).find((k) => next[k] === from);
      if (originalKey) {
        if (originalKey === to) delete next[originalKey];
        else next[originalKey] = to;
      } else if (from !== to) {
        next[from] = to;
      }
      return next;
    });
  }

  async function finish() {
    setSaving(true);
    try {
      await saveOnboardingRules({
        userId,
        answers: groups.map((g) => ({
          merchantPattern: g.merchantPattern,
          category: answers[g.merchantPattern].category,
          isSubscription: answers[g.merchantPattern].isSubscription,
        })),
        renames: Object.entries(renames)
          .filter(([from, to]) => to.trim() && from !== to)
          .map(([from, to]) => ({ from, to: to.trim() })),
        completeOnboarding: true,
      });
      router.replace("/app/dashboard");
    } catch {
      setSaving(false);
      setProcessError("No se pudieron guardar tus respuestas. Inténtalo de nuevo.");
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Step indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            style={{
              height: 4,
              flex: 1,
              borderRadius: 100,
              background: s <= step ? "var(--accent)" : "var(--border2)",
              transition: "background 0.3s",
            }}
          />
        ))}
      </div>

      {/* ── STEP 1 — Upload ──────────────────────────────────────────────── */}
      {step === 1 && (
        <>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.6px", color: "var(--text)", marginBottom: 8, fontFamily: "var(--font-playfair), Georgia, serif" }}>
              Empecemos con tus extractos
            </h1>
            <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>
              Cuantos más meses subas, más precisas serán tus categorías desde el primer día.
            </p>
          </div>

          {/* TODO(spec): the drop zone in /app/extractos is single-file and inline;
              this one supports multiple files. Extracting a shared component is
              pending — for now this is the multi-file variant. */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? "var(--green)" : "var(--border2)"}`,
              borderRadius: 14,
              background: dragOver ? "var(--green-dim)" : "var(--card)",
              padding: "48px 36px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            <div style={{ width: 56, height: 56, borderRadius: 14, background: "var(--green-dim)", border: "1px solid rgba(26,110,60,0.18)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--green)" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 16V4M8 8l4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 16v2a2 2 0 002 2h14a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", marginBottom: 4 }}>
                Arrastra tus extractos bancarios
              </p>
              <p style={{ fontSize: 13, color: "var(--text2)" }}>
                o <span style={{ color: "var(--accent)", fontWeight: 500, textDecoration: "underline" }}>selecciona archivos</span> — puedes subir varios a la vez
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              {["PDF", "Excel", "CSV"].map((f) => (
                <span key={f} style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: "var(--bg)", border: "1px solid var(--border2)", color: "var(--text3)", letterSpacing: "0.3px" }}>
                  {f}
                </span>
              ))}
            </div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.xlsx,.xls,.csv"
              style={{ display: "none" }}
              onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
            />
          </div>

          {/* Selected files */}
          {files.length > 0 && (
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
              {files.map((f, i) => (
                <div key={f.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: i < files.length - 1 ? "1px solid var(--border)" : "none", fontSize: 13 }}>
                  <span style={{ color: "var(--text)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.name}
                  </span>
                  <button
                    onClick={() => setFiles((prev) => prev.filter((x) => x.name !== f.name))}
                    style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 15, padding: "0 4px", lineHeight: 1 }}
                    aria-label={`Quitar ${f.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={runProcessing}
            disabled={files.length === 0}
            style={{
              alignSelf: "flex-start",
              display: "inline-flex",
              alignItems: "center",
              gap: 9,
              background: files.length === 0 ? "var(--border2)" : "var(--accent)",
              color: files.length === 0 ? "var(--text3)" : "#fff",
              padding: "13px 28px",
              borderRadius: 100,
              fontSize: 14,
              fontWeight: 600,
              border: "none",
              cursor: files.length === 0 ? "default" : "pointer",
              fontFamily: "inherit",
              letterSpacing: "-0.1px",
            }}
          >
            Analizar extractos
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <p style={{ fontSize: 12.5, color: "var(--text3)" }}>
            ¿No tienes el PDF? Puedes subir un Excel o CSV exportado desde tu banco.
          </p>
        </>
      )}

      {/* ── STEP 2 — Processing ──────────────────────────────────────────── */}
      {step === 2 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "28px 26px" }}>
          <h2 style={{ fontSize: 21, fontWeight: 500, letterSpacing: "-0.4px", color: "var(--text)", marginBottom: 6, fontFamily: "var(--font-playfair), Georgia, serif" }}>
            Analizando tus extractos
          </h2>
          <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 22 }}>
            Procesamos tus archivos en paralelo — esto puede tardar un par de minutos.
          </p>

          {/* Per-file live progress (from the Convex subscription) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {files.map((f) => {
              const doneCount = fileResults[f.name];
              const st = liveStatements?.find(
                (s) => s.filename === f.name && s.status === "processing"
              );
              const phase = st?.progress?.phase;

              let label: string;
              let state: "done" | "active" | "error";
              if (doneCount !== undefined) {
                state = "done";
                label = `${doneCount} transacciones`;
              } else if (processError) {
                state = "error";
                label = "Error al procesar";
              } else if (phase === "categorizing") {
                state = "active";
                label = `Categorizando ${st?.progress?.categorized ?? 0} de ${st?.progress?.total ?? "?"}...`;
              } else if (phase === "extracting") {
                state = "active";
                label = "Extrayendo transacciones...";
              } else {
                state = "active";
                label = "Subiendo archivo...";
              }

              return (
                <div key={f.name} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5 }}>
                  <span style={{ width: 20, textAlign: "center", flexShrink: 0 }}>
                    {state === "done" && <span style={{ color: "var(--green)", fontWeight: 700 }}>✓</span>}
                    {state === "error" && <span style={{ color: "var(--red)", fontWeight: 700 }}>✗</span>}
                    {state === "active" && <span style={{ display: "inline-block", width: 13, height: 13, border: "2px solid var(--border2)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
                  </span>
                  <span style={{ color: "var(--text)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>
                    {f.name}
                  </span>
                  <span style={{ color: state === "done" ? "var(--green)" : "var(--text2)", fontWeight: state === "done" ? 600 : 400 }}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Quick final stages once every file is done */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            {[
              { idx: 1, pending: "Detectando suscripciones...", done: `${finalCounts.subscriptions} detectadas` },
              { idx: 2, pending: "Preparando tus preguntas...", done: `${finalCounts.questions} preguntas` },
            ].map(({ idx, pending, done }) => {
              const state = finalStage > idx ? "done" : finalStage === idx ? "active" : "pending";
              return (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: state === "pending" ? "var(--text3)" : "var(--text)", opacity: state === "pending" ? 0.55 : 1 }}>
                  <span style={{ width: 20, textAlign: "center", flexShrink: 0 }}>
                    {state === "done" && <span style={{ color: "var(--green)", fontWeight: 700 }}>✓</span>}
                    {state === "active" && <span style={{ display: "inline-block", width: 13, height: 13, border: "2px solid var(--border2)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
                    {state === "pending" && "·"}
                  </span>
                  <span>
                    {state === "done" ? (
                      <>{pending.replace("...", "")} <span style={{ color: "var(--green)", fontWeight: 600 }}>✓ {done}</span></>
                    ) : pending}
                  </span>
                </div>
              );
            })}
          </div>

          {processError && (
            <div style={{ marginTop: 22, padding: "14px 16px", background: "var(--red-dim)", border: "1px solid rgba(168,48,48,0.25)", borderRadius: 10 }}>
              <p style={{ fontSize: 13, color: "var(--red)", marginBottom: 12 }}>{processError}</p>
              <button
                onClick={() => {
                  setProcessError("");
                  // Files that finished are already saved — don't reprocess them
                  setFiles((prev) => prev.filter((f) => fileResults[f.name] === undefined));
                  setStep(1);
                }}
                style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 100, padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                Reintentar
              </button>
            </div>
          )}

          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ── STEP 3 — Questions ───────────────────────────────────────────── */}
      {step === 3 && (
        <>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.5px", color: "var(--text)", marginBottom: 8, fontFamily: "var(--font-playfair), Georgia, serif" }}>
              Ayúdanos con estos comercios
            </h2>
            <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>
              No estamos seguros de cómo clasificar estos gastos. Confirma la categoría de cada uno
              {totalPages > 1 && ` (página ${questionPage + 1} de ${totalPages})`}.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 80 }}>
            {visibleGroups.map((g) => (
              <MerchantQuestion
                key={g.merchantPattern}
                group={g}
                answer={answers[g.merchantPattern]}
                onAnswer={(a) => setAnswers((prev) => ({ ...prev, [g.merchantPattern]: a }))}
              />
            ))}
          </div>

          {/* Fixed continue bar */}
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--bg)", borderTop: "1px solid var(--border)", padding: "14px 24px", display: "flex", justifyContent: "center", zIndex: 20 }}>
            <button
              onClick={continueQuestions}
              disabled={!visibleAnswered}
              style={{
                width: "100%",
                maxWidth: 480,
                background: visibleAnswered ? "var(--accent)" : "var(--border2)",
                color: visibleAnswered ? "#fff" : "var(--text3)",
                border: "none",
                borderRadius: 100,
                padding: "13px 28px",
                fontSize: 14,
                fontWeight: 600,
                cursor: visibleAnswered ? "pointer" : "default",
                fontFamily: "inherit",
              }}
            >
              {questionPage < totalPages - 1 ? "Continuar" : "Ver resumen"}
            </button>
          </div>
        </>
      )}

      {/* ── STEP 4 — Confirmation ────────────────────────────────────────── */}
      {step === 4 && (
        <>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.5px", color: "var(--text)", marginBottom: 8, fontFamily: "var(--font-playfair), Georgia, serif" }}>
              Así quedan tus categorías
            </h2>
            <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>
              {transactions.length} transacciones analizadas. Revisa el resumen y renombra cualquier categoría a tu gusto.
            </p>
          </div>

          <CategorySummary rows={summaryRows} onRename={handleRename} />

          {processError && (
            <p style={{ fontSize: 13, color: "var(--red)" }}>{processError}</p>
          )}

          <button
            onClick={finish}
            disabled={saving}
            style={{
              alignSelf: "flex-start",
              display: "inline-flex",
              alignItems: "center",
              gap: 9,
              background: "var(--accent)",
              color: "#fff",
              padding: "13px 28px",
              borderRadius: 100,
              fontSize: 14,
              fontWeight: 600,
              border: "none",
              cursor: saving ? "default" : "pointer",
              fontFamily: "inherit",
              opacity: saving ? 0.6 : 1,
              letterSpacing: "-0.1px",
            }}
          >
            {saving ? "Guardando..." : "Ver mi dashboard"}
            {!saving && (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </>
      )}
    </div>
  );
}
