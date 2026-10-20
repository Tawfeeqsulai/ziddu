/**
 * Share links for vendor posts: /posts/<Base64 of the post id>.
 *
 * Post 42 -> "NDI=" -> https://ziddu-one.vercel.app/posts/NDI=
 *
 * The ZIDDU vendor app builds the same link (src/lib/posterShare.js there).
 * Base64 only keeps the raw number out of the URL — it is an encoding, not
 * encryption: anyone can decode it. Only posts that are public anyway
 * (the feed shows them) are served by these links.
 */

export function encodePostShareId(postId: number | string): string {
  const value = String(postId);
  if (!/^[1-9]\d{0,9}$/.test(value)) throw new Error("Only public vendor post IDs can be shared.");
  return globalThis.btoa(value);
}

/** Public share route for vendor posts, or null for app-local post IDs. */
export function getPostSharePath(postId: number | string): string | null {
  const value = String(postId);
  return /^[1-9]\d{0,9}$/.test(value)
    ? `/posts/${encodeURIComponent(encodePostShareId(value))}`
    : null;
}

/** The post id in a share link, or null when the segment is not one. */
export function decodePostShareId(segment: string): number | null {
  let value = segment;
  try {
    value = decodeURIComponent(segment);
  } catch {
    return null;
  }
  // Also accept the URL-safe alphabet and links whose "=" padding was dropped
  const base64 = value.trim().replace(/-/g, "+").replace(/_/g, "/");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return null;
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);

  let decoded: string;
  try {
    // IDs are ASCII digits, so browser and Node base64 helpers can decode them
    // without importing Node's Buffer into client bundles that build share URLs.
    decoded = globalThis.atob(padded);
  } catch {
    return null;
  }
  if (!/^[1-9]\d{0,9}$/.test(decoded)) return null;
  const id = Number(decoded);
  return Number.isSafeInteger(id) ? id : null;
}
