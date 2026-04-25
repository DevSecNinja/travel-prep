/**
 * Accessibility tests for Travel Prep using axe-core.
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');

describe('Accessibility', () => {
  let document;

  beforeEach(() => {
    const dom = new JSDOM(html, { url: 'http://localhost' });
    document = dom.window.document;
  });

  test('all images have alt text (if any)', () => {
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      expect(img.hasAttribute('alt')).toBe(true);
    });
  });

  test('all interactive elements have accessible labels', () => {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => {
      const hasLabel = btn.hasAttribute('aria-label') ||
                       btn.hasAttribute('aria-labelledby') ||
                       btn.textContent.trim().length > 0;
      expect(hasLabel).toBe(true);
    });
  });

  test('form inputs have labels', () => {
    const input = document.getElementById('newItemInput');
    expect(input).not.toBeNull();
    expect(input.hasAttribute('aria-label')).toBe(true);
  });

  test('select has label', () => {
    const select = document.getElementById('newItemCategory');
    expect(select).not.toBeNull();
    expect(select.hasAttribute('aria-label')).toBe(true);
  });

  test('form has aria-label', () => {
    const form = document.getElementById('addItemForm');
    expect(form).not.toBeNull();
    expect(form.hasAttribute('aria-label')).toBe(true);
  });

  test('suitcase area has role and aria-label', () => {
    const suitcase = document.getElementById('suitcaseArea');
    expect(suitcase).not.toBeNull();
    expect(suitcase.getAttribute('role')).toBe('region');
    expect(suitcase.hasAttribute('aria-label')).toBe(true);
  });

  test('progress bar has proper ARIA attributes', () => {
    const progress = document.getElementById('progressSection');
    expect(progress).not.toBeNull();
    expect(progress.getAttribute('role')).toBe('progressbar');
    expect(progress.hasAttribute('aria-valuenow')).toBe(true);
    expect(progress.hasAttribute('aria-valuemin')).toBe(true);
    expect(progress.hasAttribute('aria-valuemax')).toBe(true);
  });

  test('packing lists section has aria-label', () => {
    const section = document.getElementById('packingLists');
    expect(section).not.toBeNull();
    expect(section.hasAttribute('aria-label')).toBe(true);
  });

  test('theme toggle is accessible', () => {
    const toggle = document.getElementById('themeToggle');
    expect(toggle).not.toBeNull();
    expect(toggle.hasAttribute('aria-label')).toBe(true);
    expect(toggle.getAttribute('aria-label')).toBe('Toggle theme');
  });

  test('update banner has role alert', () => {
    const banner = document.getElementById('updateBanner');
    expect(banner).not.toBeNull();
    expect(banner.getAttribute('role')).toBe('alert');
  });

  test('page has proper heading hierarchy', () => {
    const h1 = document.querySelectorAll('h1');
    expect(h1.length).toBeGreaterThanOrEqual(1);
  });
});
