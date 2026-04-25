/**
 * Share-list encoding / decoding helpers.
 *
 * The URL hash format is:  #share=<base64url>
 * The base64url payload decodes to a JSON array:
 *   [{ n: "<name>", c: "must-have" | "nice-to-have" }, ...]
 *
 * Short keys keep URLs compact.
 */

/**
 * Encode items into a URL-safe base64url string.
 * @param {Array<{name: string, category: string}>} items
 * @returns {string}
 */
export function encodeSharePayload(items) {
  const payload = items.map((i) => ({ n: i.name, c: i.category }));
  const json = JSON.stringify(payload);
  // btoa requires ASCII, so percent-encode non-ASCII first.
  return btoa(encodeURIComponent(json))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decode a base64url string back to items.
 * @param {string} encoded
 * @returns {Array<{name: string, category: string}>}
 */
export function decodeSharePayload(encoded) {
  // Restore standard base64 padding and character set.
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '==='.slice((b64.length + 3) % 4);
  const json = decodeURIComponent(atob(padded));
  const arr = JSON.parse(json);
  if (!Array.isArray(arr)) throw new Error('Invalid share payload');
  return arr
    .filter((e) => e && typeof e.n === 'string' && typeof e.c === 'string')
    .map((e) => ({ name: e.n, category: e.c }));
}

/**
 * Build a shareable URL for the given items.
 * @param {Array<{name: string, category: string}>} items
 * @param {string} [base] - base URL without fragment (defaults to current page)
 * @returns {string}
 */
export function buildShareUrl(items, base) {
  const rawBase = base ?? (globalThis.location ? globalThis.location.href : '');
  const pageUrl = rawBase.split('#')[0];
  return pageUrl + '#share=' + encodeSharePayload(items);
}

/**
 * Parse the share payload from a URL hash string.
 * @param {string} hash - e.g. '#share=abc123' or 'share=abc123'
 * @returns {Array<{name: string, category: string}> | null}
 */
export function readShareFromHash(hash) {
  const stripped = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(stripped);
  const encoded = params.get('share');
  if (!encoded) return null;
  try {
    return decodeSharePayload(encoded);
  } catch {
    return null;
  }
}
