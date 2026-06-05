import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const whereValidator = v.array(
  v.object({
    field: v.string(),
    value: v.any(),
    operator: v.string(),
    connector: v.optional(v.union(v.literal("AND"), v.literal("OR"))),
    mode: v.optional(v.string()),
  })
);

function checkSecret(secret: string) {
  if (secret !== process.env.CONVEX_ADAPTER_SECRET) {
    throw new Error("Unauthorized: invalid adapter secret");
  }
}

function evalClause(
  doc: Record<string, unknown>,
  clause: { field: string; value: unknown; operator: string }
): boolean {
  const { field, value, operator } = clause;
  const docValue = doc[field];
  switch (operator) {
    case "eq":
      return value === null ? docValue == null : docValue === value;
    case "ne":
      return docValue !== value;
    case "gt":
      return value != null && (docValue as number) > (value as number);
    case "gte":
      return value != null && (docValue as number) >= (value as number);
    case "lt":
      return value != null && (docValue as number) < (value as number);
    case "lte":
      return value != null && (docValue as number) <= (value as number);
    case "in":
      return Array.isArray(value) && value.includes(docValue);
    case "not_in":
      return Array.isArray(value) && !value.includes(docValue);
    case "contains":
      return (
        typeof docValue === "string" &&
        typeof value === "string" &&
        docValue.includes(value)
      );
    case "starts_with":
      return (
        typeof docValue === "string" &&
        typeof value === "string" &&
        docValue.startsWith(value)
      );
    case "ends_with":
      return (
        typeof docValue === "string" &&
        typeof value === "string" &&
        docValue.endsWith(value)
      );
    default:
      return docValue === value;
  }
}

function matchesWhere(
  doc: Record<string, unknown>,
  where: Array<{ field: string; value: unknown; operator: string; connector?: "AND" | "OR" }>
): boolean {
  if (!where.length) return true;
  let result = evalClause(doc, where[0]);
  for (let i = 1; i < where.length; i++) {
    const clauseResult = evalClause(doc, where[i]);
    result =
      where[i].connector === "OR"
        ? result || clauseResult
        : result && clauseResult;
  }
  return result;
}

async function getAllDocs(db: any, model: string): Promise<any[]> {
  switch (model) {
    case "user":
      return db.query("user").collect();
    case "session":
      return db.query("session").collect();
    case "account":
      return db.query("account").collect();
    case "verification":
      return db.query("verification").collect();
    default:
      throw new Error(`Unknown auth model: ${model}`);
  }
}

function stripConvexFields(doc: any): Record<string, unknown> | null {
  if (!doc) return null;
  const { _id, _creationTime, ...rest } = doc;
  return rest;
}

export const dbCreate = mutation({
  args: { secret: v.string(), model: v.string(), data: v.any() },
  handler: async (ctx, { secret, model, data }) => {
    checkSecret(secret);
    switch (model) {
      case "user":
        await ctx.db.insert("user", data);
        break;
      case "session":
        await ctx.db.insert("session", data);
        break;
      case "account":
        await ctx.db.insert("account", data);
        break;
      case "verification":
        await ctx.db.insert("verification", data);
        break;
      default:
        throw new Error(`Unknown auth model: ${model}`);
    }
    return data as Record<string, unknown>;
  },
});

export const dbFindOne = query({
  args: { secret: v.string(), model: v.string(), where: whereValidator },
  handler: async (ctx, { secret, model, where }) => {
    checkSecret(secret);
    const docs = await getAllDocs(ctx.db, model);
    const match = docs.find((doc) => matchesWhere(doc, where));
    return stripConvexFields(match ?? null);
  },
});

export const dbFindMany = query({
  args: {
    secret: v.string(),
    model: v.string(),
    where: v.optional(whereValidator),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    sortBy: v.optional(
      v.object({
        field: v.string(),
        direction: v.union(v.literal("asc"), v.literal("desc")),
      })
    ),
  },
  handler: async (ctx, { secret, model, where, limit, offset, sortBy }) => {
    checkSecret(secret);
    let docs = await getAllDocs(ctx.db, model);
    if (where && where.length > 0) {
      docs = docs.filter((doc) => matchesWhere(doc, where));
    }
    if (sortBy) {
      docs.sort((a: any, b: any) => {
        const av = a[sortBy.field];
        const bv = b[sortBy.field];
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortBy.direction === "asc" ? cmp : -cmp;
      });
    }
    const start = offset ?? 0;
    const sliced = limit != null ? docs.slice(start, start + limit) : docs.slice(start);
    return sliced.map(stripConvexFields);
  },
});

export const dbUpdate = mutation({
  args: {
    secret: v.string(),
    model: v.string(),
    where: whereValidator,
    update: v.any(),
  },
  handler: async (ctx, { secret, model, where, update }) => {
    checkSecret(secret);
    const docs = await getAllDocs(ctx.db, model);
    const match = docs.find((doc) => matchesWhere(doc, where));
    if (!match) return null;
    await ctx.db.patch(match._id, update);
    const updated = await ctx.db.get(match._id);
    return stripConvexFields(updated);
  },
});

export const dbUpdateMany = mutation({
  args: {
    secret: v.string(),
    model: v.string(),
    where: whereValidator,
    update: v.any(),
  },
  handler: async (ctx, { secret, model, where, update }) => {
    checkSecret(secret);
    const docs = await getAllDocs(ctx.db, model);
    const matches = docs.filter((doc) => matchesWhere(doc, where));
    await Promise.all(matches.map((doc: any) => ctx.db.patch(doc._id, update)));
    return matches.length;
  },
});

export const dbDelete = mutation({
  args: { secret: v.string(), model: v.string(), where: whereValidator },
  handler: async (ctx, { secret, model, where }) => {
    checkSecret(secret);
    const docs = await getAllDocs(ctx.db, model);
    const match = docs.find((doc) => matchesWhere(doc, where));
    if (match) await ctx.db.delete(match._id);
  },
});

export const dbDeleteMany = mutation({
  args: { secret: v.string(), model: v.string(), where: whereValidator },
  handler: async (ctx, { secret, model, where }) => {
    checkSecret(secret);
    const docs = await getAllDocs(ctx.db, model);
    const matches = docs.filter((doc) => matchesWhere(doc, where));
    await Promise.all(matches.map((doc: any) => ctx.db.delete(doc._id)));
    return matches.length;
  },
});

export const dbCount = query({
  args: {
    secret: v.string(),
    model: v.string(),
    where: v.optional(whereValidator),
  },
  handler: async (ctx, { secret, model, where }) => {
    checkSecret(secret);
    const docs = await getAllDocs(ctx.db, model);
    if (!where || where.length === 0) return docs.length;
    return docs.filter((doc) => matchesWhere(doc, where)).length;
  },
});
