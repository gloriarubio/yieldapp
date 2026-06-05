import { createAdapterFactory } from "better-auth/adapters";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

export function convexAuthAdapter(convexUrl: string, secret: string) {
  const client = new ConvexHttpClient(convexUrl);

  return createAdapterFactory({
    config: {
      adapterId: "convex",
      adapterName: "Convex Adapter",
      usePlural: false,
      supportsDates: false,
      supportsBooleans: true,
      supportsJSON: true,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adapter: (): any => ({
      create: async ({ model, data }: { model: string; data: any }) => {
        return client.mutation(api.betterAuth.dbCreate, { secret, model, data });
      },

      findOne: async ({ model, where }: { model: string; where: any[] }) => {
        return client.query(api.betterAuth.dbFindOne, {
          secret,
          model,
          where: where ?? [],
        });
      },

      findMany: async ({
        model,
        where,
        limit,
        offset,
        sortBy,
      }: {
        model: string;
        where?: any[];
        limit?: number;
        offset?: number;
        sortBy?: { field: string; direction: "asc" | "desc" };
      }) => {
        return client.query(api.betterAuth.dbFindMany, {
          secret,
          model,
          where: where ?? [],
          limit,
          offset,
          sortBy,
        });
      },

      update: async ({
        model,
        where,
        update,
      }: {
        model: string;
        where: any[];
        update: any;
      }) => {
        return client.mutation(api.betterAuth.dbUpdate, { secret, model, where, update });
      },

      updateMany: async ({
        model,
        where,
        update,
      }: {
        model: string;
        where: any[];
        update: any;
      }) => {
        return client.mutation(api.betterAuth.dbUpdateMany, { secret, model, where, update });
      },

      delete: async ({ model, where }: { model: string; where: any[] }) => {
        await client.mutation(api.betterAuth.dbDelete, { secret, model, where });
      },

      deleteMany: async ({ model, where }: { model: string; where: any[] }) => {
        return client.mutation(api.betterAuth.dbDeleteMany, { secret, model, where });
      },

      count: async ({ model, where }: { model: string; where?: any[] }) => {
        return client.query(api.betterAuth.dbCount, {
          secret,
          model,
          where: where ?? [],
        });
      },
    }),
  });
}
