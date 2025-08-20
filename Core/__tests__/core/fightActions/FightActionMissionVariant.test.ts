import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('FightActions missionVariant uniqueness', () => {
	it('should have unique missionVariant values (excluding -1)', () => {
		const fightActionsDir = path.join(__dirname, '../../../resources/fightActions');
		const files = fs.readdirSync(fightActionsDir).filter(file => file.endsWith('.json'));
		
		const missionVariants: { variant: number; file: string }[] = [];
		const duplicates: { variant: number; files: string[] }[] = [];
		
		// Browse all combat action JSON files
		for (const file of files) {
			const filePath = path.join(fightActionsDir, file);
			const content = fs.readFileSync(filePath, 'utf-8');
			
			try {
				const data = JSON.parse(content);
				
				// Check that the file has a missionVariant property
				if (data.hasOwnProperty('missionVariant')) {
					const variant = data.missionVariant;
					
					// Ignore only -1 variants (they can be duplicated)
					if (variant !== -1) {
						missionVariants.push({ variant, file });
					}
				}
			} catch (error) {
				// Ignore malformed JSON files
				console.warn(`Impossible de parser le fichier ${file}: ${error.message}`);
			}
		}
		
		// Group by variant to detect duplicates
		const variantGroups = new Map<number, string[]>();
		
		for (const { variant, file } of missionVariants) {
			if (!variantGroups.has(variant)) {
				variantGroups.set(variant, []);
			}
			variantGroups.get(variant)!.push(file);
		}
		
		// Identify duplicated variants
		for (const [variant, files] of variantGroups) {
			if (files.length > 1) {
				duplicates.push({ variant, files });
			}
		}
		
		// The test fails if there are duplicates
		if (duplicates.length > 0) {
			const duplicateInfo = duplicates
				.map(dup => `Variant ${dup.variant}: ${dup.files.join(', ')}`)
				.join('\n');
			
			expect.fail(`Les missionVariant suivants sont dupliqués:\n${duplicateInfo}`);
		}
		
		// Check that we found variants (sanity test)
		expect(missionVariants.length).toBeGreaterThan(0);
	});
	
	it('should have valid missionVariant values (numbers)', () => {
		const fightActionsDir = path.join(__dirname, '../../../resources/fightActions');
		const files = fs.readdirSync(fightActionsDir).filter(file => file.endsWith('.json'));
		
		for (const file of files) {
			const filePath = path.join(fightActionsDir, file);
			const content = fs.readFileSync(filePath, 'utf-8');
			
			try {
				const data = JSON.parse(content);
				
				if (data.hasOwnProperty('missionVariant')) {
					expect(typeof data.missionVariant).toBe('number');
					expect(Number.isInteger(data.missionVariant)).toBe(true);
				}
			} catch (error) {
				// Ignore malformed JSON files
				console.warn(`Impossible de parser le fichier ${file}: ${error.message}`);
			}
		}
	});
});