import { describe, expect, it } from 'vitest';
import { categoryLabel, itemLabel, resolveLanguage, translate } from '../src/i18n/index.js';

describe('i18n', () => {
  it('resolves unsupported languages to English', () => {
    expect(resolveLanguage('de')).toBe('en');
    expect(translate('de', 'checkAll')).toBe('Check all');
  });

  it('translates UI strings, categories, and seed items', () => {
    expect(translate('nl', 'checkAll')).toBe('Alles aanvinken');
    expect(categoryLabel('nl', 'pre-departure')).toBe('Voor vertrek');
    expect(itemLabel('nl', 'passport')).toBe('paspoort');
  });

  it('falls back to the source item name for custom items', () => {
    expect(itemLabel('nl', 'custom camera')).toBe('custom camera');
  });
});
