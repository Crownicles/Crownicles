import {
	describe, expect, it
} from "vitest";
import { Sequelize } from "sequelize";
import { initModel as initPlayer } from "../../../../src/core/database/game/models/Player";
import {
	completeKingGuardLibrary, generateKingGuardLibrary, KING_GUARD_PROFILE_SETTINGS
} from "../../../../src/core/fights/kingGuards/library/KingGuardLibraryGenerator";
import {
	alignKingGuardsRatings, anchorKingGuardsRatings, fitKingGuardsRatings, KING_GUARD_CALIBRATION
} from "../../../../src/core/fights/kingGuards/library/KingGuardLibraryCalibration";
import {
	KING_GUARD_PROFILES, KingGuardData
} from "../../../../src/data/KingGuard";
import { ItemConstants } from "../../../../../Lib/src/constants/ItemConstants";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";

initPlayer(new Sequelize({
	dialect: "mariadb", logging: false
}));

describe("generateKingGuardLibrary", () => {
	const library = generateKingGuardLibrary(1);

	it("gives the same library for the same seed", () => {
		expect(generateKingGuardLibrary(1)).toEqual(library);
		expect(generateKingGuardLibrary(2)).not.toEqual(library);
	});

	it("fully upgrades and enchants the optimized guards and gives them a fight potion and a pet", () => {
		const optimized = library.filter(guard => guard.profile === KING_GUARD_PROFILES.OPTIMIZED);

		expect(optimized).toHaveLength((FightConstants.KING_GUARD.LIBRARY.MAX_LEVEL - FightConstants.KING_GUARD.LIBRARY.MIN_LEVEL + 1)
			* KING_GUARD_PROFILE_SETTINGS[KING_GUARD_PROFILES.OPTIMIZED].count);
		for (const guard of optimized) {
			expect(guard.weapon.level).toBe(ItemConstants.MAX_UPGRADE_LEVEL);
			expect(guard.armor.level).toBe(ItemConstants.MAX_UPGRADE_LEVEL);
			expect(guard.weapon.enchantmentId).not.toBeNull();
			expect(guard.armor.enchantmentId).not.toBeNull();
			expect(guard.potionId).not.toBe(0);
			expect(guard.pet).not.toBeNull();
		}
	});

	it("leaves the poorly equipped guards without fight potion and with barely upgraded items", () => {
		for (const guard of library.filter(guard => guard.profile === KING_GUARD_PROFILES.POORLY_EQUIPPED)) {
			expect(guard.potionId).toBe(0);
			expect(guard.weapon.level).toBeLessThanOrEqual(2);
			expect(guard.armor.level).toBeLessThanOrEqual(2);
		}
	});
});

describe("completeKingGuardLibrary", () => {
	const generated = generateKingGuardLibrary(1);
	const {
		MIN_LEVEL, MAX_LEVEL, GUARDS_PER_LEVEL
	} = FightConstants.KING_GUARD.LIBRARY;

	it("generates the whole library when it is empty, with ids following the levels", () => {
		expect(completeKingGuardLibrary([], generated)).toEqual(generated);
	});

	it("adds nothing to a complete library", () => {
		expect(completeKingGuardLibrary(generated, generated)).toEqual([]);
	});

	it("only completes the levels missing guards, with ids after the highest one, never touching the guards of the library", () => {
		const library = generated.filter(guard => guard.level !== MIN_LEVEL || guard.id <= GUARDS_PER_LEVEL - 3);
		const highestId = (MAX_LEVEL - MIN_LEVEL + 1) * GUARDS_PER_LEVEL;

		const newGuards = completeKingGuardLibrary(library, generated);

		expect(newGuards.map(guard => [guard.id, guard.level])).toEqual([[highestId + 1, MIN_LEVEL], [highestId + 2, MIN_LEVEL], [highestId + 3, MIN_LEVEL]]);
		expect(library.every(guard => generated.some(generatedGuard => generatedGuard === guard))).toBe(true);
	});
});

describe("King guards calibration", () => {
	const guards = [80, 80, 81].map((level, index) => ({
		id: index + 1,
		level
	}) as KingGuardData);
	const priorRatings = new Map(guards.map(guard => [guard.id, 1000]));

	it("rates higher the guards that win more, whatever their prior rating", () => {
		const fights = Array.from({ length: 30 }, (_, index) => [
			{
				firstId: 1, secondId: 2, firstScore: index % 3 === 0 ? 0 : 1
			},
			{
				firstId: 3, secondId: 1, firstScore: 1
			}
		]).flat();

		const ratings = fitKingGuardsRatings(guards, fights, priorRatings);

		expect(ratings.get(3)!).toBeGreaterThan(ratings.get(1)!);
		expect(ratings.get(1)!).toBeGreaterThan(ratings.get(2)!);
	});

	it("keeps a finite rating for a guard that won all its fights", () => {
		const ratings = fitKingGuardsRatings(guards, Array.from({ length: 50 }, () => ({
			firstId: 1, secondId: 2, firstScore: 1
		})), priorRatings);

		expect(Number.isFinite(ratings.get(1)!)).toBe(true);
	});

	it("anchors the median rating of the guards of the lowest level of the library", () => {
		const anchored = anchorKingGuardsRatings(guards, new Map([[1, 400], [2, 600], [3, 900]]));

		expect(anchored.get(1)! + anchored.get(2)!).toBe(2 * KING_GUARD_CALIBRATION.ANCHOR_RATING);
		expect(anchored.get(3)! - anchored.get(2)!).toBe(300);
	});

	it("puts the ratings of new guards on the scale of the guards already in the library, which keep their own rating", () => {
		const library = [
			{
				...guards[0], initialGlory: 1_100
			},
			{
				...guards[1], initialGlory: 1_300
			}
		];

		const aligned = alignKingGuardsRatings(library, new Map([[1, 500], [2, 720], [3, 900]]));

		expect(aligned.get(1)).toBe(1_100);
		expect(aligned.get(2)).toBe(1_300);

		// The tournament placed the new guard 180 to 400 points above the others: the median shift is 590
		expect(aligned.get(3)).toBe(900 + 590);
	});
});
