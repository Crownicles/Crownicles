import {
	afterEach, describe, expect, it, vi
} from "vitest";
import { generateExpeditionChoices } from "../../../src/core/expeditions/ExpeditionService";
import { MapLinkDataController } from "../../../src/data/MapLink";
import { ExpeditionConstants } from "../../../../Lib/src/constants/ExpeditionConstants";
import { ExpeditionData } from "../../../../Lib/src/packets/commands/CommandPetExpeditionPacket";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";

const ETENDUE = 12;
const LAKE_MIRAGE = 14;
const CRAB_RIVER = 25;
const GENERATIONS_PER_CASE = 20;

// Enough draws for the independence of twin expeditions to show up with an overwhelming probability
const TWIN_GENERATIONS = 100;
const TRIP_START = 0.2;
const TRIP_END = 0.8;
const ARRIVED = 1;

const {
	PLAINS, COAST, SWAMP
} = ExpeditionConstants.EXPEDITION_LOCATION_TYPES;

/**
 * Generate the expeditions proposed to a player at the given progress of the map link between two locations
 */
function expeditionChoices(startMap: number, endMap: number, travelProgress: number): ExpeditionData[] {
	const mapLinkId = MapLinkDataController.instance.getLinkByLocations(startMap, endMap)!.id;
	return generateExpeditionChoices({
		mapLinkId, travelProgress
	}, true);
}

/**
 * Location and biome of the local expeditions, in proposal order
 */
function localOffers(expeditions: ExpeditionData[]): string[] {
	return expeditions
		.filter(expedition => !expedition.isDistantExpedition)
		.map(expedition => `${expedition.mapLocationId}:${expedition.locationType}`);
}

/**
 * Check that the expeditions at the given positions of every generation are short ones and the others medium ones.
 * The medium range overlaps the short one, so a medium draw is only told apart once it exceeds the short range.
 */
function expectDurations(generations: ExpeditionData[][], shortIndexes: number[], mediumIndexes: number[]): void {
	const shorts = generations.flatMap(expeditions => shortIndexes.map(index => expeditions[index].durationMinutes));
	const mediums = generations.flatMap(expeditions => mediumIndexes.map(index => expeditions[index].durationMinutes));

	expect(shorts.every(duration => duration >= ExpeditionConstants.DURATION_RANGES.SHORT.MIN
		&& duration <= ExpeditionConstants.DURATION_RANGES.SHORT.MAX)).toBe(true);
	expect(mediums.every(duration => duration >= ExpeditionConstants.DURATION_RANGES.MEDIUM.MIN
		&& duration <= ExpeditionConstants.DURATION_RANGES.MEDIUM.MAX)).toBe(true);
	expect(mediums.some(duration => duration > ExpeditionConstants.DURATION_RANGES.SHORT.MAX)).toBe(true);
}

describe("expedition choices", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("offers short expeditions at the departure at the start of the trip, then one medium expedition per biome of the destination", () => {
		const generations = Array.from({ length: GENERATIONS_PER_CASE }, () => expeditionChoices(ETENDUE, LAKE_MIRAGE, TRIP_START));

		for (const expeditions of generations) {
			expect(localOffers(expeditions)).toEqual([`${ETENDUE}:${PLAINS}`, `${LAKE_MIRAGE}:${COAST}`, `${LAKE_MIRAGE}:${SWAMP}`]);
			expect(expeditions).toHaveLength(4);
			expect(expeditions[3].isDistantExpedition).toBe(true);
		}
		expectDurations(generations, [0], [1, 2]);
	});

	it("offers the short expeditions at the destination once the player is closer to it, and when arrived", () => {
		for (const travelProgress of [TRIP_END, ARRIVED]) {
			const generations = Array.from({ length: GENERATIONS_PER_CASE }, () => expeditionChoices(ETENDUE, LAKE_MIRAGE, travelProgress));

			for (const expeditions of generations) {
				expect(localOffers(expeditions)).toEqual([`${LAKE_MIRAGE}:${COAST}`, `${LAKE_MIRAGE}:${SWAMP}`, `${ETENDUE}:${PLAINS}`]);
			}
			expectDurations(generations, [0, 1], [2]);
		}
	});

	it("draws the expeditions of the biomes of a location independently", () => {
		const twins = Array.from({ length: TWIN_GENERATIONS }, () => expeditionChoices(ETENDUE, LAKE_MIRAGE, ARRIVED).slice(0, 2));

		for (const [coast, swamp] of twins) {
			expect(coast.locationType).toBe(COAST);
			expect(swamp.locationType).toBe(SWAMP);
			expect(swamp.id).not.toBe(coast.id);
		}
		expect(twins.some(([coast, swamp]) => swamp.durationMinutes !== coast.durationMinutes)).toBe(true);
		expect(twins.some(([coast, swamp]) => swamp.difficulty !== coast.difficulty)).toBe(true);
		expect(twins.some(([coast, swamp]) => swamp.wealthRate !== coast.wealthRate)).toBe(true);

		// With a shared risk roll the swamp, a more dangerous terrain, would never be safer than the coast
		expect(twins.some(([coast, swamp]) => swamp.riskRate < coast.riskRate)).toBe(true);
	});

	it("offers every biome of both ends when they are both mixed", () => {
		expect(localOffers(expeditionChoices(LAKE_MIRAGE, CRAB_RIVER, TRIP_START)))
			.toEqual([`${LAKE_MIRAGE}:${COAST}`, `${LAKE_MIRAGE}:${SWAMP}`, `${CRAB_RIVER}:${COAST}`, `${CRAB_RIVER}:${SWAMP}`]);
	});

	it("can give the expedition bonus to any of the proposed expeditions", () => {
		vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(true);
		vi.spyOn(RandomUtils, "randInt").mockImplementation((_min: number, max: number) => max - 1);
		const mapLinkId = MapLinkDataController.instance.getLinkByLocations(ETENDUE, LAKE_MIRAGE)!.id;

		const expeditions = generateExpeditionChoices({
			mapLinkId, travelProgress: TRIP_START
		}, false);

		expect(expeditions.map(expedition => expedition.hasCloneTalismanBonus === true)).toEqual([false, false, false, true]);
	});
});
