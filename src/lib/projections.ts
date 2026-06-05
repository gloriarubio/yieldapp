// Pure statistics for /app/proyecciones — no Convex/React dependencies, so
// the client page and the "use node" AI action share the exact same numbers.
//
// Medians (not means) everywhere: one weird month must not distort the plan.

export type TxLike = {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  category: string;
  merchant?: string | null;
  excluded?: boolean;
};

export type CategoryStat = {
  category: string;
  /** Typical monthly spend (median over data months, zero-filled) */
  median: number;
  p25: number;
  p75: number;
  trend: "up" | "down" | "flat";
  topMerchant: { name: string; monthlyShare: number; sharePct: number } | null;
};

export type SubscriptionItem = {
  name: string;
  monthlyAmount: number;
  lastDate: string;
  /** Charged within the last ~45 days of the dataset — cancellable now */
  active: boolean;
};

export type BaselineStats = {
  months: string[]; // sorted YYYY-MM with any data
  monthsCount: number;
  medianIncome: number;
  medianExpenses: number;
  /** Typical monthly saving at the current pace (can be negative) */
  medianNet: number;
};

const monthOf = (date: string) => date.slice(0, 7);

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

function active(txs: TxLike[]): TxLike[] {
  return txs.filter((t) => t.excluded !== true);
}

export function computeBaseline(transactions: TxLike[]): BaselineStats {
  const txs = active(transactions);
  const byMonth = new Map<string, { income: number; expenses: number }>();
  for (const t of txs) {
    const m = monthOf(t.date);
    const e = byMonth.get(m) ?? { income: 0, expenses: 0 };
    if (t.amount > 0) e.income += t.amount;
    else e.expenses += Math.abs(t.amount);
    byMonth.set(m, e);
  }
  const months = [...byMonth.keys()].sort();
  const incomes = months.map((m) => byMonth.get(m)!.income);
  const expenses = months.map((m) => byMonth.get(m)!.expenses);
  const nets = months.map((m) => byMonth.get(m)!.income - byMonth.get(m)!.expenses);
  return {
    months,
    monthsCount: months.length,
    medianIncome: median(incomes),
    medianExpenses: median(expenses),
    medianNet: median(nets),
  };
}

export function computeCategoryStats(transactions: TxLike[]): CategoryStat[] {
  const txs = active(transactions).filter((t) => t.amount < 0);
  if (txs.length === 0) return [];

  const allMonths = [...new Set(txs.map((t) => monthOf(t.date)))].sort();

  // category → month → total
  const perCat = new Map<string, Map<string, number>>();
  // category → merchant → total
  const perMerchant = new Map<string, Map<string, number>>();

  for (const t of txs) {
    const m = monthOf(t.date);
    const cat = t.category;
    if (!perCat.has(cat)) perCat.set(cat, new Map());
    const cm = perCat.get(cat)!;
    cm.set(m, (cm.get(m) ?? 0) + Math.abs(t.amount));

    const merchant = (t.merchant || t.description).trim().slice(0, 40);
    if (!perMerchant.has(cat)) perMerchant.set(cat, new Map());
    const mm = perMerchant.get(cat)!;
    mm.set(merchant, (mm.get(merchant) ?? 0) + Math.abs(t.amount));
  }

  const out: CategoryStat[] = [];
  for (const [category, monthTotals] of perCat) {
    // Zero-fill: a month without spend in this category counts as 0
    const series = allMonths.map((m) => monthTotals.get(m) ?? 0);

    // Trend: last 3 months vs the 3 before (needs ≥4 months of data)
    let trend: CategoryStat["trend"] = "flat";
    if (series.length >= 4) {
      const last3 = series.slice(-3);
      const prev = series.slice(0, -3).slice(-3);
      const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
      const recent = avg(last3);
      const before = avg(prev);
      if (before > 0) {
        if (recent > before * 1.15) trend = "up";
        else if (recent < before * 0.85) trend = "down";
      } else if (recent > 0) trend = "up";
    }

    const catTotal = series.reduce((a, b) => a + b, 0);
    const merchants = [...(perMerchant.get(category) ?? new Map()).entries()].sort(
      (a, b) => b[1] - a[1]
    );
    const top = merchants[0];
    const topMerchant =
      top && catTotal > 0 && top[1] / catTotal >= 0.25 && merchants.length > 1
        ? {
            name: top[0],
            monthlyShare: top[1] / allMonths.length,
            sharePct: Math.round((top[1] / catTotal) * 100),
          }
        : null;

    out.push({
      category,
      median: median(series),
      p25: percentile(series, 0.25),
      p75: percentile(series, 0.75),
      trend,
      topMerchant,
    });
  }

  return out.sort((a, b) => b.median - a.median);
}

export function detectSubscriptions(transactions: TxLike[]): SubscriptionItem[] {
  const txs = active(transactions).filter(
    (t) => t.amount < 0 && t.category === "Suscripciones"
  );
  if (txs.length === 0) return [];

  const maxDate = txs.reduce((a, t) => (t.date > a ? t.date : a), "0000-00-00");
  const cutoff = new Date(new Date(maxDate).getTime() - 45 * 86400 * 1000)
    .toISOString()
    .slice(0, 10);

  const byName = new Map<string, TxLike[]>();
  for (const t of txs) {
    const name = (t.merchant || t.description).trim().slice(0, 40);
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name)!.push(t);
  }

  return [...byName.entries()]
    .map(([name, list]) => {
      const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date));
      return {
        name,
        monthlyAmount: Math.abs(sorted[0].amount),
        lastDate: sorted[0].date,
        active: sorted[0].date >= cutoff,
      };
    })
    .sort((a, b) => b.monthlyAmount - a.monthlyAmount);
}

// ─── Goal math ────────────────────────────────────────────────────────────────

/** Whole months needed to reach `target` saving `monthlyNet`/month; null = never */
export function monthsToTarget(target: number, monthlyNet: number): number | null {
  if (target <= 0) return 0;
  if (monthlyNet <= 0) return null;
  return Math.ceil(target / monthlyNet);
}

/** "2026-06" + 4 → "2026-10" */
export function addMonths(fromMonth: string, n: number): string {
  const [y, m] = fromMonth.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

const MONTH_NAMES_ES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES_ES[(m ?? 1) - 1]} ${y}`;
}
