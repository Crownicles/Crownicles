import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('expeditionAdvice / talisman formatting (fr)', () => {
  it('every mention of talisman must include the emote and be bolded', () => {
    const filePath = path.join(__dirname, '..', '..', 'Lang', 'fr', 'smallEvents.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(raw);

    const block = json.expeditionAdvice;
    expect(block).toBeDefined();

    const walk = (obj: any, prefix = ''): { key: string; value: string }[] => {
      const results: { key: string; value: string }[] = [];
      if (typeof obj === 'string') return [{ key: prefix, value: obj }];
      if (Array.isArray(obj)) {
        obj.forEach((v, i) => results.push(...walk(v, `${prefix}[${i}]`)));
        return results;
      }
      if (typeof obj === 'object' && obj !== null) {
        for (const k of Object.keys(obj)) results.push(...walk(obj[k], prefix ? `${prefix}.${k}` : k));
      }
      return results;
    };

    const nodes = walk(block);

    const errors: { key: string; value: string }[] = [];
    for (const { key, value } of nodes) {
      // check only strings mentioning talisman (case-insensitive)
      if (/talisman/i.test(value)) {
        // Skip the talisman.name key as it's just the name definition
        if (key === 'talisman.name') continue;

        const hasEmote = /\{emote:expedition\.talisman\}/.test(value);
        // Accept either the hardcoded name or the placeholder
        const hasBoldFullName = /\*\*Talisman d'Ancrage\*\*/.test(value) || /\*\*\{\{talismanName\}\}\*\*/.test(value);
        if (!hasEmote || !hasBoldFullName) errors.push({ key, value });
      }
    }

    expect(errors, `Found incorrectly formatted talisman mentions:
${errors.map(e => `${e.key}: ${e.value}`).join('\n')}`).toHaveLength(0);
  });
});
