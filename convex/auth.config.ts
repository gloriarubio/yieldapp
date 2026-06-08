// Lets Convex verify JWTs issued by Better Auth's `jwt` plugin, so functions
// can call `ctx.auth.getUserIdentity()` and trust the caller's identity
// (instead of a client-supplied `userId`). See SECURITY-IDOR-PLAN.md.
//
// `issuer` must match the JWT `iss` (Better Auth baseURL) and `jwks` points at
// the Better Auth JWKS endpoint. Uses SITE_URL (a Convex env var).
const issuer =
  process.env.SITE_URL ?? "https://yieldapp-goals.netlify.app";

const authConfig = {
  providers: [
    {
      type: "customJwt",
      // Better Auth's jwt plugin sets `aud` to the baseURL (= issuer here).
      applicationID: issuer,
      issuer,
      jwks: `${issuer}/api/auth/jwks`,
      algorithm: "RS256",
    },
  ],
};

export default authConfig;
