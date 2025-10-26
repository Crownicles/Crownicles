import { describe, expect, it } from 'vitest';
import { readdirSync } from 'fs';
import { resolve } from 'path';

describe('Pet powers veterinarian descriptions', () => {
	it('should have French veterinarian descriptions for all pet powers', () => {
		// Get all pet action files
		const petActionsPath = resolve(__dirname, '../../../src/core/fights/actions/interfaces/pets');
		const petActionFiles = readdirSync(petActionsPath)
			.filter(file => file.endsWith('.ts'))
			.map(file => file.replace('.ts', ''));

		// Load French translations for veterinarian comments
		const frTranslationsPath = resolve(__dirname, '../../../../Lang/fr/commands.json');
		const frTranslations = JSON.parse(require('fs').readFileSync(frTranslationsPath, 'utf8'));
		const vetComments = frTranslations.shop?.shopItems?.lovePointsValue?.commentOnFightEffect || {};

		// Check each pet action has a description
		const missingDescriptions: string[] = [];
		for (const petAction of petActionFiles) {
			if (!vetComments[petAction]) {
				missingDescriptions.push(petAction);
			}
		}

		// Assert that no descriptions are missing
		if (missingDescriptions.length > 0) {
			const errorMessage = `The following veterinarian descriptions are missing in Lang/fr/commands.json:\n` +
				missingDescriptions.map(action => `  - shop.shopItems.lovePointsValue.commentOnFightEffect.${action}`).join('\n') +
				`\n\nTotal missing: ${missingDescriptions.length}/${petActionFiles.length}`;
			
			expect(missingDescriptions, errorMessage).toHaveLength(0);
		}

		// If we get here, all descriptions exist
		expect(petActionFiles.length).toBeGreaterThan(0);
	});

	it('should have valid format for all veterinarian descriptions', () => {
		// Load French translations
		const frTranslationsPath = resolve(__dirname, '../../../../Lang/fr/commands.json');
		const frTranslations = JSON.parse(require('fs').readFileSync(frTranslationsPath, 'utf8'));
		const vetComments = frTranslations.shop?.shopItems?.lovePointsValue?.commentOnFightEffect || {};

		// Check that each description is a non-empty string or array of strings
		const invalidDescriptions: string[] = [];
		for (const [key, value] of Object.entries(vetComments)) {
			if (Array.isArray(value)) {
				// Should be an array of non-empty strings
				if (value.length === 0 || !value.every(v => typeof v === 'string' && v.trim().length > 0)) {
					invalidDescriptions.push(key);
				}
			} else if (typeof value !== 'string' || value.trim().length === 0) {
				// Should be a non-empty string
				invalidDescriptions.push(key);
			}
		}

		if (invalidDescriptions.length > 0) {
			const errorMessage = `The following veterinarian descriptions are invalid (empty or not string/array):\n` +
				invalidDescriptions.map(action => `  - shop.shopItems.lovePointsValue.commentOnFightEffect.${action}`).join('\n');
			
			expect(invalidDescriptions, errorMessage).toHaveLength(0);
		}
	});

	it('should have consistent naming between pet actions and descriptions', () => {
		// Get all pet action files
		const petActionsPath = resolve(__dirname, '../../../src/core/fights/actions/interfaces/pets');
		const petActionFiles = readdirSync(petActionsPath)
			.filter(file => file.endsWith('.ts'))
			.map(file => file.replace('.ts', ''));

		// Load French translations
		const frTranslationsPath = resolve(__dirname, '../../../../Lang/fr/commands.json');
		const frTranslations = JSON.parse(require('fs').readFileSync(frTranslationsPath, 'utf8'));
		const vetComments = frTranslations.shop?.shopItems?.lovePointsValue?.commentOnFightEffect || {};

		// Find descriptions that don't have a corresponding action file
		const extraDescriptions: string[] = [];
		for (const descriptionKey of Object.keys(vetComments)) {
			if (!petActionFiles.includes(descriptionKey)) {
				extraDescriptions.push(descriptionKey);
			}
		}

		// This is a warning, not a failure - extra descriptions might be for deprecated actions
		if (extraDescriptions.length > 0) {
			console.warn(
				`⚠️  The following veterinarian descriptions don't have a corresponding action file:\n` +
				extraDescriptions.map(action => `  - shop.shopItems.lovePointsValue.commentOnFightEffect.${action}`).join('\n') +
				`\n(This may be normal if actions were renamed or removed)`
			);
		}
	});
});
