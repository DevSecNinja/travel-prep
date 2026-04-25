/**
 * HTML validation tests for Travel Prep.
 */

const fs = require('fs');
const path = require('path');
const { HtmlValidate } = require('html-validate');

const htmlPath = path.resolve(__dirname, '../../index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

describe('HTML validation', () => {
  test('index.html passes HTML validation', () => {
    const htmlvalidate = new HtmlValidate({
      extends: ['html-validate:recommended'],
      rules: {
        // Allow inline styles and scripts (single-file app pattern)
        'no-inline-style': 'off',
        // Allow void style (self-closing tags) since we use strict HTML5
        'void-style': 'off',
        // Allow missing end tags for void elements
        'no-trailing-whitespace': 'off',
        // Relax some rules for our single-file pattern
        'script-type': 'off',
        'tel-non-breaking': 'off',
        'prefer-native-element': 'off',
      },
    });

    const report = htmlvalidate.validateStringSync(html);
    const errors = report.results
      .flatMap(r => r.messages)
      .filter(m => m.severity >= 2);

    if (errors.length > 0) {
      console.log('HTML validation errors:');
      errors.forEach(e => console.log(`  Line ${e.line}: ${e.message} (${e.ruleId})`));
    }

    expect(errors).toHaveLength(0);
  });

  test('has proper lang attribute', () => {
    expect(html).toMatch(/<html\s+lang="en"/);
  });

  test('has proper meta charset', () => {
    expect(html).toMatch(/<meta\s+charset="UTF-8"/i);
  });

  test('has proper viewport meta', () => {
    expect(html).toMatch(/<meta\s+name="viewport"/);
    expect(html).toMatch(/width=device-width/);
    expect(html).toMatch(/viewport-fit=cover/);
  });

  test('has a title element', () => {
    expect(html).toMatch(/<title>[^<]+<\/title>/);
  });

  test('has meta description', () => {
    expect(html).toMatch(/<meta\s+name="description"\s+content="[^"]+"/);
  });
});
