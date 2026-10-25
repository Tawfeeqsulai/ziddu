import "server-only";

// Serverless instances each open their own pool, and both Prisma clients share one
// MySQL server, so keep every pool small to stay under the server's connection cap.
const DEFAULT_CONNECTION_LIMIT = "1";
const DEFAULT_POOL_TIMEOUT_SECONDS = "20";

export function pooledDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  const [base, query = ""] = url.split("?");
  const params = new URLSearchParams(query);
  // Cap the pool even when the supplied URL already has a larger value.
  // Multiple serverless instances multiply this per-process limit.
  params.set("connection_limit", DEFAULT_CONNECTION_LIMIT);
  if (!params.has("pool_timeout")) params.set("pool_timeout", DEFAULT_POOL_TIMEOUT_SECONDS);
  return `${base}?${params}`;
}
