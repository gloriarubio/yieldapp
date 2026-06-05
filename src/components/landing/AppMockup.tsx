"use client";

import { useEffect, useRef, useState } from "react";

const AI_TEXT =
  "Tu mayor gasto este mes es Supermercado con 502€, un 23% del total. En comparación con abril, subió un 12%. ¿Quieres consejos para reducirlo?";

const bars = [
  { h: "52%", lbl: "Dic", delay: "1.1s" },
  { h: "37%", lbl: "Ene", delay: "1.2s" },
  { h: "65%", lbl: "Feb", delay: "1.3s" },
  { h: "48%", lbl: "Mar", delay: "1.4s" },
  { h: "70%", lbl: "Abr", delay: "1.5s" },
  { h: "88%", lbl: "May", delay: "1.6s", current: true },
];

const kpis = [
  { label: "Ingresos",    count: 3240, suffix: "€", delta: "↑ 5.2% vs abril", pos: true },
  { label: "Gastos",      count: 2180, suffix: "€", delta: "↓ 3.1% vs abril", pos: false },
  { label: "Ahorro neto", count: 1060, suffix: "€", delta: "32.7% del sueldo", pos: true },
];

// Counts up from 0 → target in ~1.4s once `run` becomes true
function useCountUp(target: number, run: boolean) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!run) return;
    let cur = 0;
    const fps = 1000 / 60;
    const steps = 1400 / fps;
    const inc = target / steps;
    const id = setInterval(() => {
      cur = Math.min(cur + inc, target);
      setVal(Math.floor(cur));
      if (cur >= target) clearInterval(id);
    }, fps);
    return () => clearInterval(id);
  }, [run, target]);
  return val;
}

function KpiCard({ label, count, suffix, delta, pos, run }: typeof kpis[0] & { run: boolean }) {
  const val = useCountUp(count, run);
  return (
    <div style={{
      background: "var(--bg)", border: "1px solid var(--border)",
      borderRadius: "var(--r-sm, 9px)", padding: "12px 14px",
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text3)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-1px", lineHeight: 1, marginBottom: 4, color: "var(--text)" }}>
        {val.toLocaleString("es-ES")}{suffix}
      </div>
      <div style={{ fontSize: "10.5px", fontWeight: 500, color: pos ? "var(--green)" : "var(--red)" }}>{delta}</div>
    </div>
  );
}

interface AppMockupProps {
  dashRef?: React.RefObject<HTMLDivElement | null>;
}

export function AppMockup({ dashRef }: AppMockupProps) {
  const kpiRef = useRef<HTMLDivElement>(null);
  const [kpiRun, setKpiRun] = useState(false);

  // AI typewriter state
  const [aiText, setAiText] = useState("");
  const [aiTyping, setAiTyping] = useState(true);
  const charIdx = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // KPI count-up triggered by IntersectionObserver
  useEffect(() => {
    const el = kpiRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setKpiRun(true); obs.disconnect(); }
    }, { threshold: 0.4 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // AI typewriter loop
  useEffect(() => {
    function typeChar() {
      charIdx.current++;
      setAiText(AI_TEXT.slice(0, charIdx.current));
      if (charIdx.current < AI_TEXT.length) {
        timerRef.current = setTimeout(typeChar, 28);
      } else {
        timerRef.current = setTimeout(reset, 5000);
      }
    }
    function reset() {
      charIdx.current = 0;
      setAiText("");
      setAiTyping(true);
      timerRef.current = setTimeout(startTyping, 1200);
    }
    function startTyping() {
      setAiTyping(false);
      typeChar();
    }
    timerRef.current = setTimeout(startTyping, 2200);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <div
      ref={dashRef}
      style={{
        background: "var(--card)",
        border: "1px solid var(--border2)",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 50px 120px rgba(0,0,0,.7), 0 0 0 1px var(--border), inset 0 1px 0 var(--border2)",
        transition: "transform 0.5s var(--ease), box-shadow 0.5s",
      }}
    >
      {/* Browser chrome */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", background: "var(--card2)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", gap: 5 }}>
          {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
            <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
          ))}
        </div>
        <div style={{ flex: 1, margin: "0 14px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 14px", fontSize: "11.5px", color: "var(--text3)", textAlign: "center", letterSpacing: "0.2px" }}>
          app.yield.es/dashboard
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "10.5px", fontWeight: 600, color: "var(--green)", background: "var(--green-dim)", padding: "4px 10px", borderRadius: 100, border: "1px solid rgba(82,208,126,.15)" }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", animation: "pulse 1.5s infinite" }} />
          En vivo
        </div>
      </div>

      {/* Dashboard body */}
      <div style={{ display: "grid", gridTemplateColumns: "168px 1fr 210px", minHeight: 380 }}>

        {/* Sidebar */}
        <div style={{ padding: "18px 12px", background: "var(--card2)", borderRight: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14, padding: "4px 8px", marginBottom: 22, color: "var(--text)" }}>
            <svg width="16" height="12" viewBox="0 0 30 22" fill="none">
              <path d="M2 18C5.5 18 8 5 13.5 5C19 5 19.5 13 25.5 9.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
              <circle cx="25.5" cy="9.5" r="2.5" fill="currentColor"/>
            </svg>
            Yield
          </div>
          {[
            { label: "Dashboard", active: true },
            { label: "Transacciones" },
            { label: "Proyecciones" },
            { label: "Asistente IA" },
            { label: "Extractos" },
          ].map(({ label, active }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 9px", borderRadius: 8, fontSize: 12, color: active ? "var(--text)" : "var(--text2)", fontWeight: active ? 500 : 400, background: active ? "var(--bg)" : "transparent", marginBottom: 2 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: active ? "var(--green)" : "currentColor", opacity: active ? 1 : 0.35, flexShrink: 0 }} />
              {label}
            </div>
          ))}
        </div>

        {/* Main panel */}
        <div style={{ padding: "18px 20px", overflow: "hidden", background: "var(--bg2, var(--bg))" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Buenos días, Carlos.</span>
            <span style={{ fontSize: 11, color: "var(--text2)", background: "var(--bg)", border: "1px solid var(--border)", padding: "4px 11px", borderRadius: 100 }}>Mayo 2026</span>
          </div>

          {/* KPI row */}
          <div ref={kpiRef} style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
            {kpis.map((k) => <KpiCard key={k.label} {...k} run={kpiRun} />)}
          </div>

          {/* Charts */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 8, marginBottom: 10 }}>
            {/* Donut */}
            <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--r-sm, 9px)", padding: "12px 14px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text3)", marginBottom: 10 }}>Por categoría</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 68, height: 68, borderRadius: "50%", flexShrink: 0, position: "relative",
                  background: "conic-gradient(var(--green) 0turn .23turn, #C8B49A .23turn .38turn, #9B8EC4 .38turn .52turn, var(--red) .52turn .64turn, var(--border2) .64turn 1turn)",
                }}>
                  <div style={{ position: "absolute", inset: 18, background: "var(--bg)", borderRadius: "50%" }} />
                </div>
                <div style={{ fontSize: 10, lineHeight: 1.7 }}>
                  {[
                    { c: "var(--green)", l: "Supermercado 23%" },
                    { c: "#C8B49A",    l: "Transporte 15%" },
                    { c: "#9B8EC4",    l: "Restaurantes 14%" },
                    { c: "var(--red)", l: "Ocio 12%" },
                    { c: "var(--border2)", l: "Otros 36%" },
                  ].map(({ c, l }) => (
                    <div key={l} style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text2)", padding: "2px 0" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c, flexShrink: 0 }} />
                      {l}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bar chart */}
            <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--r-sm, 9px)", padding: "12px 14px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text3)", marginBottom: 10 }}>Evolución mensual</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 60 }}>
                {bars.map((b) => (
                  <div key={b.lbl} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div
                      className="animate-bar-grow"
                      style={{
                        width: "100%",
                        height: b.h,
                        borderRadius: "3px 3px 0 0",
                        background: "var(--green)",
                        opacity: b.current ? 1 : 0.65,
                        animationDelay: b.delay,
                      }}
                    />
                    <span style={{ fontSize: 9, color: b.current ? "var(--accent)" : "var(--text3)" }}>{b.lbl}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Alert */}
          <div style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--r-sm, 9px)", padding: "9px 12px", fontSize: "11.5px" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
            <span style={{ color: "var(--text2)" }}>
              <strong style={{ color: "var(--text)" }}>8 suscripciones detectadas</strong>
              {" · "}Netflix, Spotify, Amazon Prime y 5 más · <strong style={{ color: "var(--text)" }}>88.97€/mes</strong>
            </span>
          </div>
        </div>

        {/* AI panel */}
        <div style={{ borderLeft: "1px solid var(--border)", background: "var(--card2)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 7, color: "var(--text)" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--green)", animation: "pulse 1.8s infinite" }} />
            Asistente IA
          </div>
          <div style={{ flex: 1, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
            {/* User message */}
            <div style={{ alignSelf: "flex-end", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "10px 10px 3px 10px", padding: "7px 11px", fontSize: "11.5px", lineHeight: 1.5, color: "var(--text2)", maxWidth: "100%" }}>
              ¿En qué categoría gasto más?
            </div>
            {/* Bot response */}
            <div style={{ background: "rgba(82,208,126,.08)", border: "1px solid rgba(82,208,126,.13)", borderRadius: "10px 10px 10px 3px", padding: "7px 11px", fontSize: "11.5px", lineHeight: 1.5, color: "var(--text)", maxWidth: "100%" }}>
              {aiTyping ? (
                <span style={{ display: "inline-flex", gap: 3, alignItems: "center", padding: "2px 0" }}>
                  {[0, 0.2, 0.4].map((d, i) => (
                    <span key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--text3)", animation: `blink 1.2s ${d}s infinite` }} />
                  ))}
                </span>
              ) : (
                aiText
              )}
            </div>
          </div>
          <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, fontSize: 11, color: "var(--text2)", background: "var(--bg)", border: "1px solid var(--border2)", borderRadius: 100, padding: "6px 12px" }}>
              Pregunta algo sobre tus finanzas…
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
