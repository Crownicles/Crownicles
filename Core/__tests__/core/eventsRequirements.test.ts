import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const EVENTS_DIR = path.resolve(__dirname, '../../resources/events');
const PETS_DIR = path.resolve(__dirname, '../../resources/pets');

type Range = { min?: number; max?: number };

interface OutcomeRequirements {
	level?: Range;
	karma?: Range;
	health?: Range;
	attack?: Range;
	defense?: Range;
	speed?: Range;
	energyPercent?: Range;
	money?: Range;
	cookingLevel?: Range;
	weaponLevel?: Range;
	armorLevel?: Range;
	petRarity?: Range;
	validClassIds?: number[];
	validPetTypeIds?: number[];
	excludedPetTypeIds?: number[];
	petTags?: string[];
	weaponTags?: string[];
	badges?: string[];
	campaignCurrentMissionId?: number;
	materials?: { quantity?: Range };
	enchantment?: object;
}

interface Outcome {
	requirements?: OutcomeRequirements;
	consumeMaterials?: { quantity: number } | { quantity: number }[];
	useBed?: boolean;
}

interface Possibility {
	outcomes?: Record<string, Outcome>;
}

interface Event {
	possibilities?: Record<string, Possibility>;
}

const RANGE_KEYS = ['level', 'karma', 'health', 'attack', 'defense', 'speed', 'energyPercent', 'money', 'cookingLevel', 'weaponLevel', 'armorLevel'] as const;

const PETS: Record<number, { rarity: number; tags: string[] }> = Object.fromEntries(
	fs.readdirSync(PETS_DIR)
		.filter(f => f.endsWith('.json'))
		.map(f => {
			const pet = JSON.parse(fs.readFileSync(path.join(PETS_DIR, f), 'utf-8'));
			return [parseInt(f, 10), { rarity: pet.rarity as number, tags: (pet.tags ?? []) as string[] }];
		})
);

/**
 * A player profile: one value per checked dimension. A pet is a type and a rarity (or none),
 * materials are either none or plenty of everything, and the equipment either has no enchantment or has every one.
 */
type Profile = Record<string, unknown>;

type Dimension = {
	name: string;
	values: unknown[];
	/** Whether the outcome constrains this dimension */
	constrains: (outcome: Outcome) => boolean;
	/** Whether the outcome is possible for this value of the dimension */
	accepts: (outcome: Outcome, value: unknown) => boolean;
};

const isInRange = (range: Range | undefined, value: number): boolean =>
	!range || ((range.min === undefined || value >= range.min) && (range.max === undefined || value <= range.max));

function rangeBoundaries(outcomes: Outcome[], key: typeof RANGE_KEYS[number]): number[] {
	const values = new Set<number>([key === 'karma' ? 0 : 1]);
	for (const outcome of outcomes) {
		const range = outcome.requirements?.[key];
		for (const bound of [range?.min, range?.max]) {
			if (bound !== undefined) {
				[bound - 1, bound, bound + 1].forEach(v => values.add(v));
			}
		}
	}
	// Karma can be negative; a player in an event has at least 1 health point; energy is a percentage
	return [...values].filter(v => key === 'karma' || v >= (key === 'health' ? 1 : 0))
		.filter(v => key !== 'energyPercent' || v <= 100);
}

function buildDimensions(outcomes: Outcome[]): Dimension[] {
	const dimensions: Dimension[] = RANGE_KEYS.map(key => ({
		name: key,
		values: rangeBoundaries(outcomes, key),
		constrains: o => o.requirements?.[key] !== undefined,
		accepts: (o, value) => isInRange(o.requirements?.[key], value as number)
	}));

	const classes = [...new Set(outcomes.flatMap(o => o.requirements?.validClassIds ?? []))];
	dimensions.push({
		name: 'class',
		values: [-1, ...classes],
		constrains: o => o.requirements?.validClassIds !== undefined,
		accepts: (o, value) => !o.requirements?.validClassIds || o.requirements.validClassIds.includes(value as number)
	});

	// Pets listed by id, and every pet carrying a tag an outcome asks for
	const askedTags = new Set(outcomes.flatMap(o => o.requirements?.petTags ?? []));
	const petTypes = [...new Set([
		...outcomes.flatMap(o => [...o.requirements?.validPetTypeIds ?? [], ...o.requirements?.excludedPetTypeIds ?? []]),
		...Object.entries(PETS).filter(([, pet]) => pet.tags.some(tag => askedTags.has(tag)))
			.map(([type]) => parseInt(type, 10))
	])];
	const rarities = new Set<number>();
	for (const o of outcomes) {
		const range = o.requirements?.petRarity;
		for (const bound of [range?.min, range?.max]) {
			if (bound !== undefined) {
				[bound - 1, bound, bound + 1].forEach(r => rarities.add(r));
			}
		}
	}
	type PetProfile = { type: number; rarity: number; tags: string[] } | null;
	const pets: PetProfile[] = [
		null,
		...petTypes.map(type => ({ type, rarity: PETS[type]?.rarity ?? 0, tags: PETS[type]?.tags ?? [] })),
		...[...rarities].filter(r => r >= 1).map(rarity => ({ type: -1, rarity, tags: [] }))
	];
	dimensions.push({
		name: 'pet',
		values: pets,
		constrains: o => o.requirements?.validPetTypeIds !== undefined || o.requirements?.excludedPetTypeIds !== undefined || o.requirements?.petRarity !== undefined || o.requirements?.petTags !== undefined,
		accepts: (o, value) => {
			const pet = value as PetProfile;
			const req = o.requirements;
			if (req?.validPetTypeIds && (!pet || !req.validPetTypeIds.includes(pet.type))) {
				return false;
			}
			if (req?.excludedPetTypeIds && pet && req.excludedPetTypeIds.includes(pet.type)) {
				return false;
			}
			if (req?.petTags && (!pet || !req.petTags.some(tag => pet.tags.includes(tag)))) {
				return false;
			}
			return !req?.petRarity || (pet !== null && isInRange(req.petRarity, pet.rarity));
		}
	});

	dimensions.push({
		name: 'materials',
		values: [0, Number.MAX_SAFE_INTEGER],
		constrains: o => o.requirements?.materials !== undefined || o.consumeMaterials !== undefined,
		accepts: (o, value) => isInRange(o.requirements?.materials?.quantity ?? (o.requirements?.materials ? { min: 1 } : undefined), value as number)
			&& (!o.consumeMaterials || (value as number) >= [o.consumeMaterials].flat().reduce((sum, filter) => sum + filter.quantity, 0))
	});

	// A bed outcome disappears while the bed cooldown runs
	dimensions.push({
		name: 'bedOnCooldown',
		values: [false, true],
		constrains: o => o.useBed === true,
		accepts: (o, value) => !o.useBed || !(value as boolean)
	});

	// Asking for a weapon tag only adds outcomes: a weapon with every asked tag, and a weapon with none, bound the profiles
	dimensions.push({
		name: 'badges',
		values: [false, true],
		constrains: o => o.requirements?.badges !== undefined,
		accepts: (o, value) => !o.requirements?.badges || value as boolean
	});

	dimensions.push({
		name: 'weaponTags',
		values: [false, true],
		constrains: o => o.requirements?.weaponTags !== undefined,
		accepts: (o, value) => !o.requirements?.weaponTags || value as boolean
	});

	dimensions.push({
		name: 'enchantment',
		values: [false, true],
		constrains: o => o.requirements?.enchantment !== undefined,
		accepts: (o, value) => !o.requirements?.enchantment || value as boolean
	});

	dimensions.push({
		name: 'campaign',
		values: [null],
		constrains: o => o.requirements?.campaignCurrentMissionId !== undefined,
		accepts: o => o.requirements?.campaignCurrentMissionId === undefined
	});

	return dimensions.filter(d => outcomes.some(d.constrains) || d.name === 'level');
}

/**
 * Explore the profiles dimension by dimension and return one without any possible outcome, or null.
 * A branch stops as soon as a remaining outcome has no condition on the dimensions left to explore.
 */
function findProfileWithoutOutcome(candidates: Outcome[], dimensions: Dimension[], index: number, profile: Profile): Profile | null {
	if (candidates.length === 0) {
		return profile;
	}
	const remaining = dimensions.slice(index);
	if (candidates.some(o => remaining.every(d => !d.constrains(o)))) {
		return null;
	}
	const dimension = dimensions[index];
	for (const value of dimension.values) {
		const gap = findProfileWithoutOutcome(candidates.filter(o => dimension.accepts(o, value)), dimensions, index + 1, {
			...profile,
			[dimension.name]: value
		});
		if (gap) {
			return gap;
		}
	}
	return null;
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
					const outcomes = Object.values(possibility.outcomes || {});
					if (outcomes.length === 0) {
						return;
					}

					const gap = findProfileWithoutOutcome(outcomes, buildDimensions(outcomes), 0, {});
					expect(gap, `no outcome for the player profile ${JSON.stringify(gap)}`).toBeNull();
				});

				it(`possibility '${possibilityName}' has no impossible outcomes (min > max)`, () => {
					for (const [outcomeId, outcome] of Object.entries(possibility.outcomes || {})) {
						const req = outcome.requirements ?? {};
						for (const key of [...RANGE_KEYS, 'petRarity'] as const) {
							const range = req[key];
							if (range?.min !== undefined && range.max !== undefined && range.min > range.max) {
								throw new Error(`Outcome ${outcomeId} has impossible ${key} requirement: min(${range.min}) > max(${range.max})`);
							}
						}
					}
				});
			}
		});
	}
});
