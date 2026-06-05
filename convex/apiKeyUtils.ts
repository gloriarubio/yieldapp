// Pure helpers shared between apiKeys.ts (key creation) and http.ts (key
// verification). No Convex function exports — safe to import from anywhere.
// Uses Web Crypto, available in the default Convex runtime (no "use node").

export const API_KEY_PREFIX = "yld_";

/** SHA-256 of a string, hex-encoded. */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Generates a new plaintext API key: yld_ + 48 hex chars (24 random bytes). */
export function generateApiKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${API_KEY_PREFIX}${hex}`;
}

/** First chars of the key, used to identify it in the UI ("yld_a1b2c3…"). */
export function keyPrefix(key: string): string {
  return key.slice(0, API_KEY_PREFIX.length + 6);
}
