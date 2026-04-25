/**
 * Tiny YAML parser limited to the structure used by this app:
 *
 *   key:
 *     - value
 *     - value
 *   other-key:
 *     - value
 *
 * Lines starting with `#` and blank lines are ignored.
 * This is intentionally minimal — we control the source file. For anything
 * more complex, swap in `js-yaml`.
 *
 * @param {string} text
 * @returns {Record<string, string[]>}
 */
export function parseYaml(text) {
  /** @type {Record<string, string[]>} */
  const out = {};
  let currentKey = null;

  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+#.*$/, ''); // strip trailing comments
    if (!line.trim() || line.trim().startsWith('#')) continue;

    // Top-level "key:" entry.
    const keyMatch = line.match(/^([A-Za-z0-9_-]+)\s*:\s*$/);
    if (keyMatch) {
      currentKey = keyMatch[1];
      out[currentKey] = [];
      continue;
    }

    // List item under current key: "  - value".
    const itemMatch = line.match(/^\s+-\s+(.*?)\s*$/);
    if (itemMatch && currentKey) {
      let value = itemMatch[1];
      // Strip optional surrounding quotes.
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      out[currentKey].push(value);
      continue;
    }

    throw new Error(`Unsupported YAML line: ${JSON.stringify(rawLine)}`);
  }

  return out;
}
