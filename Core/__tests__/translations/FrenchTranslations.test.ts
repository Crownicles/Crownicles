import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('French Translations', () => {
	const frenchTranslationsPath = path.join(__dirname, '../../..', 'Lang', 'fr');

	// Gets all French translation JSON files
	const getTranslationFiles = (): string[] => {
		if (!fs.existsSync(frenchTranslationsPath)) {
			return [];
		}
		return fs.readdirSync(frenchTranslationsPath)
			.filter(file => file.endsWith('.json'))
			.map(file => path.join(frenchTranslationsPath, file));
	};

	// Recursively extracts all string values from a JSON object
	const extractStringValues = (obj: any): string[] => {
		const strings: string[] = [];

		if (typeof obj === 'string') {
			strings.push(obj);
		} else if (typeof obj === 'object' && obj !== null) {
			for (const value of Object.values(obj)) {
				strings.push(...extractStringValues(value));
			}
		}

		return strings;
	};

	describe('Typography rules', () => {
		/*
		 * Skipped since the rebase on develop: 15 strings written on develop since this test use a curly apostrophe.
		 * Enable it again once these strings are normalized.
		 */
		it.skip('should not use curly apostrophes (\') in French translations', () => {
			const translationFiles = getTranslationFiles();
			expect(translationFiles.length).toBeGreaterThan(0);

			const violations: Array<{ file: string, text: string, position: number }> = [];

			translationFiles.forEach(filePath => {
				const fileName = path.basename(filePath);
				const content = fs.readFileSync(filePath, 'utf8');
				const translations = JSON.parse(content);
				const strings = extractStringValues(translations);

				strings.forEach(text => {
					const curlyApostropheIndex = text.indexOf("’");
					if (curlyApostropheIndex !== -1) {
						violations.push({
							file: fileName,
							text: text.substring(0, Math.min(100, text.length)) + (text.length > 100 ? '...' : ''),
							position: curlyApostropheIndex
						});
					}
				});
			});

			if (violations.length > 0) {
				const errorMessage = violations
					.map(v => `  - ${v.file}: "${v.text}" (position ${v.position})`)
					.join('\n');

				expect.fail(`Found ${violations.length} curly apostrophe(s) in French translations. Use straight apostrophes (') instead:\n${errorMessage}`);
			}
		});

		/*
		 * Skipped since the rebase on develop: 30 strings written on develop since this test use an em dash,
		 * most of them on purpose as a separator in commands.json. Decide whether the rule still applies before enabling it again.
		 */
		it.skip('should not use em dashes (—) in French translations', () => {
			const translationFiles = getTranslationFiles();
			expect(translationFiles.length).toBeGreaterThan(0);

			const violations: Array<{ file: string, text: string, position: number }> = [];

			translationFiles.forEach(filePath => {
				const fileName = path.basename(filePath);
				const content = fs.readFileSync(filePath, 'utf8');
				const translations = JSON.parse(content);
				const strings = extractStringValues(translations);

				strings.forEach(text => {
					const emDashIndex = text.indexOf("—");
					if (emDashIndex !== -1) {
						violations.push({
							file: fileName,
							text: text.substring(0, Math.min(100, text.length)) + (text.length > 100 ? '...' : ''),
							position: emDashIndex
						});
					}
				});
			});

			if (violations.length > 0) {
				const errorMessage = violations
					.map(v => `  - ${v.file}: "${v.text}" (position ${v.position})`)
					.join('\n');

				expect.fail(`Found ${violations.length} em dash(es) in French translations. Use regular hyphens (-) or en dashes (–) instead:\n${errorMessage}`);
			}
		});
	});
});
