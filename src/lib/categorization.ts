// Pure TypeScript categorization logic — no Convex, Next.js or SDK
// dependencies, so every function here is testable in isolation and safe to
// import from client components AND from Convex's default runtime.
//
// TODO(spec): the spec wanted categorizeWithAI in this same file, but the
// Anthropic SDK uses Node builtins and cannot be bundled into Convex's
// default runtime (categoryRules.ts imports normalizeMerchant from here).
// categorizeWithAI lives in src/lib/categorization-ai.ts, imported only from
// "use node" Convex actions.

// ─── Types ────────────────────────────────────────────────────────────────────

export type CategorizableTransaction = {
  /** Stable id within the batch (a Convex _id or a local index). */
  id: string;
  date: string;
  description: string;
  amount: number;
};

export type CategoryRuleInput = {
  merchantPattern: string;
  category: string;
  isSubscription: boolean;
  /** "no contabilizar": matching transactions are inserted as excluded */
  excludeFromAnalysis?: boolean;
};

export type RuleMatch<T> = T & {
  category: string;
  isSubscription: boolean;
  excludeFromAnalysis?: boolean;
  merchantPattern: string;
  categorySource: "rule";
};

export type AICategorization = {
  id: string;
  category: string;
  isSubscription: boolean;
  confidence: "high" | "low";
  merchantPattern: string;
  /** Other plausible categories Claude considered (low-confidence verdicts) */
  alternatives?: string[];
};

export type SampleTransaction = {
  date: string;
  description: string;
  amount: number;
};

export type AmbiguousMerchantGroup = {
  merchantPattern: string;
  totalAmount: number;
  count: number;
  examples: string[];
  /** Real transactions behind the question (up to 8, newest first) */
  transactions: SampleTransaction[];
  suggestedCategories: string[];
  isSubscriptionCandidate: boolean;
  /** "transfer" = recurring transfer/Bizum detected by heuristic (block A) */
  kind: "merchant" | "transfer";
};

// Categories offered to Claude when the user has no taxonomy yet (onboarding).
// TODO(spec): the spec hardcodes this list, but the project already has a
// dynamic per-user taxonomy (convex/taxonomy.ts). Monthly uploads pass the
// user's active taxonomy names via the `categories` option instead.
export const ONBOARDING_CATEGORIES = [
  "Supermercado",
  "Restaurantes",
  "Transporte",
  "Suscripciones",
  "Compras online",
  "Ropa",
  "Viajes",
  "Ocio",
  "Salud",
  "Hogar",
  "Educación",
  "Transferencias",
  "Otros",
] as const;

// ─── Merchant normalization ───────────────────────────────────────────────────

/**
 * Normalizes a statement description into a stable merchant pattern:
 * uppercase, cut variable suffixes (everything after *, #, / or a space
 * followed by digits), then strip remaining digits.
 * E.g. "AMZN MKTP ES*2K4AB" → "AMZN MKTP ES"
 */
export function normalizeMerchant(description: string): string {
  let s = description.toUpperCase();
  // Cut at the first variable-suffix delimiter
  s = s.split("*")[0].split("#")[0].split("/")[0];
  // Cut at " <digits...>" (reference numbers, dates, card suffixes)
  s = s.replace(/\s+\d.*$/, "");
  // Strip any remaining digits and collapse whitespace
  s = s.replace(/\d+/g, "");
  s = s.replace(/[^\p{L}\s.&-]/gu, " ");
  return s.replace(/\s+/g, " ").trim();
}

// ─── 2A — applyUserRules ──────────────────────────────────────────────────────

/**
 * Splits transactions into those covered by a user rule and those that need
 * AI categorization. Matching: the rule's merchantPattern must be contained
 * (`includes`) in the normalized description. More specific (longer) patterns
 * win over shorter ones.
 */
export function applyUserRules<T extends { description: string }>(
  transactions: T[],
  rules: CategoryRuleInput[]
): {
  categorized: RuleMatch<T>[];
  uncategorized: (T & { merchantPattern: string })[];
} {
  const sortedRules = [...rules].sort(
    (a, b) => b.merchantPattern.length - a.merchantPattern.length
  );

  const categorized: RuleMatch<T>[] = [];
  const uncategorized: (T & { merchantPattern: string })[] = [];

  for (const tx of transactions) {
    const normalized = normalizeMerchant(tx.description);
    const rule = sortedRules.find(
      (r) => r.merchantPattern.length > 0 && normalized.includes(r.merchantPattern)
    );

    if (rule) {
      categorized.push({
        ...tx,
        category: rule.category,
        isSubscription: rule.isSubscription,
        merchantPattern: rule.merchantPattern,
        categorySource: "rule",
      });
    } else {
      uncategorized.push({ ...tx, merchantPattern: normalized });
    }
  }

  return { categorized, uncategorized };
}

// ─── Cross-file consistency ───────────────────────────────────────────────────

/**
 * Each statement file is categorized by an independent Claude call, so the
 * same merchant can get different verdicts across files (e.g. "FACEBK" as
 * Suscripciones in April but Compras online in May). This resolves ONE
 * category per merchantPattern by majority vote among AI-categorized
 * transactions ("high" confidence votes count double when available).
 * Returns pattern → winning category only for patterns with conflicts.
 * Rule/manual categorizations are never touched.
 */
export function resolveMerchantCategories(
  txs: Array<{
    merchantPattern?: string;
    category: string;
    categorySource?: string;
    confidence?: "high" | "low";
  }>
): Map<string, string> {
  const groups = new Map<string, Map<string, number>>();
  for (const t of txs) {
    if (t.categorySource !== "ai" || !t.merchantPattern) continue;
    const votes = groups.get(t.merchantPattern) ?? new Map<string, number>();
    const weight = t.confidence === "high" ? 2 : 1;
    votes.set(t.category, (votes.get(t.category) ?? 0) + weight);
    groups.set(t.merchantPattern, votes);
  }

  const out = new Map<string, string>();
  for (const [pattern, votes] of groups) {
    if (votes.size <= 1) continue; // already consistent
    const winner = [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0];
    out.set(pattern, winner);
  }
  return out;
}

// ─── 3A — getAmbiguousMerchants ───────────────────────────────────────────────
// TODO(spec): the spec described this as a Convex query, but it's pure
// computation over in-memory arrays, so it lives here (testable and usable
// both from the onboarding wizard on the client and from Convex actions).

// Hardcoded reasonable alternatives by merchant name, used to complete the
// 3 suggested categories of each ambiguous group.
const ALTERNATE_HINTS: Array<[RegExp, string[]]> = [
  [/ZARA|MANGO|OYSHO|BERSHKA|PULL\s?&?\s?BEAR|STRADIVARIUS|PRIMARK|H\s?&?\s?M|DECATHLON|SPRINGFIELD|UNIQLO/, ["Ropa", "Compras online"]],
  [/AMZN|AMAZON|ALIEXPRESS|EBAY|SHEIN|ETSY|ZALANDO/, ["Compras online", "Ropa"]],
  [/BOOKING|AIRBNB|HOTEL|HOSTAL|VUELING|RYANAIR|IBERIA|EASYJET|EDREAMS|TRIP/, ["Viajes", "Ocio"]],
  [/GLOVO|UBER EATS|JUST EAT|DELIVEROO|TGTG|TOO GOOD/, ["Restaurantes", "Supermercado"]],
  [/FARMACIA|PARAFARMACIA|CLINICA|DENTAL|OPTICA|VETERINAR/, ["Salud", "Otros"]],
  [/GYM|GIMNASIO|FITNESS|PADEL|CROSSFIT|CLUB DEPORT/, ["Salud", "Ocio"]],
  [/APPLE|GOOGLE|MICROSOFT|PAYPAL/, ["Suscripciones", "Compras online"]],
  [/IKEA|LEROY|BAUHAUS|BRICO|FERRETERIA/, ["Hogar", "Compras online"]],
  [/ACADEMIA|UNIVERSIDAD|CURSO|FORMACION|LIBRERIA/, ["Educación", "Otros"]],
  [/BIZUM|TRANSFER/, ["Transferencias", "Otros"]],
];

function suggestAlternates(merchantPattern: string): string[] {
  for (const [re, alts] of ALTERNATE_HINTS) {
    if (re.test(merchantPattern)) return alts;
  }
  return ["Compras online", "Otros"];
}

/**
 * Groups AI categorizations by merchantPattern and returns the groups worth
 * asking the user about. A group qualifies if ANY of:
 *  - Claude wasn't sure (confidence "low") AND it's >1% of expenses with
 *    more than one transaction (the original spec rule);
 *  - it's a heavy recurrent merchant (4+ charges and >2% of expenses) —
 *    even when Claude is confident, a mistake there hurts the most, so we
 *    confirm with the user (one click: the suggestion comes preselected);
 *  - it looks like a subscription (>1% of expenses) — worth confirming.
 * Max 10 groups, sorted by totalAmount desc. Everything else keeps Claude's
 * automatic categorization.
 */
function sampleTxs(txs: CategorizableTransaction[], max = 8): SampleTransaction[] {
  return [...txs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, max)
    .map((t) => ({ date: t.date, description: t.description, amount: t.amount }));
}

export function getAmbiguousMerchants(
  aiResults: AICategorization[],
  transactions: CategorizableTransaction[],
  maxGroups = 10,
  /** Patterns already covered by block-A questions (special movements) */
  skipPatterns?: Set<string>
): AmbiguousMerchantGroup[] {
  const txById = new Map(transactions.map((t) => [String(t.id), t]));

  const totalExpenses = transactions
    .filter((t) => t.amount < 0)
    .reduce((acc, t) => acc + Math.abs(t.amount), 0);
  if (totalExpenses === 0) return [];

  // Group ALL expense results by merchantPattern (confidence filtered below)
  type Group = { results: AICategorization[]; txs: CategorizableTransaction[] };
  const groups = new Map<string, Group>();

  for (const res of aiResults) {
    const tx = txById.get(String(res.id));
    if (!tx || tx.amount >= 0) continue;
    if (skipPatterns?.has(res.merchantPattern)) continue;

    const key = res.merchantPattern;
    if (!groups.has(key)) groups.set(key, { results: [], txs: [] });
    const g = groups.get(key)!;
    g.results.push(res);
    g.txs.push(tx);
  }

  const out: AmbiguousMerchantGroup[] = [];

  for (const [merchantPattern, g] of groups) {
    const totalAmount = g.txs.reduce((acc, t) => acc + Math.abs(t.amount), 0);
    const count = g.txs.length;
    const share = totalAmount / totalExpenses;
    const hasLowConfidence = g.results.some((r) => r.confidence === "low");

    // Subscription candidate: same amount on every charge, at most one per month
    const amounts = g.txs.map((t) => Math.abs(t.amount));
    const sameAmount = amounts.every((a) => Math.abs(a - amounts[0]) < 0.01);
    const months = new Set(g.txs.map((t) => t.date.slice(0, 7)));
    const isSubscriptionCandidate = sameAmount && months.size === count && count >= 2;

    const qualifies =
      (hasLowConfidence && count > 1 && share > 0.01) || // ambiguous (spec rule)
      (count >= 4 && share > 0.02) ||                    // heavy recurrent merchant
      (isSubscriptionCandidate && share > 0.01);          // possible subscription
    if (!qualifies) continue;

    // Mode of Claude's categories for the group
    const freq = new Map<string, number>();
    for (const r of g.results) freq.set(r.category, (freq.get(r.category) ?? 0) + 1);
    const mode = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];

    // Prefer the alternatives Claude itself proposed; fall back to hints
    const aiAlternatives = [...new Set(g.results.flatMap((r) => r.alternatives ?? []))];
    const suggestedCategories = [
      mode,
      ...(aiAlternatives.length > 0 ? aiAlternatives : suggestAlternates(merchantPattern)).filter(
        (c) => c !== mode
      ),
    ].slice(0, 3);

    out.push({
      merchantPattern,
      totalAmount,
      count,
      examples: g.txs.slice(0, 2).map((t) => t.description),
      transactions: sampleTxs(g.txs),
      suggestedCategories,
      isSubscriptionCandidate,
      kind: "merchant",
    });
  }

  return out.sort((a, b) => b.totalAmount - a.totalAmount).slice(0, maxGroups);
}

// ─── Special movements (onboarding block A) ──────────────────────────────────
// Transfers, Bizums and account-to-account movements the AI cannot interpret:
// only the user knows whether 600€/month to "TRANSF. CUENTA 44XX" is savings,
// rent or plain spending — or whether it should not count at all.

const TRANSFER_RE = /TRANSFER|TRANSF\b|TRASPASO|BIZUM|ENVIO DE DINERO|ORDEN DE PAGO/i;

export function detectSpecialMovements(
  transactions: Array<{
    date: string;
    description: string;
    amount: number;
    merchantPattern?: string;
  }>,
  maxGroups = 4
): AmbiguousMerchantGroup[] {
  const expenses = transactions.filter((t) => t.amount < 0);
  const totalExpenses = expenses.reduce((a, t) => a + Math.abs(t.amount), 0);
  if (totalExpenses === 0) return [];

  const groups = new Map<string, CategorizableTransaction[]>();
  for (const t of expenses) {
    if (!TRANSFER_RE.test(t.description)) continue;
    const pattern = t.merchantPattern || normalizeMerchant(t.description);
    if (!groups.has(pattern)) groups.set(pattern, []);
    groups.get(pattern)!.push({ id: "", date: t.date, description: t.description, amount: t.amount });
  }

  const out: AmbiguousMerchantGroup[] = [];
  for (const [merchantPattern, txs] of groups) {
    const totalAmount = txs.reduce((a, t) => a + Math.abs(t.amount), 0);
    const count = txs.length;
    const share = totalAmount / totalExpenses;
    const months = new Set(txs.map((t) => t.date.slice(0, 7)));
    const isRecurring = months.size >= 2 && count >= 2;

    // Worth asking when it's real money: recurring, or a big one-off (>3%)
    if (!isRecurring && share < 0.03) continue;
    if (totalAmount < 50) continue;

    out.push({
      merchantPattern,
      totalAmount,
      count,
      examples: txs.slice(0, 2).map((t) => t.description),
      transactions: sampleTxs(txs),
      // The user decides what this money IS — the AI can't know
      suggestedCategories: ["Ahorro", "Vivienda", "Transferencias"],
      isSubscriptionCandidate: false,
      kind: "transfer",
    });
  }

  return out.sort((a, b) => b.totalAmount - a.totalAmount).slice(0, maxGroups);
}
