"use node";

import { action, internalAction, ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireUserId } from "./authz";
import Stripe from "stripe";

// Stripe lives entirely server-side: Checkout + Customer Portal for the
// frontend, a webhook (convex/http.ts → processStripeWebhook) to keep the
// subscriptions table in sync, and a one-time setup action for products.
//
// Required Convex env vars (npx convex env set):
//   STRIPE_SECRET_KEY     — restricted (rk_...) or secret (sk_...) test key
//   STRIPE_WEBHOOK_SECRET — signing secret of the webhook endpoint
//   SITE_URL              — e.g. http://localhost:3000 (success/cancel returns)

// Price lookup keys created by setupStripeProducts — resolved at runtime so
// no price IDs need to live in env vars
const LOOKUP_KEYS = {
  month: "yield_pro_month",
  year: "yield_pro_year",
} as const;

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Falta STRIPE_SECRET_KEY en las variables de entorno de Convex");
  return new Stripe(key);
}

function siteUrl(): string {
  return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

// current_period_end moved from the subscription to its items in recent API
// versions — read both shapes
function periodEndMs(sub: Stripe.Subscription): number | undefined {
  const onSub = (sub as unknown as { current_period_end?: number }).current_period_end;
  const onItem = (sub.items.data[0] as unknown as { current_period_end?: number })
    ?.current_period_end;
  const seconds = onSub ?? onItem;
  return seconds ? seconds * 1000 : undefined;
}

function intervalOf(sub: Stripe.Subscription): "month" | "year" | undefined {
  const interval = sub.items.data[0]?.price?.recurring?.interval;
  return interval === "month" || interval === "year" ? interval : undefined;
}

async function syncSubscription(
  ctx: ActionCtx,
  sub: Stripe.Subscription,
  userId?: string
) {
  // The Customer Portal now schedules cancellations via `cancel_at` (a
  // timestamp) — the legacy `cancel_at_period_end` boolean stays false
  const willCancel = sub.cancel_at_period_end || sub.cancel_at !== null;
  await ctx.runMutation(internal.subscriptions.upsertSubscription, {
    userId,
    stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripeSubscriptionId: sub.id,
    plan: "pro",
    interval: intervalOf(sub),
    status: sub.status,
    cancelAtPeriodEnd: willCancel,
    currentPeriodEnd: periodEndMs(sub),
  });
}

// ─── Checkout ────────────────────────────────────────────────────────────────

export const createCheckoutSession = action({
  args: {
    interval: v.union(v.literal("month"), v.literal("year")),
  },
  handler: async (ctx, args): Promise<{ url: string }> => {
    const userId = await requireUserId(ctx);
    const stripe = getStripe();

    // Resolve the price by lookup key (created by setupStripeProducts)
    const prices = await stripe.prices.list({
      lookup_keys: [LOOKUP_KEYS[args.interval]],
      active: true,
      limit: 1,
    });
    const price = prices.data[0];
    if (!price) {
      throw new Error(
        `No existe el precio '${LOOKUP_KEYS[args.interval]}' en Stripe. Ejecuta: npx convex run stripeActions:setupStripeProducts`
      );
    }

    // Reuse the Stripe customer if we already created one for this user
    const existing = await ctx.runQuery(internal.subscriptions.getSubscriptionInternal, {
      userId: userId,
    });
    let customerId = existing?.stripeCustomerId;
    if (!customerId) {
      const info = await ctx.runQuery(internal.subscriptions.getUserInfoInternal, {
        userId: userId,
      });
      const customer = await stripe.customers.create({
        email: info?.email,
        name: info?.name,
        metadata: { userId: userId },
      });
      customerId = customer.id;
      await ctx.runMutation(internal.subscriptions.rememberStripeCustomer, {
        userId: userId,
        stripeCustomerId: customerId,
      });
    }

    // Dynamic payment methods: never pass payment_method_types
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: userId,
      line_items: [{ price: price.id, quantity: 1 }],
      subscription_data: { metadata: { userId: userId } },
      allow_promotion_codes: true,
      success_url: `${siteUrl()}/app/ajustes?tab=suscripcion&checkout=success`,
      cancel_url: `${siteUrl()}/app/ajustes?tab=suscripcion&checkout=cancelled`,
    });

    if (!session.url) throw new Error("Stripe no devolvió URL de checkout");
    return { url: session.url };
  },
});

// ─── Customer Portal (manage / cancel / change payment method) ──────────────

export const createPortalSession = action({
  args: {},
  handler: async (ctx): Promise<{ url: string }> => {
    const userId = await requireUserId(ctx);
    const stripe = getStripe();
    const sub = await ctx.runQuery(internal.subscriptions.getSubscriptionInternal, {
      userId: userId,
    });
    if (!sub?.stripeCustomerId) {
      throw new Error("No hay cliente de Stripe para este usuario");
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${siteUrl()}/app/ajustes?tab=suscripcion`,
    });
    return { url: session.url };
  },
});

// ─── Webhook processing (called from convex/http.ts) ────────────────────────

export const processStripeWebhook = internalAction({
  args: { payload: v.string(), signature: v.string() },
  handler: async (ctx, args) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error("Falta STRIPE_WEBHOOK_SECRET en las variables de entorno de Convex");

    const stripe = getStripe();
    // Throws on bad signature — http.ts turns that into a 400
    const event = stripe.webhooks.constructEvent(args.payload, args.signature, secret);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode !== "subscription" || !session.subscription) break;
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;
        const sub = await stripe.subscriptions.retrieve(subId);
        await syncSubscription(ctx, sub, session.client_reference_id ?? undefined);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object;
        await syncSubscription(ctx, sub, sub.metadata?.userId || undefined);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        await ctx.runMutation(internal.subscriptions.upsertSubscription, {
          userId: sub.metadata?.userId || undefined,
          stripeCustomerId:
            typeof sub.customer === "string" ? sub.customer : sub.customer.id,
          stripeSubscriptionId: sub.id,
          plan: "free",
          status: "canceled",
          cancelAtPeriodEnd: false,
          currentPeriodEnd: periodEndMs(sub),
        });
        break;
      }

      default:
        // Ignore everything else (invoices, payment intents...) — the
        // subscription lifecycle events above are the source of truth
        break;
    }

    return { received: true };
  },
});

// ─── One-time setup: create Yield Pro product + prices (idempotent) ──────────
// Run with: npx convex run stripeActions:setupStripeProducts

export const setupStripeProducts = internalAction({
  args: {},
  handler: async () => {
    const stripe = getStripe();
    const results: string[] = [];

    // Find or create the product
    const products = await stripe.products.list({ active: true, limit: 100 });
    let product = products.data.find((p) => p.name === "Yield Pro");
    if (!product) {
      product = await stripe.products.create({
        name: "Yield Pro",
        description:
          "Extractos recurrentes ilimitados, categorías que aprenden de ti, asistente IA y acceso a la API.",
      });
      results.push(`Producto creado: ${product.id}`);
    } else {
      results.push(`Producto ya existía: ${product.id}`);
    }

    const wanted = [
      { lookup: LOOKUP_KEYS.month, amount: 700, interval: "month" as const },
      { lookup: LOOKUP_KEYS.year, amount: 5900, interval: "year" as const },
    ];

    for (const w of wanted) {
      const existing = await stripe.prices.list({
        lookup_keys: [w.lookup],
        active: true,
        limit: 1,
      });
      if (existing.data.length > 0) {
        results.push(`Precio ya existía: ${w.lookup} → ${existing.data[0].id}`);
        continue;
      }
      const price = await stripe.prices.create({
        product: product.id,
        currency: "eur",
        unit_amount: w.amount,
        recurring: { interval: w.interval },
        lookup_key: w.lookup,
      });
      results.push(`Precio creado: ${w.lookup} → ${price.id}`);
    }

    return results;
  },
});
