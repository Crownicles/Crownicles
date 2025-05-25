import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const EVENTS_DIR = path.resolve(__dirname, '../../resources/events');

interface OutcomeRequirements {
	level?: {
		min?: number;
		max?: number;
	};
	health?: {
		min?: number;
		max?: number;
	};
	defense?: {
		min?: number;
		max?: number;
	};
	attack?: {
		min?: number;
		max?: number;
	};
	speed?: {
		min?: number;
		max?: number;
	};
	campaignCurrentMissionId?: number;
	petTypeId?: number;
	petRarity?: {
		min?: number;
		max?: number;
	};
	validClassIds?: number[];
}

interface Outcome {
	requirements?: OutcomeRequirements;
}

interface Possibility {
	outcomes?: Record<string, Outcome>;
}

interface Event {
	possibilities?: Record<string, Possibility>;
}

function isRangeValid(
	range: { min?: number; max?: number } | undefined,
	value: number
): boolean {
	if (!range) return true;
	if (range.min !== undefined && value < range.min) return false;
	if (range.max !== undefined && value > range.max) return false;
	return true;
}

function isOutcomeValidForStats(
	requirements: OutcomeRequirements | undefined,
	stats: {
		level: number;
		health: number;
		defense: number;
		attack: number;
		speed: number;
		class: number;
	}
): boolean {
	if (!requirements) return true;

	return (
		isRangeValid(requirements.level, stats.level) &&
		isRangeValid(requirements.health, stats.health) &&
		isRangeValid(requirements.defense, stats.defense) &&
		isRangeValid(requirements.attack, stats.attack) &&
		isRangeValid(requirements.speed, stats.speed) &&
		(requirements.validClassIds === undefined || requirements.validClassIds.includes(stats.class))
	);
}

function getAllLevelBoundaries(outcomes: Record<string, Outcome>): number[] {
	const boundaries = new Set<number>([0, 1]); // Always include level 0 and 1

	for (const outcome of Object.values(outcomes)) {
		if (outcome.requirements?.level?.min !== undefined) {
			boundaries.add(outcome.requirements.level.min);
			boundaries.add(outcome.requirements.level.min - 1); // Just below the min
		}
		if (outcome.requirements?.level?.max !== undefined) {
			boundaries.add(outcome.requirements.level.max);
			boundaries.add(outcome.requirements.level.max + 1); // Just above the max
		}
	}

	return Array.from(boundaries).filter(level => level >= 0).sort((a, b) => a - b);
}

function getAllStatBoundaries(outcomes: Record<string, Outcome>, statKey: keyof OutcomeRequirements): number[] {
	const boundaries = new Set<number>([0, 1, 50, 100]); // Common test values

	for (const outcome of Object.values(outcomes)) {
		const stat = outcome.requirements?.[statKey];
		if (stat && typeof stat === 'object' && 'min' in stat) {
			if (stat.min !== undefined) {
				boundaries.add(stat.min);
				boundaries.add(stat.min - 1);
			}
			if (stat.max !== undefined) {
				boundaries.add(stat.max);
				boundaries.add(stat.max + 1);
			}
		}
	}

	return Array.from(boundaries).filter(val => val >= 0).sort((a, b) => a - b);
}

function getAllClasses(outcomes: Record<string, Outcome>): number[] {
	const classes = new Set<number>([1, 2, 3, 4, 5]); // Assume common class IDs

	for (const outcome of Object.values(outcomes)) {
		if (outcome.requirements?.validClassIds) {
			outcome.requirements.validClassIds.forEach(classId => classes.add(classId));
		}
	}

	return Array.from(classes);
}

describe('Event requirements validation', () => {
	const files = fs.readdirSync(EVENTS_DIR).filter(f => f.endsWith('.json'));

	for (const file of files) {
		const filePath = path.join(EVENTS_DIR, file);
		const event: Event = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
		const possibilities = event.possibilities || {};

		describe(`${file}`, () => {
			for (const [possibilityName, possibility] of Object.entries(possibilities)) {
				it(`possibility '${possibilityName}' always has at least one accessible outcome`, () => {
					const outcomes = possibility.outcomes || {};

					if (Object.keys(outcomes).length === 0) {
						// No outcomes defined - this might be valid for some events
						return;
					}

					// Test various combinations of stats
					const levelBoundaries = getAllLevelBoundaries(outcomes);
					const healthBoundaries = getAllStatBoundaries(outcomes, 'health');
					const defenseBoundaries = getAllStatBoundaries(outcomes, 'defense');
					const attackBoundaries = getAllStatBoundaries(outcomes, 'attack');
					const speedBoundaries = getAllStatBoundaries(outcomes, 'speed');
					const classes = getAllClasses(outcomes);

					// Test a reasonable subset of combinations (not all to avoid performance issues)
					const testCombinations = [];

					// Test key level boundaries with average stats
					for (const level of levelBoundaries.slice(0, 10)) { // Limit to first 10 levels
						for (const playerClass of classes.slice(0, 3)) { // Test first 3 classes
							testCombinations.push({
								level,
								health: 100,
								defense: 50,
								attack: 50,
								speed: 50,
								class: playerClass
							});
						}
					}

					// Test boundary cases for other stats with reasonable levels
					const testLevels = [1, 50, 100].filter(l => l <= Math.max(...levelBoundaries));
					for (const level of testLevels) {
						for (const health of healthBoundaries.slice(0, 5)) {
							testCombinations.push({
								level,
								health,
								defense: 50,
								attack: 50,
								speed: 50,
								class: 1
							});
						}
					}

					let hasFailure = false;
					const failures: string[] = [];

					for (const stats of testCombinations) {
						const validOutcomes = Object.entries(outcomes).filter(([_, outcome]) =>
							isOutcomeValidForStats(outcome.requirements, stats)
						);

						if (validOutcomes.length === 0) {
							hasFailure = true;
							failures.push(
								`No valid outcomes for stats: level=${stats.level}, health=${stats.health}, ` +
								`defense=${stats.defense}, attack=${stats.attack}, speed=${stats.speed}, class=${stats.class}`
							);
						}
					}

					if (hasFailure) {
						console.error(`\nFailures in ${file} - ${possibilityName}:`);
						failures.slice(0, 5).forEach(failure => console.error(`  ${failure}`));
						if (failures.length > 5) {
							console.error(`  ... and ${failures.length - 5} more failures`);
						}

						console.error('\nAvailable outcomes:');
						Object.entries(outcomes).forEach(([id, outcome]) => {
							console.error(`  ${id}: ${JSON.stringify(outcome.requirements || {})}`);
						});
					}

					expect(hasFailure).toBe(false);
				});

				it(`possibility '${possibilityName}' has no impossible outcomes (min > max)`, () => {
					const outcomes = possibility.outcomes || {};

					for (const [outcomeId, outcome] of Object.entries(outcomes)) {
						if (outcome.requirements) {
							const req = outcome.requirements;

							// Check each stat range
							['level', 'health', 'defense', 'attack', 'speed', 'petRarity'].forEach(statKey => {
								const stat = req[statKey as keyof OutcomeRequirements];
								if (stat && typeof stat === 'object' && 'min' in stat && 'max' in stat) {
									const { min, max } = stat;
									if (min !== undefined && max !== undefined && min > max) {
										throw new Error(
											`Outcome ${outcomeId} has impossible ${statKey} requirement: min(${min}) > max(${max})`
										);
									}
								}
							});
						}
					}
				});
			}
		});
	}
});