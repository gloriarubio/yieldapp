"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { useTaxonomy } from "@/hooks/useTaxonomy";
import {
  addMonths,
  computeBaseline,
  computeCategoryStats,
  detectSubscriptions,
  formatMonth,
  monthsToTarget,
} from "@/lib/projections";

function fmt(n: number) {
  return Math.round(n).toLocaleString("es-ES");
}

const card: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  padding: "20px 22px",
};

const sectionLabel: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.6px",
  color: "var(--text3)",
  marginBottom: 14,
};

const TREND_BADGE = {
  up: { label: "↗ subiendo", color: "var(--red)", bg: "var(--red-dim)" },
  down: { label: "↘ bajando", color: "var(--green)", bg: "var(--green-dim)" },
  flat: { label: "→ estable", color: "var(--text3)", bg: "var(--card2)" },
} as const;

export default function ProyeccionesPage() {
  const [userId, setUserId] = useState<string | null>(null);

  // Local uncommitted edits layered over the saved plan (autosaved below)
  const [localCuts, setLocalCuts] = useState<Record<string, number>>({});
  const [localCancelled, setLocalCancelled] = useState<Record<string, boolean>>({});
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalName, setGoalName] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [evalError, setEvalError] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { getColor } = useTaxonomy(userId);

  useEffect(() => {
    authClient.getSession().then(({ data }) => setUserId(data?.user?.id ?? null));
  }, []);

  const rawTransactions = useQuery(
    api.transactions.listTransactions,
    userId ? {} : "skip"
  );
  const subscription = useQuery(
    api.subscriptions.getSubscription,
    userId ? {} : "skip"
  );
  const plan = useQuery(
    api.projections.getProjectionPlan,
    userId ? {} : "skip"
  );
  const savePlan = useMutation(api.projections.saveProjectionPlan);
  const evaluatePlan = useAction(api.projectionsActions.evaluateProjectionPlan);

  // ── Stats from real data (medians, ranges, trends) ─────────────────────────
  const stats = useMemo(
    () => (rawTransactions ? computeCategoryStats(rawTransactions) : []),
    [rawTransactions]
  );
  const baseline = useMemo(
    () => (rawTransactions ? computeBaseline(rawTransactions) : null),
    [rawTransactions]
  );
  const subs = useMemo(
    () => (rawTransactions ? detectSubscriptions(rawTransactions) : []),
    [rawTransactions]
  );

  // ── Effective plan: local edits win over the saved document ────────────────
  const savedCuts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of plan?.categoryCuts ?? []) m.set(c.category, c.monthlyCut);
    return m;
  }, [plan]);

  const cutFor = (cat: string) => localCuts[cat] ?? savedCuts.get(cat) ?? 0;
  const isCancelled = (name: string) =>
    localCancelled[name] ?? (plan?.cancelledSubscriptions ?? []).includes(name);

  // Suscripciones has its own toggles — keep it out of the sliders to avoid
  // counting the same euro twice
  const sliderStats = stats.filter((s) => s.category !== "Suscripciones" && s.median >= 5);

  const cutsSavings = sliderStats.reduce((a, s) => a + cutFor(s.category), 0);
  const subsSavings = subs
    .filter((s) => s.active && isCancelled(s.name))
    .reduce((a, s) => a + s.monthlyAmount, 0);
  const extraMonthly = cutsSavings + subsSavings;

  const currentNet = baseline?.medianNet ?? 0;
  const simulatedNet = currentNet + extraMonthly;

  const target = plan?.targetAmount ?? null;
  const nowMonth = new Date().toISOString().slice(0, 7);
  const etaCurrent = target ? monthsToTarget(target, currentNet) : null;
  const etaSim = target ? monthsToTarget(target, simulatedNet) : null;

  // ── Autosave (debounced) ────────────────────────────────────────────────────
  function scheduleSave(nextCuts: Record<string, number>, nextCancelled: Record<string, boolean>) {
    if (!userId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const cuts = new Map(savedCuts);
      for (const [cat, val] of Object.entries(nextCuts)) cuts.set(cat, val);
      const cancelledNames = new Set(plan?.cancelledSubscriptions ?? []);
      for (const [name, on] of Object.entries(nextCancelled)) {
        if (on) cancelledNames.add(name);
        else cancelledNames.delete(name);
      }
      savePlan({
        goalName: plan?.goalName,
        targetAmount: plan?.targetAmount,
        targetDate: plan?.targetDate,
        categoryCuts: [...cuts.entries()]
          .filter(([, v]) => v > 0)
          .map(([category, monthlyCut]) => ({ category, monthlyCut })),
        cancelledSubscriptions: [...cancelledNames],
      }).catch(() => {});
    }, 700);
  }

  function setCut(cat: string, value: number) {
    const next = { ...localCuts, [cat]: value };
    setLocalCuts(next);
    scheduleSave(next, localCancelled);
  }

  function toggleSub(name: string) {
    const next = { ...localCancelled, [name]: !isCancelled(name) };
    setLocalCancelled(next);
    scheduleSave(localCuts, next);
  }

  async function saveGoal() {
    if (!userId) return;
    const amount = parseFloat(goalAmount.replace(",", "."));
    if (!goalName.trim() || !isFinite(amount) || amount <= 0) return;
    await savePlan({
      goalName: goalName.trim(),
      targetAmount: amount,
      targetDate: goalDate || undefined,
      categoryCuts: plan?.categoryCuts ?? [],
      cancelledSubscriptions: plan?.cancelledSubscriptions ?? [],
    });
    setEditingGoal(false);
  }

  async function handleEvaluate() {
    if (!userId || evaluating) return;
    setEvaluating(true);
    setEvalError("");
    try {
      // Flush pending edits so Claude sees the latest plan
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const cuts = new Map(savedCuts);
      for (const [cat, val] of Object.entries(localCuts)) cuts.set(cat, val);
      const cancelledNames = new Set(plan?.cancelledSubscriptions ?? []);
      for (const [name, on] of Object.entries(localCancelled)) {
        if (on) cancelledNames.add(name);
        else cancelledNames.delete(name);
      }
      await savePlan({
        goalName: plan?.goalName,
        targetAmount: plan?.targetAmount,
        targetDate: plan?.targetDate,
        categoryCuts: [...cuts.entries()]
          .filter(([, v]) => v > 0)
          .map(([category, monthlyCut]) => ({ category, monthlyCut })),
        cancelledSubscriptions: [...cancelledNames],
      });
      await evaluatePlan({});
    } catch {
      setEvalError("No se pudo generar el análisis. Inténtalo de nuevo.");
    } finally {
      setEvaluating(false);
    }
  }

  // ── Gates & loading ─────────────────────────────────────────────────────────
  if (!userId || rawTransactions === undefined || subscription === undefined || plan === undefined) {
    return <div style={{ color: "var(--text3)", fontSize: 13, padding: 20 }}>Cargando…</div>;
  }

  if (subscription.plan === "free") {
    return (
      <div style={{ ...card, border: "1px solid var(--border2)", padding: "56px 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center", maxWidth: 560, margin: "40px auto 0" }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--card2)", border: "1px solid var(--border2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text2)" }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="4" y="9" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7 9V6.5a3 3 0 016 0V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <p style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", margin: 0 }}>
          Las proyecciones interactivas son una función Pro
        </p>
        <p style={{ fontSize: 13, color: "var(--text2)", margin: 0, maxWidth: 380 }}>
          Define tu meta de ahorro, simula recortes con tus datos reales y descubre cuándo la alcanzarás.
        </p>
        <a href="/app/ajustes?tab=suscripcion" style={{ background: "var(--accent)", color: "#fff", borderRadius: 9, padding: "10px 22px", fontSize: 13, fontWeight: 600, textDecoration: "none", marginTop: 4 }}>
          Activar Pro — 7€/mes
        </a>
      </div>
    );
  }

  if (!baseline || baseline.monthsCount === 0 || stats.length === 0) {
    return (
      <div style={{ color: "var(--text3)", fontSize: 14, padding: "40px 0", textAlign: "center" }}>
        Sube un extracto bancario para construir tu plan de ahorro.
      </div>
    );
  }

  // ── Trajectory chart geometry ───────────────────────────────────────────────
  const horizon = Math.min(
    36,
    Math.max(12, etaSim !== null && etaSim !== undefined ? (etaSim ?? 0) + 3 : 12)
  );
  const W = 640;
  const H = 230;
  const PAD = { l: 8, r: 8, t: 12, b: 26 };
  const points = Array.from({ length: horizon + 1 }, (_, i) => ({
    current: currentNet * i,
    sim: simulatedNet * i,
  }));
  const yMax = Math.max(target ?? 0, points[horizon].sim, points[horizon].current, 100) * 1.08;
  const yMin = Math.min(0, points[horizon].sim, points[horizon].current);
  const xAt = (i: number) => PAD.l + (i / horizon) * (W - PAD.l - PAD.r);
  const yAt = (v: number) =>
    PAD.t + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);
  const path = (key: "current" | "sim") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(p[key]).toFixed(1)}`).join(" ");

  const hasGoal = target !== null && target > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Goal ─────────────────────────────────────────────────────────── */}
      <div style={card}>
        {!hasGoal && !editingGoal && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
                ¿Para qué estás ahorrando?
              </div>
              <p style={{ fontSize: 12.5, color: "var(--text2)", margin: "4px 0 0" }}>
                Define una meta y te diremos cuándo llegarás — y cómo llegar antes.
              </p>
            </div>
            <button
              onClick={() => { setEditingGoal(true); setGoalName(""); setGoalAmount(""); setGoalDate(""); }}
              style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
            >
              🎯 Definir meta
            </button>
          </div>
        )}

        {hasGoal && !editingGoal && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
                🎯 {plan?.goalName ?? "Meta"} — {fmt(target!)}€
                {plan?.targetDate && <span style={{ color: "var(--text2)", fontWeight: 400 }}> · objetivo {formatMonth(plan.targetDate)}</span>}
              </div>
              <p style={{ fontSize: 12.5, margin: "4px 0 0", color: "var(--text2)" }}>
                {etaCurrent === null
                  ? "A tu ritmo actual no llegarás — tu ahorro mensual típico es negativo o cero. Usa las palancas de abajo."
                  : <>A tu ritmo actual: <strong style={{ color: "var(--text)" }}>{formatMonth(addMonths(nowMonth, etaCurrent))}</strong></>}
                {extraMonthly > 0 && etaSim !== null && (
                  <> · Con tu plan: <strong style={{ color: "var(--green)" }}>{formatMonth(addMonths(nowMonth, etaSim))}</strong>
                  {etaCurrent !== null && etaSim < etaCurrent && ` (${etaCurrent - etaSim} meses antes)`}</>
                )}
              </p>
            </div>
            <button
              onClick={() => {
                setEditingGoal(true);
                setGoalName(plan?.goalName ?? "");
                setGoalAmount(String(target ?? ""));
                setGoalDate(plan?.targetDate ?? "");
              }}
              style={{ background: "var(--card2)", color: "var(--text2)", border: "1px solid var(--border2)", borderRadius: 9, padding: "7px 14px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}
            >
              Editar
            </button>
          </div>
        )}

        {editingGoal && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: "var(--text3)", flex: "2 1 180px" }}>
              Nombre de la meta
              <input value={goalName} onChange={(e) => setGoalName(e.target.value)} placeholder="Viaje a Japón, fondo de emergencia…" style={{ background: "var(--card2)", border: "1px solid var(--border2)", borderRadius: 9, padding: "9px 12px", fontSize: 13, color: "var(--text)", outline: "none", fontFamily: "inherit" }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: "var(--text3)", flex: "1 1 110px" }}>
              Importe (€)
              <input value={goalAmount} onChange={(e) => setGoalAmount(e.target.value)} placeholder="3000" inputMode="decimal" style={{ background: "var(--card2)", border: "1px solid var(--border2)", borderRadius: 9, padding: "9px 12px", fontSize: 13, color: "var(--text)", outline: "none", fontFamily: "inherit" }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: "var(--text3)", flex: "1 1 130px" }}>
              Fecha objetivo (opcional)
              <input type="month" value={goalDate} onChange={(e) => setGoalDate(e.target.value)} style={{ background: "var(--card2)", border: "1px solid var(--border2)", borderRadius: 9, padding: "8px 12px", fontSize: 13, color: "var(--text)", outline: "none", fontFamily: "inherit" }} />
            </label>
            <button onClick={saveGoal} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Guardar
            </button>
            <button onClick={() => setEditingGoal(false)} style={{ background: "none", color: "var(--text3)", border: "none", padding: "10px 6px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
        {[
          { label: "Ahorro típico actual", value: `${fmt(currentNet)}€/mes`, accent: false },
          { label: "Con tu plan", value: `${fmt(simulatedNet)}€/mes`, sub: extraMonthly > 0 ? `+${fmt(extraMonthly)}€ liberados` : "Mueve las palancas 👇", accent: true },
          { label: "En 12 meses", value: `${fmt(simulatedNet * 12)}€`, sub: extraMonthly > 0 ? `${fmt(extraMonthly * 12)}€ extra al año` : undefined, accent: false },
        ].map((k) => (
          <div key={k.label} style={{ ...card, padding: "16px 18px", minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text3)" }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", color: k.accent ? "var(--green)" : "var(--text)", marginTop: 6 }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: 11.5, color: "var(--text2)", marginTop: 3 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Trajectory ───────────────────────────────────────────────────── */}
      <div style={card}>
        <div style={sectionLabel}>Tu trayectoria de ahorro</div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
          {/* Goal line */}
          {hasGoal && yAt(target!) > PAD.t && (
            <>
              <line x1={PAD.l} x2={W - PAD.r} y1={yAt(target!)} y2={yAt(target!)} stroke="var(--red)" strokeWidth="1" strokeDasharray="5 4" opacity="0.6" />
              <text x={W - PAD.r} y={yAt(target!) - 5} textAnchor="end" fontSize="10" fill="var(--red)" opacity="0.8">
                {plan?.goalName ?? "Meta"} · {fmt(target!)}€
              </text>
            </>
          )}
          {/* Zero line */}
          {yMin < 0 && <line x1={PAD.l} x2={W - PAD.r} y1={yAt(0)} y2={yAt(0)} stroke="var(--border2)" strokeWidth="1" />}
          {/* Current pace */}
          <path d={path("current")} fill="none" stroke="var(--text3)" strokeWidth="1.5" strokeDasharray="4 4" />
          {/* Simulated pace */}
          <path d={path("sim")} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
          {/* X labels */}
          {[0, Math.round(horizon / 2), horizon].map((i) => (
            <text key={i} x={xAt(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === horizon ? "end" : "middle"} fontSize="10" fill="var(--text3)">
              {formatMonth(addMonths(nowMonth, i))}
            </text>
          ))}
        </svg>
        <div style={{ display: "flex", gap: 18, marginTop: 10, fontSize: 11.5, color: "var(--text2)", flexWrap: "wrap" }}>
          <span><span style={{ display: "inline-block", width: 18, borderTop: "2px dashed var(--text3)", verticalAlign: "middle", marginRight: 6 }} />Ritmo actual ({fmt(currentNet)}€/mes)</span>
          <span><span style={{ display: "inline-block", width: 18, borderTop: "3px solid var(--accent)", verticalAlign: "middle", marginRight: 6 }} />Con tu plan ({fmt(simulatedNet)}€/mes)</span>
          {hasGoal && <span style={{ color: "var(--red)" }}>― ― Meta</span>}
        </div>
      </div>

      {/* ── Levers: subscriptions ────────────────────────────────────────── */}
      {subs.length > 0 && (
        <div style={card}>
          <div style={sectionLabel}>Palanca rápida: tus suscripciones</div>
          <p style={{ fontSize: 12.5, color: "var(--text2)", margin: "0 0 14px" }}>
            Recortes que puedes ejecutar mañana mismo. Marca las que cancelarías:
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
            {subs.map((s) => {
              const cancelled = s.active && isCancelled(s.name);
              return (
                <label
                  key={s.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: cancelled ? "1px solid var(--green)" : "1px solid var(--border)",
                    background: cancelled ? "var(--green-dim)" : "var(--bg)",
                    cursor: s.active ? "pointer" : "default",
                    opacity: s.active ? 1 : 0.5,
                    minWidth: 0,
                  }}
                >
                  <input
                    type="checkbox"
                    disabled={!s.active}
                    checked={cancelled}
                    onChange={() => toggleSub(s.name)}
                    style={{ accentColor: "var(--green)", width: 15, height: 15, flexShrink: 0, cursor: s.active ? "pointer" : "default" }}
                  />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: cancelled ? "line-through" : "none" }}>
                    {s.name}
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: cancelled ? "var(--green)" : "var(--text2)", flexShrink: 0 }}>
                    {s.monthlyAmount.toLocaleString("es-ES", { minimumFractionDigits: 2 })}€
                  </span>
                </label>
              );
            })}
          </div>
          {subsSavings > 0 && (
            <p style={{ fontSize: 12.5, color: "var(--green)", fontWeight: 600, margin: "12px 0 0" }}>
              ✓ {fmt(subsSavings)}€/mes liberados cancelando suscripciones
            </p>
          )}
        </div>
      )}

      {/* ── Levers: category fine-tuning ─────────────────────────────────── */}
      <div style={card}>
        <div style={sectionLabel}>Ajuste fino por categoría</div>
        <p style={{ fontSize: 12.5, color: "var(--text2)", margin: "0 0 18px" }}>
          Tu gasto típico mensual (mediana) y cuánto simularías recortar. La tendencia compara tus últimos 3 meses con los anteriores.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {sliderStats.slice(0, 8).map((s) => {
            const { color } = getColor(s.category);
            const max = Math.max(1, Math.round(s.median));
            const cut = Math.min(cutFor(s.category), max);
            const trend = TREND_BADGE[s.trend];
            return (
              <div key={s.category} style={{ minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 500, color: "var(--text)" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    {s.category}
                    <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 100, color: trend.color, background: trend.bg }}>
                      {trend.label}
                    </span>
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text2)" }}>
                    típico {fmt(s.median)}€ <span style={{ color: "var(--text3)" }}>({fmt(s.p25)}–{fmt(s.p75)}€)</span>
                    {cut > 0 && <strong style={{ color: "var(--green)" }}> · −{fmt(cut)}€</strong>}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={max}
                  step={1}
                  value={cut}
                  onChange={(e) => setCut(s.category, Number(e.target.value))}
                  style={{ width: "100%", accentColor: cut > 0 ? "var(--green)" : "var(--border2)" }}
                />
                {s.topMerchant && (
                  <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 2 }}>
                    💡 {s.topMerchant.name} es el {s.topMerchant.sharePct}% de esta categoría (~{fmt(s.topMerchant.monthlyShare)}€/mes)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── AI verdict ───────────────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ ...sectionLabel, marginBottom: 0 }}>¿Es realista tu plan?</span>
          <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.5px", color: "var(--accent)", background: "rgba(30,61,44,0.09)", border: "1px solid rgba(30,61,44,0.18)", padding: "1px 6px", borderRadius: 100, textTransform: "uppercase" }}>
            IA
          </span>
        </div>

        {plan?.aiVerdict && (
          <p style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.65, margin: "0 0 6px", background: "rgba(26,110,60,0.06)", border: "1px solid rgba(26,110,60,0.14)", borderRadius: 10, padding: "12px 14px" }}>
            {plan.aiVerdict.text}
          </p>
        )}
        {plan?.aiVerdict && (
          <p style={{ fontSize: 11, color: "var(--text3)", margin: "0 0 12px" }}>
            Generado el {new Date(plan.aiVerdict.generatedAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
          </p>
        )}

        <button
          onClick={handleEvaluate}
          disabled={evaluating}
          style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 100, padding: "10px 22px", fontSize: 13, fontWeight: 600, cursor: evaluating ? "wait" : "pointer", opacity: evaluating ? 0.7 : 1, fontFamily: "inherit" }}
        >
          {evaluating ? "Analizando tu plan…" : plan?.aiVerdict ? "Volver a evaluar" : "Evaluar mi plan con IA"}
        </button>
        {evalError && <p style={{ fontSize: 12.5, color: "var(--red)", marginTop: 8 }}>{evalError}</p>}
      </div>
    </div>
  );
}
