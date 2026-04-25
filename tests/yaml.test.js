import { describe, it, expect } from 'vitest';
import { parseYaml } from '../src/yaml.js';

describe('parseYaml', () => {
  it('parses two-category list format', () => {
    const text = `
must-have:
  - passport
  - toothbrush
nice-to-have:
  - umbrella
`;
    expect(parseYaml(text)).toEqual({
      'must-have': ['passport', 'toothbrush'],
      'nice-to-have': ['umbrella'],
    });
  });

  it('ignores comments and blank lines', () => {
    const text = `
# top-comment
must-have:
  - passport  # trailing comment

  - socks
nice-to-have:
`;
    const out = parseYaml(text);
    expect(out['must-have']).toEqual(['passport', 'socks']);
    expect(out['nice-to-have']).toEqual([]);
  });

  it('strips surrounding quotes', () => {
    expect(parseYaml(`must-have:\n  - "tooth paste"\n  - 'socks'\n`)).toEqual({
      'must-have': ['tooth paste', 'socks'],
    });
  });

  it('throws on unsupported lines', () => {
    expect(() => parseYaml('foo: bar\n')).toThrow();
  });
});
