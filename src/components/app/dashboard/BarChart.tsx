"use client";

type MonthData = { month: string; income: number; expenses: number };

const W = 480, H = 190;
const PAD = { top: 16, bottom: 32, left: 52, right: 12 };
const cw = W - PAD.left - PAD.right;
const ch = H - PAD.top - PAD.bottom;
const f = (n: number) => n.toFixed(1);

function niceMax(v: number) {
  if (v <= 0) return 1000;
  const step = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / step) * step;
}

function smoothLine(pts: { x: number; y: number }[]) {
  const cmds = [`M ${f(pts[0].x)} ${f(pts[0].y)}`];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], c = pts[i];
    const dx = (c.x - p.x) * 0.4;
    cmds.push(`C ${f(p.x + dx)} ${f(p.y)}, ${f(c.x - dx)} ${f(c.y)}, ${f(c.x)} ${f(c.y)}`);
  }
  return cmds.join(" ");
}

function smoothArea(top: { x: number; y: number }[], bot: { x: number; y: number }[]) {
  const topCmds = [`M ${f(top[0].x)} ${f(top[0].y)}`];
  for (let i = 1; i < top.length; i++) {
    const p = top[i - 1], c = top[i];
    const dx = (c.x - p.x) * 0.4;
    topCmds.push(`C ${f(p.x + dx)} ${f(p.y)}, ${f(c.x - dx)} ${f(c.y)}, ${f(c.x)} ${f(c.y)}`);
  }
  const rev = [...bot].reverse();
  const botCmds = [`L ${f(rev[0].x)} ${f(rev[0].y)}`];
  for (let i = 1; i < rev.length; i++) {
    const p = rev[i - 1], c = rev[i];
    const dx = (c.x - p.x) * 0.4;
    botCmds.push(`C ${f(p.x + dx)} ${f(p.y)}, ${f(c.x - dx)} ${f(c.y)}, ${f(c.x)} ${f(c.y)}`);
  }
  return `${topCmds.join(" ")} ${botCmds.join(" ")} Z`;
}

export function BarChart({ data }: { data: MonthData[] }) {
  const allVals = data.flatMap((d) => [d.income, d.expenses]);
  const MAX_Y = niceMax(Math.max(...allVals, 500));
  const MIN_Y = 0;
  const gridLines = Array.from({ length: 5 }, (_, i) => Math.round(MIN_Y + (i / 4) * (MAX_Y - MIN_Y)));

  const xp = (i: number) => PAD.left + (data.length > 1 ? (i / (data.length - 1)) * cw : cw / 2);
  const yp = (v: number) => PAD.top + (1 - (v - MIN_Y) / (MAX_Y - MIN_Y)) * ch;

  const incomePoints = data.map((d, i) => ({ x: xp(i), y: yp(d.income) }));
  const expensePoints = data.map((d, i) => ({ x: xp(i), y: yp(d.expenses) }));

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text3)", marginBottom: 4 }}>
            Evolución mensual
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text3)" }}>Ingresos, gastos y ahorro</div>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--text3)", paddingTop: 2 }}>
          {[["#52d07e", "Ingresos"], ["#d06060", "Gastos"]].map(([color, label]) => (
            <span key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 2, borderRadius: 1, background: color, display: "inline-block" }} />
              {label}
            </span>
          ))}
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "rgba(82,208,126,0.25)", display: "inline-block" }} />
            Ahorro
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}>
        {gridLines.map((v) => {
          const y = yp(v);
          return (
            <g key={v}>
              <line x1={PAD.left} y1={f(y)} x2={W - PAD.right} y2={f(y)} stroke="rgba(230,220,205,0.06)" strokeWidth="1" />
              <text x={PAD.left - 7} y={f(y + 4)} textAnchor="end" fontSize="11" fill="rgba(138,127,117,0.75)">
                {v >= 1000 ? `${(v / 1000).toFixed(1)}k€` : `${v}€`}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => (
          <text key={d.month} x={f(xp(i))} y={H - 5} textAnchor="middle" fontSize="11" fill="rgba(138,127,117,0.8)">
            {d.month}
          </text>
        ))}

        {data.length > 1 && (
          <path d={smoothArea(incomePoints, expensePoints)} fill="rgba(82,208,126,0.13)" />
        )}
        <path d={smoothLine(incomePoints)} fill="none" stroke="#52d07e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d={smoothLine(expensePoints)} fill="none" stroke="#d06060" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        {incomePoints.map((p, i) => <circle key={i} cx={f(p.x)} cy={f(p.y)} r="3" fill="#52d07e" />)}
        {expensePoints.map((p, i) => <circle key={i} cx={f(p.x)} cy={f(p.y)} r="3" fill="#d06060" />)}
      </svg>
    </div>
  );
}
