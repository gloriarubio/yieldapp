import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import { convexAuthAdapter } from "./convex-auth-adapter";

// Origins Better Auth will accept (CSRF protection). Without the production
// URL here, email/password sign-up/in returns 403 in prod ("invalid origin").
const trustedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://yieldapp-goals.netlify.app",
  // Netlify deploy previews (deploy-preview-N--<site>.netlify.app)
  "https://*.netlify.app",
];

const baseURL =
  process.env.BETTER_AUTH_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://yieldapp-goals.netlify.app";

export const auth = betterAuth({
  baseURL,
  trustedOrigins,
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
  // Exposes /api/auth/jwks + /api/auth/token so Convex can verify the user's
  // identity (see convex/auth.config.ts). The JWT `sub` is the user id and
  // `iss` is baseURL. RS256 because Convex Custom JWT does not support the
  // plugin's default EdDSA. Additive — does not change existing auth behaviour.
  plugins: [jwt({ jwks: { keyPairConfig: { alg: "RS256" } } })],
});
