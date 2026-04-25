import { describe, it, expect } from 'vitest';
import {
  encodeSharePayload,
  decodeSharePayload,
  buildShareUrl,
  readShareFromHash,
} from '../src/share.js';

const ITEMS = [
  { name: 'passport', category: 'must-have' },
  { name: 'umbrella', category: 'nice-to-have' },
];

describe('share', () => {
  it('round-trips items through encode / decode', () => {
    const encoded = encodeSharePayload(ITEMS);
    expect(typeof encoded).toBe('string');
    expect(decodeSharePayload(encoded)).toEqual(ITEMS);
  });

  it('produces a URL-safe string (no +, /, or = characters)', () => {
    const encoded = encodeSharePayload(ITEMS);
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it('handles items with non-ASCII characters', () => {
    const items = [{ name: 'résumé', category: 'must-have' }];
    expect(decodeSharePayload(encodeSharePayload(items))).toEqual(items);
  });

  it('buildShareUrl embeds the payload in the URL hash', () => {
    const url = buildShareUrl(ITEMS, 'https://example.com/');
    expect(url).toContain('#share=');
    const items = readShareFromHash('#' + url.split('#')[1]);
    expect(items).toEqual(ITEMS);
  });

  it('buildShareUrl strips any existing hash from the base', () => {
    const url = buildShareUrl(ITEMS, 'https://example.com/#old');
    expect(url).toContain('#share=');
    expect(url).not.toContain('#old');
  });

  it('readShareFromHash returns null for missing share param', () => {
    expect(readShareFromHash('')).toBeNull();
    expect(readShareFromHash('#')).toBeNull();
    expect(readShareFromHash('#otherparam=foo')).toBeNull();
  });

  it('readShareFromHash returns null for an invalid payload', () => {
    expect(readShareFromHash('#share=!!!invalid!!!')).toBeNull();
  });

  it('decodeSharePayload filters out entries missing required fields', () => {
    // Build a raw payload that contains one valid and one invalid entry,
    // then verify only the valid entry survives.
    const rawPayload = JSON.stringify([
      { n: 'passport', c: 'must-have' },
      { invalid: true },
    ]);
    const encoded = decodeSharePayload(
      btoa(encodeURIComponent(rawPayload))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, ''),
    );
    expect(encoded).toHaveLength(1);
    expect(encoded[0]).toEqual({ name: 'passport', category: 'must-have' });
  });

  it('readShareFromHash accepts a hash string without the leading #', () => {
    const encoded = encodeSharePayload(ITEMS);
    expect(readShareFromHash(`share=${encoded}`)).toEqual(ITEMS);
  });
});
