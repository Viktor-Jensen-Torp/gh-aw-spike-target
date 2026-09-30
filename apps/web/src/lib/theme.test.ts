import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Theme tokens cover design variables', () => {
  it('every colour variable in design/tempo.pen except transparent has a --color-<name> token with the same value', () => {
    // Read the design file
    const designPath = path.join(process.cwd(), 'design/tempo.pen');
    const designContent = fs.readFileSync(designPath, 'utf-8');
    const design = JSON.parse(designContent);

    // Read the theme CSS file
    const cssPath = path.join(process.cwd(), 'apps/web/src/index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    const variables = design.variables as Record<
      string,
      { type: string; value: string }
    >;

    const missingTokens: string[] = [];
    const valueMismatches: Array<{
      name: string;
      expected: string;
      actual: string;
    }> = [];

    for (const [varName, varDef] of Object.entries(variables)) {
      // Skip transparent and non-colour variables
      if (varName === 'transparent' || varDef.type !== 'color') {
        continue;
      }

      const tokenName = `--color-${varName}`;
      const expectedValue = varDef.value.toLowerCase();

      // Check if token exists in CSS
      if (!cssContent.includes(tokenName)) {
        missingTokens.push(varName);
        continue;
      }

      // Extract the token value from CSS
      const regex = new RegExp(`${tokenName}:\\s*([^;]+);`);
      const match = cssContent.match(regex);

      if (!match) {
        missingTokens.push(varName);
        continue;
      }

      const actualValue = match[1]?.toLowerCase().trim() ?? '';

      // Compare values (case-insensitive, handling both formats)
      // Convert both to lowercase hex for comparison
      if (actualValue !== expectedValue) {
        valueMismatches.push({
          name: varName,
          expected: expectedValue,
          actual: actualValue,
        });
      }
    }

    // Build error message
    const errors: string[] = [];

    if (missingTokens.length > 0) {
      errors.push(`Missing tokens for: ${missingTokens.join(', ')}`);
    }

    if (valueMismatches.length > 0) {
      errors.push(
        `Value mismatches:\n${valueMismatches.map((m) => `  ${m.name}: expected ${m.expected}, got ${m.actual}`).join('\n')}`,
      );
    }

    expect(
      errors,
      'All colour variables should have tokens with matching values',
    ).toEqual([]);
  });

  it("$font is still the theme's sans font", () => {
    const designPath = path.join(process.cwd(), 'design/tempo.pen');
    const designContent = fs.readFileSync(designPath, 'utf-8');
    const design = JSON.parse(designContent);

    const fontVar = design.variables.font;
    if (!fontVar) {
      throw new Error('Font variable not found in design');
    }
    const fontValue = fontVar.value;
    expect(fontValue).toBe('Inter');

    // Check that the CSS has the sans font set
    const cssPath = path.join(process.cwd(), 'apps/web/src/index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    expect(cssContent).toContain('--font-sans');
    expect(cssContent).toContain('Inter');
  });
});
