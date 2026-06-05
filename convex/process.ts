"use node";

import { action, ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import Anthropic from "@anthropic-ai/sdk";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { applyUserRules, getAmbiguousMerchants } from "../src/lib/categorization";
import { categorizeWithAI } from "../src/lib/categorization-ai";
import { normalizeDate } from "../src/lib/dates";

const SEED_CATEGORIES = [
  "Supermercado",
  "Transporte",
  "Restaurantes",
  "Ocio",
  "Suscripciones",
  "Ingresos",
  "Otros",
] as const;

export type TxRow = {
  userId: string;
  statementId: Id<"statements">;
  date: string;
  description: string;
  amount: number;
  category: string;
  type: "income" | "expense";
  merchant?: string;
  merchantPattern?: string;
  categorySource?: "rule" | "ai" | "manual";
  // Set by "no contabilizar" rules — kept out of dashboard and analyses
  excluded?: boolean;
};

// Taxonomy shape as returned by getUserTaxonomyInternal (subset we use here)
type TaxonomyDoc = {
  categories: Array<{ id: string; name: string; isDefault: boolean; isActive: boolean }>;
  lastExpansionAt?: number;
} | null;

export const processStatement = action({
  args: {
    storageId: v.id("_storage"),
    userId: v.string(),
    filename: v.string(),
    fileType: v.union(v.literal("pdf"), v.literal("csv"), v.literal("excel")),
    // The public API (convex/http.ts) creates the statement first so it can
    // return its id in the 202 response, then schedules this action with it.
    statementId: v.optional(v.id("statements")),
  },
  handler: async (ctx, args): Promise<{ statementId: Id<"statements">; transactionCount: number }> => {
    // Free plan: only the initial onboarding upload. The API route already
    // checks this before scheduling (args.statementId present), but the web
    // upload calls this action directly — gate before creating anything.
    if (!args.statementId) {
      const canUpload = await ctx.runQuery(internal.subscriptions.checkCanUpload, {
        userId: args.userId,
      });
      if (!canUpload.allowed) throw new Error(canUpload.reason);
    }

    const statementId: Id<"statements"> =
      args.statementId ??
      (await ctx.runMutation(internal.statements.createStatement, {
        userId: args.userId,
        storageId: args.storageId,
        filename: args.filename,
        fileType: args.fileType,
      }));

    try {
      const blob = await ctx.storage.get(args.storageId);
      if (!blob) throw new Error("Archivo no encontrado en storage");

      // Fetch user's taxonomy (null if first upload)
      const taxonomy: TaxonomyDoc = await ctx.runQuery(
        internal.taxonomy.getUserTaxonomyInternal,
        { userId: args.userId }
      );

      const activeCategoryNames: string[] = taxonomy
        ? taxonomy.categories.filter((c) => c.isActive).map((c) => c.name)
        : [...SEED_CATEGORIES];

      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      let transactions: TxRow[];

      if (args.fileType === "pdf") {
        transactions = await extractFromPdf(blob, args.userId, statementId, anthropic, activeCategoryNames);
      } else {
        // Regex gives an initial guess; the AI pass below has the last word
        transactions = await extractFromStructuredFile(blob, args.fileType, args.userId, statementId);
      }

      const count = await categorizeAndFinalize(
        ctx,
        args.userId,
        statementId,
        transactions,
        taxonomy,
        activeCategoryNames
      );

      return { statementId, transactionCount: count };
    } catch (err) {
      await ctx.runMutation(internal.statements.updateStatementStatus, {
        statementId,
        status: "error",
        errorMessage: err instanceof Error ? err.message : "Error desconocido",
      });
      throw err;
    }
  },
});

// JSON transactions pushed via POST /v1/transactions (no file involved).
// They go through the exact same learning pipeline as file uploads:
// user rules → Claude for the rest → consolidation → notifications.
export const processApiTransactions = action({
  args: {
    userId: v.string(),
    statementId: v.id("statements"),
    transactions: v.array(
      v.object({
        date: v.string(), // YYYY-MM-DD
        description: v.string(),
        amount: v.number(), // positive = income, negative = expense
        merchant: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args): Promise<{ statementId: Id<"statements">; transactionCount: number }> => {
    try {
      const taxonomy: TaxonomyDoc = await ctx.runQuery(
        internal.taxonomy.getUserTaxonomyInternal,
        { userId: args.userId }
      );
      const activeCategoryNames: string[] = taxonomy
        ? taxonomy.categories.filter((c) => c.isActive).map((c) => c.name)
        : [...SEED_CATEGORIES];

      const rows: TxRow[] = args.transactions.map((t) => ({
        userId: args.userId,
        statementId: args.statementId,
        date: t.date,
        description: t.description,
        amount: t.amount,
        category: mapCategory("", t.description), // regex first guess, AI has the last word
        type: t.amount >= 0 ? ("income" as const) : ("expense" as const),
        merchant: t.merchant,
      }));

      const count = await categorizeAndFinalize(
        ctx,
        args.userId,
        args.statementId,
        rows,
        taxonomy,
        activeCategoryNames
      );

      return { statementId: args.statementId, transactionCount: count };
    } catch (err) {
      await ctx.runMutation(internal.statements.updateStatementStatus, {
        statementId: args.statementId,
        status: "error",
        errorMessage: err instanceof Error ? err.message : "Error desconocido",
      });
      throw err;
    }
  },
});

// Shared tail of the pipeline: categorize extracted rows (rules → AI →
// taxonomy normalization), insert, mark the statement done, and run the
// best-effort consistency/notification/taxonomy passes.
async function categorizeAndFinalize(
  ctx: ActionCtx,
  userId: string,
  statementId: Id<"statements">,
  extracted: TxRow[],
  taxonomy: TaxonomyDoc,
  activeCategoryNames: string[]
): Promise<number> {
  let transactions = extracted;

  // ── Learning system: user rules first, Claude only for the rest ───────
  const rules = await ctx.runQuery(internal.categoryRules.getUserRulesInternal, {
    userId,
  });
  const { categorized: byRule, uncategorized } = applyUserRules(
    transactions,
    rules.map((r) => ({
      merchantPattern: r.merchantPattern,
      category: r.category,
      isSubscription: r.isSubscription,
      excludeFromAnalysis: r.excludeFromAnalysis === true,
    }))
  );

  const aiInput = uncategorized.map((t, i) => ({
    id: String(i),
    date: t.date,
    description: t.description,
    amount: t.amount,
  }));
  const aiResults = await categorizeWithAI(aiInput, false, {
    categories: activeCategoryNames,
  });
  const aiById = new Map(aiResults.map((r) => [r.id, r]));

  let aiRows: TxRow[] = uncategorized.map((t, i) => {
    const ai = aiById.get(String(i));
    // If Claude fell back to "Otros" (e.g. API error), keep the extraction
    // category instead of losing it.
    const category =
      ai && ai.category !== "Otros"
        ? ai.category
        : t.category !== "Otros"
          ? t.category
          : "Otros";
    return {
      ...t,
      category,
      merchantPattern: ai?.merchantPattern ?? t.merchantPattern,
      categorySource: "ai" as const,
    };
  });

  // Taxonomy normalization only for AI rows — rule categories are
  // user-confirmed and must never be remapped to "Otros".
  if (taxonomy) {
    const catMap = new Map(taxonomy.categories.filter((c) => c.isActive).map((c) => [c.id, c.name]));
    aiRows = aiRows.map((tx) => ({
      ...tx,
      category: normalizeToTaxonomy(tx.category, catMap),
    }));
  }

  // isSubscription lives on the rule, not on the transaction row;
  // excludeFromAnalysis becomes the transaction's excluded flag
  const ruleRows: TxRow[] = byRule.map((t) => {
    const { isSubscription, excludeFromAnalysis, ...row } = t;
    void isSubscription;
    return excludeFromAnalysis ? { ...row, excluded: true } : row;
  });
  transactions = [...ruleRows, ...aiRows];

  console.log(
    `Extracted ${transactions.length} transactions (${ruleRows.length} by rule, ${aiRows.length} by AI)`
  );

  const count = await ctx.runMutation(internal.transactions.insertTransactions, { transactions });

  await ctx.runMutation(internal.statements.updateStatementStatus, {
    statementId,
    status: "done",
    transactionCount: count,
  });

  // Unify AI categories per merchant across ALL the user's months — a new
  // upload must not contradict how the same merchant was categorized before
  try {
    await ctx.runMutation(internal.transactions.consolidateMerchantCategoriesInternal, {
      userId,
    });
  } catch {
    // Consistency pass is best-effort
  }

  // Notify about new ambiguous merchants (low confidence, >1% of expenses)
  // not yet covered by the user's rules → dashboard banner
  try {
    const periodTxs = [
      ...aiInput,
      ...ruleRows.map((t, i) => ({
        id: `rule-${i}`,
        date: t.date,
        description: t.description,
        amount: t.amount,
      })),
    ];
    const ambiguousGroups = getAmbiguousMerchants(aiResults, periodTxs);
    const newPatterns = ambiguousGroups
      .filter((g) => !rules.some((r) => g.merchantPattern.includes(r.merchantPattern)))
      .map((g) => g.merchantPattern);

    if (newPatterns.length > 0) {
      await ctx.runMutation(internal.notifications.createNewMerchantsNotification, {
        userId,
        merchantPatterns: newPatterns,
      });
    }
  } catch {
    // Notifications are best-effort; never block the upload flow
  }

  // Bootstrap taxonomy on first upload
  const isFirstUpload = !taxonomy;
  if (isFirstUpload) {
    await ctx.runMutation(internal.taxonomy.bootstrapTaxonomy, { userId });
  }

  // Detect recurring charges not caught by static rules → Suscripciones
  try {
    await ctx.runMutation(internal.transactions.detectRecurringSubscriptions, {
      userId,
    });
  } catch {
    // Non-fatal
  }

  // Try to expand taxonomy when enough "Otros" accumulate (threshold: 5)
  const newOthersCount = transactions.filter((t) => t.category === "Otros").length;
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  const recentlyExpanded = taxonomy?.lastExpansionAt
    ? Date.now() - taxonomy.lastExpansionAt < SEVEN_DAYS
    : false;

  if (newOthersCount >= 5 && !recentlyExpanded) {
    try {
      const othersForTaxonomy = transactions
        .filter((t) => t.category === "Otros")
        .map((t) => ({
          txId: statementId, // placeholder — taxonomyActions only needs description/amount
          description: t.description,
          amount: t.amount,
          merchant: t.merchant,
        }));

      const existingCustomCount = taxonomy
        ? taxonomy.categories.filter((c) => !c.isDefault).length
        : 0;

      await ctx.runAction(internal.taxonomyActions.generateUserTaxonomy, {
        userId,
        othersTransactions: othersForTaxonomy,
        existingCustomCount,
      });

      // Re-categorize all historical "Otros" with the expanded taxonomy
      const updatedTaxonomy = await ctx.runQuery(
        internal.taxonomy.getUserTaxonomyInternal,
        { userId }
      );

      if (updatedTaxonomy) {
        const updatedNames = updatedTaxonomy.categories
          .filter((c) => c.isActive)
          .map((c) => c.name);

        await ctx.runAction(internal.taxonomyActions.recategorizeOthers, {
          userId,
          availableCategoryNames: updatedNames,
        });
      }
    } catch {
      // Taxonomy expansion is non-fatal
    }
  }

  // Insights are now generated per month, on demand, from the dashboard
  // (see convex/insightsActions.ts) — no per-statement generation here.

  return count;
}

// ─── PDF → Claude (vision nativa) ────────────────────────────────────────────

export async function extractFromPdf(
  blob: Blob,
  userId: string,
  statementId: Id<"statements">,
  anthropic: Anthropic,
  categoryNames: string[] = [...SEED_CATEGORIES]
): Promise<TxRow[]> {
  const buffer = await blob.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 32000,
    tools: [buildExtractionTool(categoryNames)],
    tool_choice: { type: "tool", name: "extract_transactions" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          } as Anthropic.DocumentBlockParam,
          {
            type: "text",
            text: `Extrae TODAS las transacciones bancarias de este extracto usando extract_transactions.

CAMPOS:
- amount: número positivo para ingresos/abonos, negativo para gastos/cargos
- date: formato YYYY-MM-DD
- category: elige la más específica de [${categoryNames.join(", ")}]

GUÍA DE CATEGORÍAS (úsala para ser consistente):
- Supermercado: Mercadona, Lidl, Carrefour, Aldi, Dia, Eroski, Consum, Alcampo y similares
- Transporte: Renfe, Metro, EMT, Cabify, Uber, Repsol, Cepsa, BP, parking, peajes, gasolineras
- Restaurantes: CUALQUIER bar, cafetería, café, restaurante, hamburguesería, pizzería, kebab, heladería, pastelería, copas. INCLUYE negocios que el banco clasifique como "ocio" si son establecimientos de comida o bebida
- Ocio: cines, teatros, museos, conciertos, parques de atracciones, eventos deportivos, karting. NO incluye bares ni cafeterías
- Suscripciones: cualquier servicio digital de pago periódico — streaming (Netflix, Spotify, Disney+, HBO, Dazn), almacenamiento (iCloud, Dropbox, Google One), software (Adobe, Microsoft 365, Notion, Figma, Slack, Zoom, GitHub, Vercel, Cloudflare), IA (Anthropic, OpenAI, Cursor, Midjourney), formación (Skool, Udemy, Domestika, Coursera, Duolingo), herramientas (Canva, Loom, 1Password, NordVPN), y cualquier cargo recurrente de una plataforma digital aunque no incluya la palabra "suscripción"
- Ingresos: nóminas, transferencias recibidas, prestaciones, devoluciones de Hacienda
- Otros: SOLO para transacciones que genuinamente no encajan en ninguna categoría anterior (transferencias entre cuentas propias, conceptos bancarios desconocidos)

Si no hay transacciones devuelve array vacío.`,
          },
        ],
      },
    ],
  });

  console.log("PDF stop_reason:", response.stop_reason);
  if (response.stop_reason === "max_tokens") {
    throw new Error("El PDF es demasiado largo para procesar de una vez. Prueba con un rango de fechas menor.");
  }

  return toolResponseToRows(response, userId, statementId);
}

// ─── Excel / CSV → mapeo directo de columnas ─────────────────────────────────

export async function extractFromStructuredFile(
  blob: Blob,
  fileType: "csv" | "excel",
  userId: string,
  statementId: Id<"statements">
): Promise<TxRow[]> {
  const rows =
    fileType === "excel"
      ? readExcelRows(await blob.arrayBuffer())
      : readCsvRows(await blob.text());

  if (rows.length === 0) throw new Error("El archivo no contiene datos");

  const keys = Object.keys(rows[0]);

  // Detect columns by name (handles ING and similar formats)
  const dateKey = keys.find((k) =>
    /^f\.?\s*valor$|^fecha$|^date$/i.test(k.trim())
  );
  const amountKey = keys.find((k) =>
    /importe|amount|monto|cargo|abono/i.test(k)
  );
  const descKey = keys.find((k) =>
    /descripci|description|concepto|detalle|movimiento/i.test(k)
  );
  const categoryKey = keys.find((k) => /categor/i.test(k));
  const commentKey = keys.find((k) => /comentario|comment|nota/i.test(k));

  if (!dateKey || !amountKey || !descKey) {
    throw new Error(
      `No se encontraron las columnas necesarias. Columnas disponibles: ${keys.join(", ")}`
    );
  }

  const transactions: TxRow[] = [];

  for (const row of rows) {
    const dateStr = normalizeDate(row[dateKey]);
    if (!dateStr) continue;

    const amount = Number(row[amountKey]);
    if (isNaN(amount)) continue;

    const description = String(row[descKey] ?? "").trim();
    if (!description) continue;

    const comment = commentKey ? String(row[commentKey] ?? "").trim() : "";
    const fullDesc = comment && comment !== "null" ? `${description} ${comment}` : description;

    const bankCategory = categoryKey ? String(row[categoryKey] ?? "") : "";

    transactions.push({
      userId,
      statementId,
      date: dateStr,
      description: fullDesc,
      amount,
      category: mapCategory(bankCategory, description),
      type: amount >= 0 ? "income" : "expense",
    });
  }

  return transactions;
}

// Regex de servicios de suscripción conocidos (case-insensitive, aplicar sobre descripción)
const KNOWN_SUBSCRIPTIONS =
  /netflix|spotify|disney[+ ]|hbo\b|apple\.com|apple tv|amazon prime|prime video|dazn|filmin|movistar\+|youtube premium|google one|google workspace|microsoft 365|office 365|adobe|creative cloud|dropbox|icloud|onedrive|notion|figma|slack|zoom|webex|discord|github|gitlab|linear\.app|vercel|railway\.app|netlify|heroku|digitalocean|cloudflare|openai|anthropic|midjourney|elevenlabs|cursor\.sh|cursor ai|skool|udemy|coursera|domestika|platzi|linkedin learning|masterclass|duolingo|calm\b|headspace|1password|lastpass|bitwarden|nordvpn|expressvpn|canva\b|loom\b|patreon|substack|twitch|todoist|asana|trello|monday\.com|hubspot|mailchimp|sendgrid|twilio|stripe\b|paddle\b|chargebee/i;

// Patrones genéricos de facturación recurrente (formatos Stripe, PayPal, etc.)
const SUBSCRIPTION_PATTERNS =
  /\*subscr|\*member|\*plan|\*premium|\*plus|\*pro\b|membresia|membresía|suscripci|cuota mensual|cuota anual|renovaci[oó]n automática/i;

function mapCategory(bankCategory: string, description: string): string {
  const cat = bankCategory.toLowerCase();
  const desc = description.toLowerCase();

  // ── Ingresos ────────────────────────────────────────────────────────────────
  if (/nómina|nomina|ingreso|prestacion|sueldo|salario|pension/.test(cat)) return "Ingresos";
  if (/nomina|salario|sueldo/.test(desc)) return "Ingresos";

  // ── Suscripciones ───────────────────────────────────────────────────────────
  if (/suscripci/.test(cat)) return "Suscripciones";
  if (KNOWN_SUBSCRIPTIONS.test(description)) return "Suscripciones";
  if (SUBSCRIPTION_PATTERNS.test(description)) return "Suscripciones";

  // ── Restaurantes — descripción primero, banco después ───────────────────────
  // Los bancos españoles clasifican bares y cafeterías como "Ocio": hay que
  // fijarse en la descripción antes que en la categoría del banco.
  if (/restauran|cafeter|cafeteria|café\b|hamburgues|pizz[ae]|sushi|kebab|tapas|cerveceria|marisqueria|heladeria|pasteleria|churreria|copas|grill|burguer|burger|bocadillo|sandwich|bocata|bar restaurant|comida/.test(desc)) return "Restaurantes";
  if (/restaurante|cafeter|bar\b/.test(cat)) return "Restaurantes";
  // Banco dice "Ocio" pero la descripción huele a comida/bebida → Restaurantes
  if (/ocio/.test(cat) && /bar\b|café|cafe\b|restaur|hambur|pizza|cervez|copa\b|tapa\b|cena|comida|bebida/.test(desc)) return "Restaurantes";

  // ── Supermercado ─────────────────────────────────────────────────────────────
  if (/alimentac|supermercado/.test(cat)) return "Supermercado";
  if (/mercadona|lidl|carrefour|aldi\b|dia\b|eroski|consum|alcampo|hipercor|froiz|ahorramas|bon preu/.test(desc)) return "Supermercado";

  // ── Transporte ───────────────────────────────────────────────────────────────
  if (/transporte|vehículo|vehiculo|gasolina|parking|autopista|peaje/.test(cat)) return "Transporte";
  if (/renfe|ave\b|cercanias|metro\b|emt\b|cabify|uber\b|blablacar|repsol|cepsa|bp\b|shell|galp|parking|autobus|autovía|autopista/.test(desc)) return "Transporte";

  // ── Ocio — sólo si no encajó en Restaurantes antes ──────────────────────────
  if (/ocio/.test(cat)) return "Ocio";
  if (/cine\b|teatro|musea|museo|concierto|festival|parque atracciones|karting|escape room|bolera|paintball/.test(desc)) return "Ocio";

  return "Otros";
}

// ─── Parsers de archivo ───────────────────────────────────────────────────────

function readExcelRows(buffer: ArrayBuffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const all = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

  // Find the real header row (skip bank info rows at top)
  const headerIdx = all.findIndex(
    (row) => Array.isArray(row) && row.some((c) => typeof c === "string" && /^f\.?\s*valor$|^fecha$/i.test((c as string).trim()))
  );
  if (headerIdx === -1) {
    // No recognised header — try sheet_to_json default
    return XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];
  }

  const headers = (all[headerIdx] as unknown[]).map((h) => String(h ?? "").trim());
  return all
    .slice(headerIdx + 1)
    .filter((row) => Array.isArray(row) && (row as unknown[])[0] != null)
    .map((row) => {
      const r = row as unknown[];
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        let v = r[i];
        if (v instanceof Date) v = v.toISOString().slice(0, 10);
        obj[h] = v ?? null;
      });
      return obj;
    });
}

function readCsvRows(text: string): Record<string, unknown>[] {
  // Try comma first, then semicolon
  for (const delimiter of [",", ";", "\t"]) {
    const result = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      delimiter,
    });
    if (result.data.length > 0 && Object.keys(result.data[0]).length > 2) {
      return result.data;
    }
  }
  return [];
}

// ─── Tool use helpers ─────────────────────────────────────────────────────────

function buildExtractionTool(categoryNames: string[] = [...SEED_CATEGORIES]) {
  return {
    name: "extract_transactions",
    description: "Extrae todas las transacciones bancarias del documento.",
    input_schema: {
      type: "object" as const,
      properties: {
        transactions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              date: { type: "string", description: "YYYY-MM-DD" },
              description: { type: "string" },
              amount: { type: "number", description: "Positivo=ingreso, negativo=gasto" },
              category: { type: "string", description: `Una de: ${categoryNames.join(", ")}` },
              merchant: { type: "string" },
              type: { type: "string", enum: ["income", "expense"] },
            },
            required: ["date", "description", "amount", "category", "type"],
          },
        },
      },
      required: ["transactions"],
    },
  };
}

// ─── Taxonomy helpers ─────────────────────────────────────────────────────────

function normalizeToTaxonomy(
  category: string,
  catMap: Map<string, string>
): string {
  // Exact match
  if (catMap.has(category.toLowerCase().replace(/\s+/g, "_"))) {
    return catMap.get(category.toLowerCase().replace(/\s+/g, "_"))!;
  }
  // Fuzzy: find a taxonomy entry where the name case-insensitively matches
  for (const [, name] of catMap) {
    if (name.toLowerCase() === category.toLowerCase()) return name;
  }
  // Unknown category: fallback to "Otros"
  return "Otros";
}

function toolResponseToRows(
  response: Anthropic.Message,
  userId: string,
  statementId: Id<"statements">
): TxRow[] {
  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude no utilizó la herramienta de extracción");
  }
  const input = toolUse.input as {
    transactions?: Array<{
      date: string;
      description: string;
      amount: number;
      category: string;
      merchant?: string;
      type: "income" | "expense";
    }>;
  };
  return (input.transactions ?? []).map((tx) => ({
    userId,
    statementId,
    // Claude is asked for YYYY-MM-DD, but normalize defensively anyway
    date: normalizeDate(tx.date) ?? tx.date,
    description: tx.description,
    amount: Number(tx.amount),
    category: tx.category,
    merchant: tx.merchant,
    type: tx.type,
  }));
}

