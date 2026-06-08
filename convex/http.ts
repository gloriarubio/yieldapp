import { httpRouter } from "convex/server";
import { httpAction, ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { sha256Hex } from "./apiKeyUtils";
import { subscriptionIsPro } from "./subscriptionHelpers";
import { SEED_CATEGORIES } from "./taxonomy";

// ─── Public HTTP API (v1) ─────────────────────────────────────────────────────
// Served at https://<deployment>.convex.site — for external integrations
// (n8n, Zapier, scripts). Auth: `Authorization: Bearer yld_...` personal API
// key, managed from /app/ajustes. All responses are JSON.
//
//   POST /v1/statements        upload a statement file (multipart or base64 JSON)
//   GET  /v1/statements        list statements
//   GET  /v1/statements/{id}   processing status of one statement
//   POST /v1/transactions      push structured transactions (JSON)
//   GET  /v1/transactions      list transactions (filters + cursor pagination)
//   GET  /v1/summary           monthly aggregate (?month=YYYY-MM)
//   GET  /v1/insights          monthly AI insights (?month=YYYY-MM&generate=true)
//   GET  /v1/categories        user's active category taxonomy

const http = httpRouter();

// ─── POST /stripe/webhook — Stripe subscription lifecycle ───────────────────
// Registered in the Stripe dashboard; signature is verified inside the node
// action (the stripe SDK needs the Node runtime).

http.route({
  path: "/stripe/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const signature = req.headers.get("stripe-signature");
    if (!signature) return new Response("Missing stripe-signature header", { status: 400 });
    const payload = await req.text();
    try {
      await ctx.runAction(internal.stripeActions.processStripeWebhook, {
        payload,
        signature,
      });
      return json(200, { received: true });
    } catch (err) {
      console.error("Stripe webhook error:", err);
      // 400 makes Stripe retry — correct for transient errors and harmless
      // for signature failures
      return new Response("Webhook processing failed", { status: 400 });
    }
  }),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function apiError(status: number, code: string, message: string): Response {
  return json(status, { error: { code, message } });
}

const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

/** Resolves the Bearer API key to a userId, or returns a 401 Response. */
async function authenticate(
  ctx: ActionCtx,
  req: Request
): Promise<{ userId: string } | Response> {
  const header = req.headers.get("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) {
    return apiError(401, "missing_api_key", "Falta la cabecera 'Authorization: Bearer <api key>'.");
  }
  const key = header.slice("Bearer ".length).trim();
  const found = await ctx.runQuery(internal.apiKeys.verifyApiKey, {
    keyHash: await sha256Hex(key),
  });
  if (!found) {
    return apiError(401, "invalid_api_key", "API key inválida o revocada.");
  }

  // The whole API is a Pro feature. Keys aren't deleted on downgrade — they
  // are paused: every request re-checks the plan, so cancelling Pro cuts API
  // access immediately and re-subscribing revives the same keys.
  const sub = await ctx.runQuery(internal.subscriptions.getSubscriptionInternal, {
    userId: found.userId,
  });
  if (!subscriptionIsPro(sub)) {
    return apiError(
      402,
      "pro_required",
      "La API requiere una suscripción Pro activa. Tus claves se reactivarán al volver a Pro."
    );
  }

  // lastUsedAt is informational — only write when stale
  if (!found.lastUsedAt || Date.now() - found.lastUsedAt > TOUCH_INTERVAL_MS) {
    await ctx.runMutation(internal.apiKeys.touchApiKey, { keyId: found.keyId });
  }
  return { userId: found.userId };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

function fileTypeFromName(name: string): "pdf" | "csv" | "excel" | null {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "csv") return "csv";
  if (ext === "xlsx" || ext === "xls") return "excel";
  return null;
}

function statementToJson(s: {
  _id: Id<"statements">;
  filename: string;
  fileType: string;
  status: string;
  errorMessage?: string;
  transactionCount?: number;
  uploadedAt: number;
  processedAt?: number;
  progress?: { phase: string; extracted?: number; categorized?: number; total?: number };
}) {
  return {
    id: s._id,
    filename: s.filename,
    fileType: s.fileType,
    status: s.status,
    error: s.errorMessage ?? null,
    transactionCount: s.transactionCount ?? null,
    uploadedAt: s.uploadedAt,
    processedAt: s.processedAt ?? null,
    progress: s.progress ?? null,
  };
}

// ─── POST /v1/statements — upload a statement file ──────────────────────────

http.route({
  path: "/v1/statements",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const auth = await authenticate(ctx, req);
    if (auth instanceof Response) return auth;

    // Free plan: only the initial onboarding upload — new uploads need Pro
    const canUpload = await ctx.runQuery(internal.subscriptions.checkCanUpload, {
      userId: auth.userId,
    });
    if (!canUpload.allowed) {
      return apiError(402, "pro_required", canUpload.reason);
    }

    let blob: Blob;
    let filename: string;

    const contentType = req.headers.get("Content-Type") ?? "";
    try {
      if (contentType.includes("multipart/form-data")) {
        // multipart: field "file" (binary) — what n8n sends by default
        const form = await req.formData();
        const file = form.get("file");
        if (!(file instanceof Blob)) {
          return apiError(400, "missing_file", "Falta el campo 'file' (binario) en el form-data.");
        }
        filename = (file instanceof File && file.name) || String(form.get("filename") ?? "extracto");
        blob = file;
      } else {
        // JSON: { filename, data: <base64> }
        const body = (await req.json()) as { filename?: string; data?: string };
        if (!body.filename || !body.data) {
          return apiError(400, "invalid_body", "Se esperaba JSON con 'filename' y 'data' (base64), o multipart/form-data con campo 'file'.");
        }
        filename = body.filename;
        const binary = atob(body.data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        blob = new Blob([bytes]);
      }
    } catch {
      return apiError(400, "invalid_body", "No se pudo leer el cuerpo de la petición.");
    }

    const fileType = fileTypeFromName(filename);
    if (!fileType) {
      return apiError(400, "unsupported_file_type", "Extensión no soportada. Usa .pdf, .csv, .xlsx o .xls.");
    }

    const storageId = await ctx.storage.store(blob);
    const statementId: Id<"statements"> = await ctx.runMutation(internal.statements.createStatement, {
      userId: auth.userId,
      storageId,
      filename,
      fileType,
    });

    // Processing takes minutes — respond 202 and let the client poll
    // GET /v1/statements/{id} until status === "done"
    await ctx.scheduler.runAfter(0, internal.process.processStatementInternal, {
      storageId,
      userId: auth.userId,
      filename,
      fileType,
      statementId,
    });

    return json(202, { id: statementId, status: "processing" });
  }),
});

// ─── GET /v1/statements — list statements ────────────────────────────────────

http.route({
  path: "/v1/statements",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const auth = await authenticate(ctx, req);
    if (auth instanceof Response) return auth;

    const statements = await ctx.runQuery(internal.statements.listStatementsInternal, {
      userId: auth.userId,
    });
    return json(200, { items: statements.map(statementToJson) });
  }),
});

// ─── GET /v1/statements/{id} — processing status ─────────────────────────────

http.route({
  pathPrefix: "/v1/statements/",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const auth = await authenticate(ctx, req);
    if (auth instanceof Response) return auth;

    const id = new URL(req.url).pathname.split("/").pop() ?? "";
    let statement;
    try {
      statement = await ctx.runQuery(internal.statements.getStatementByIdInternal, {
        statementId: id as Id<"statements">,
      });
    } catch {
      return apiError(404, "not_found", "Extracto no encontrado.");
    }
    // Ownership check — never leak other users' statements
    if (!statement || statement.userId !== auth.userId) {
      return apiError(404, "not_found", "Extracto no encontrado.");
    }
    return json(200, statementToJson(statement));
  }),
});

// ─── POST /v1/transactions — push structured transactions ───────────────────

const MAX_TX_PER_REQUEST = 1000;

http.route({
  path: "/v1/transactions",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const auth = await authenticate(ctx, req);
    if (auth instanceof Response) return auth;

    // Same Pro gate as file uploads — pushing transactions adds new data
    const canUpload = await ctx.runQuery(internal.subscriptions.checkCanUpload, {
      userId: auth.userId,
    });
    if (!canUpload.allowed) {
      return apiError(402, "pro_required", canUpload.reason);
    }

    let body: { transactions?: unknown; source?: unknown };
    try {
      body = await req.json();
    } catch {
      return apiError(400, "invalid_body", "Se esperaba un cuerpo JSON.");
    }

    const raw = body.transactions;
    if (!Array.isArray(raw) || raw.length === 0) {
      return apiError(400, "invalid_body", "Se esperaba { transactions: [...] } con al menos una transacción.");
    }
    if (raw.length > MAX_TX_PER_REQUEST) {
      return apiError(400, "too_many_transactions", `Máximo ${MAX_TX_PER_REQUEST} transacciones por petición.`);
    }

    const transactions: Array<{ date: string; description: string; amount: number; merchant?: string }> = [];
    for (let i = 0; i < raw.length; i++) {
      const t = raw[i] as Record<string, unknown>;
      if (typeof t?.date !== "string" || !DATE_RE.test(t.date)) {
        return apiError(400, "invalid_transaction", `transactions[${i}].date debe ser YYYY-MM-DD.`);
      }
      if (typeof t.description !== "string" || !t.description.trim()) {
        return apiError(400, "invalid_transaction", `transactions[${i}].description es obligatorio.`);
      }
      if (typeof t.amount !== "number" || !isFinite(t.amount)) {
        return apiError(400, "invalid_transaction", `transactions[${i}].amount debe ser un número (positivo=ingreso, negativo=gasto).`);
      }
      transactions.push({
        date: t.date,
        description: t.description.trim(),
        amount: t.amount,
        merchant: typeof t.merchant === "string" && t.merchant.trim() ? t.merchant.trim() : undefined,
      });
    }

    const source = typeof body.source === "string" && body.source.trim() ? body.source.trim() : "API";
    const statementId: Id<"statements"> = await ctx.runMutation(internal.statements.createStatement, {
      userId: auth.userId,
      filename: `${source} · ${new Date().toISOString().slice(0, 10)}`,
      fileType: "api",
    });

    // Categorization (rules + Claude) runs async — poll GET /v1/statements/{id}
    await ctx.scheduler.runAfter(0, internal.process.processApiTransactions, {
      userId: auth.userId,
      statementId,
      transactions,
    });

    return json(202, { id: statementId, status: "processing", received: transactions.length });
  }),
});

// ─── GET /v1/transactions — list with filters ────────────────────────────────

http.route({
  path: "/v1/transactions",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const auth = await authenticate(ctx, req);
    if (auth instanceof Response) return auth;

    const params = new URL(req.url).searchParams;

    // ?month=YYYY-MM is a shortcut for from/to covering that month
    const month = params.get("month");
    let from = params.get("from") ?? undefined;
    let to = params.get("to") ?? undefined;
    if (month) {
      if (!MONTH_RE.test(month)) return apiError(400, "invalid_param", "'month' debe ser YYYY-MM.");
      from = `${month}-01`;
      to = `${month}-31`;
    }
    if (from && !DATE_RE.test(from)) return apiError(400, "invalid_param", "'from' debe ser YYYY-MM-DD.");
    if (to && !DATE_RE.test(to)) return apiError(400, "invalid_param", "'to' debe ser YYYY-MM-DD.");

    const type = params.get("type") ?? undefined;
    if (type && type !== "income" && type !== "expense") {
      return apiError(400, "invalid_param", "'type' debe ser 'income' o 'expense'.");
    }

    const limit = Math.min(Math.max(parseInt(params.get("limit") ?? "100", 10) || 100, 1), 500);

    const result = await ctx.runQuery(internal.apiQueries.listTransactionsForApi, {
      userId: auth.userId,
      from,
      to,
      category: params.get("category") ?? undefined,
      type: type as "income" | "expense" | undefined,
      includeExcluded: params.get("includeExcluded") === "true",
      numItems: limit,
      cursor: params.get("cursor"),
    });

    return json(200, result);
  }),
});

// ─── GET /v1/summary — monthly aggregate ─────────────────────────────────────

http.route({
  path: "/v1/summary",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const auth = await authenticate(ctx, req);
    if (auth instanceof Response) return auth;

    const month = new URL(req.url).searchParams.get("month");
    if (!month || !MONTH_RE.test(month)) {
      return apiError(400, "invalid_param", "Falta el parámetro 'month' (YYYY-MM).");
    }

    const summary = await ctx.runQuery(internal.apiQueries.getSummaryForApi, {
      userId: auth.userId,
      month,
    });
    return json(200, summary);
  }),
});

// ─── GET /v1/insights — monthly AI insights ──────────────────────────────────

http.route({
  path: "/v1/insights",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const auth = await authenticate(ctx, req);
    if (auth instanceof Response) return auth;

    const params = new URL(req.url).searchParams;
    const month = params.get("month");
    if (!month || !MONTH_RE.test(month)) {
      return apiError(400, "invalid_param", "Falta el parámetro 'month' (YYYY-MM).");
    }

    const existing = await ctx.runQuery(internal.insights.getMonthInsightsInternal, {
      userId: auth.userId,
      month,
    });
    if (existing) {
      return json(200, { month, generatedAt: existing.generatedAt, insights: existing.insights });
    }

    // ?generate=true → generate on demand (takes a few seconds)
    if (params.get("generate") === "true") {
      const insights = await ctx.runAction(internal.insightsActions.generateMonthInsightsInternal, {
        userId: auth.userId,
        month,
      });
      if (insights) {
        return json(200, { month, generatedAt: Date.now(), insights });
      }
      return apiError(404, "no_data", "No hay transacciones en ese mes para generar insights.");
    }

    return apiError(404, "not_generated", "Aún no hay insights para ese mes. Añade '&generate=true' para generarlos.");
  }),
});

// ─── GET /v1/categories — user taxonomy ──────────────────────────────────────

http.route({
  path: "/v1/categories",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const auth = await authenticate(ctx, req);
    if (auth instanceof Response) return auth;

    const taxonomy = await ctx.runQuery(internal.taxonomy.getUserTaxonomyInternal, {
      userId: auth.userId,
    });
    // Before the first upload the user has no taxonomy yet — expose the seeds
    const categories = (taxonomy?.categories ?? SEED_CATEGORIES.map((c) => ({ ...c })))
      .filter((c) => c.isActive)
      .map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        examples: [...c.examples],
        isDefault: c.isDefault,
      }));
    return json(200, { items: categories });
  }),
});

export default http;
