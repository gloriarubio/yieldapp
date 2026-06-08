/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as apiKeyUtils from "../apiKeyUtils.js";
import type * as apiKeys from "../apiKeys.js";
import type * as apiQueries from "../apiQueries.js";
import type * as assistant from "../assistant.js";
import type * as assistantActions from "../assistantActions.js";
import type * as betterAuth from "../betterAuth.js";
import type * as categoryRules from "../categoryRules.js";
import type * as http from "../http.js";
import type * as insights from "../insights.js";
import type * as insightsActions from "../insightsActions.js";
import type * as notifications from "../notifications.js";
import type * as onboarding from "../onboarding.js";
import type * as process from "../process.js";
import type * as projections from "../projections.js";
import type * as projectionsActions from "../projectionsActions.js";
import type * as statements from "../statements.js";
import type * as stripeActions from "../stripeActions.js";
import type * as subscriptionHelpers from "../subscriptionHelpers.js";
import type * as subscriptions from "../subscriptions.js";
import type * as taxonomy from "../taxonomy.js";
import type * as taxonomyActions from "../taxonomyActions.js";
import type * as transactions from "../transactions.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  apiKeyUtils: typeof apiKeyUtils;
  apiKeys: typeof apiKeys;
  apiQueries: typeof apiQueries;
  assistant: typeof assistant;
  assistantActions: typeof assistantActions;
  betterAuth: typeof betterAuth;
  categoryRules: typeof categoryRules;
  http: typeof http;
  insights: typeof insights;
  insightsActions: typeof insightsActions;
  notifications: typeof notifications;
  onboarding: typeof onboarding;
  process: typeof process;
  projections: typeof projections;
  projectionsActions: typeof projectionsActions;
  statements: typeof statements;
  stripeActions: typeof stripeActions;
  subscriptionHelpers: typeof subscriptionHelpers;
  subscriptions: typeof subscriptions;
  taxonomy: typeof taxonomy;
  taxonomyActions: typeof taxonomyActions;
  transactions: typeof transactions;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
