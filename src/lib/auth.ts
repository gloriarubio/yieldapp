import { betterAuth } from "better-auth";
import { convexAuthAdapter } from "./convex-auth-adapter";

export const auth = betterAuth({
  database: convexAuthAdapter(
    process.env.NEXT_PUBLIC_CONVEX_URL!,
    process.env.CONVEX_ADAPTER_SECRET!
  ),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
});
