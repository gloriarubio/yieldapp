"use client";

import React, { useEffect, useRef, useState } from "react";

const stats = [
  { count: 2,  suffix: " min", label: "De media hasta el primer insight" },
  { count: 47, suffix: "",     label: "Categorías de gasto detectadas" },
  { count: 0,  suffix: "",     label: "Conexiones a tu banco necesarias", narrow: true },
];

function StatNum({ target, suffix, run }: { target: number; suffix: string; run: boolean }) {
  const [val, setVal] = useState<string>("—");
  useEffect(() => {
    if (!run) return;
    let cur = 0;
    const fps = 1000 / 60;
    const steps = 1400 / fps;
    const inc = target / steps;
    const id = setInterval(() => {
      cur = Math.min(cur + inc, target);
      const n = Math.floor(cur);
      setVal((target === 0 ? "0" : n.toLocaleString("es-ES")) + suffix);
      if (cur >= target) clearInterval(id);
    }, fps);
    return () => clearInterval(id);
  }, [run, target, suffix]);
  return (
    <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "clamp(36px,5vw,60px)", fontWeight: 500, letterSpacing: "-2px", color: "var(--text)", marginBottom: 6, lineHeight: 1 }}>
      {val}
    </div>
  );
}

export function Stats() {
  const bandRef = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(false);

  useEffect(() => {
    const el = bandRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setRun(true); obs.disconnect(); } }, { threshold: 0.4 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={bandRef} style={{ background: "var(--card)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "56px 52px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", justifyContent: "space-around", alignItems: "center", gap: 40, flexWrap: "wrap" }}>
        {stats.map((s, i) => (
          <React.Fragment key={s.label}>
            {i > 0 && <div style={{ width: 1, height: 60, background: "var(--border2)" }} />}
            <div style={{ textAlign: "center" }}>
              <StatNum target={s.count} suffix={s.suffix} run={run} />
              <div style={{ fontSize: 13, color: "var(--text2)", fontWeight: 400, ...(s.narrow ? { maxWidth: 160 } : {}) }}>
                {s.label}
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
