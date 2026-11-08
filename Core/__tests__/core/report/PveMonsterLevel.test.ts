import {
	describe, expect, it
} from "vitest";
import {
	PVE_BOSS_ROLES, PVEConstants, PveBossRole
} from "../../../../Lib/src/constants/PVEConstants";
import {
	BossLadder, getLowLevelBossTargetLevelRatio, getLowLevelPveMonsterLevel, getPveBossRole
} from "../../../src/core/report/PveMonsterLevel";

const SEEDS = Array.from({ length: 2000 }, (_, seed) => seed);

describe("getPveBossRole", () => {
	it("gives the role of a boss from its location in the island", () => {
		const earlyMaxDepth = PVEConstants.LOW_LEVEL_BOSS_LADDER.EARLY_BOSS_MAX_DEPTH;

		expect(getPveBossRole({
			depth: 1, isFinal: false
		})).toBe(PVE_BOSS_ROLES.EARLY);
		expect(getPveBossRole({
			depth: earlyMaxDepth, isFinal: false
		})).toBe(PVE_BOSS_ROLES.EARLY);
		expect(getPveBossRole({
			depth: earlyMaxDepth + 1, isFinal: false
		})).toBe(PVE_BOSS_ROLES.MIDDLE);
		expect(getPveBossRole({
			depth: earlyMaxDepth, isFinal: true
		})).toBe(PVE_BOSS_ROLES.FINAL);
	});
});

describe("getLowLevelBossTargetLevelRatio", () => {
	it("grows from the lowest player level to the threshold, the lowest level players losing the most", () => {
		for (const role of Object.values(PVE_BOSS_ROLES)) {
			const target = PVEConstants.LOW_LEVEL_BOSS_LADDER.TARGET_LEVEL_RATIO[role];
			const middleLevel = (PVEConstants.MIN_LEVEL + PVEConstants.LOW_LEVEL_PLAYER_THRESHOLD) / 2;

			expect(getLowLevelBossTargetLevelRatio(role, PVEConstants.MIN_LEVEL)).toBeCloseTo(target.AT_MIN_LEVEL);
			expect(getLowLevelBossTargetLevelRatio(role, middleLevel)).toBeCloseTo((target.AT_MIN_LEVEL + target.AT_THRESHOLD) / 2);
			expect(getLowLevelBossTargetLevelRatio(role, PVEConstants.LOW_LEVEL_PLAYER_THRESHOLD)).toBeCloseTo(target.AT_THRESHOLD);
			expect(target.AT_MIN_LEVEL).toBeLessThan(target.AT_THRESHOLD);
		}
	});

	it("makes the bosses of the end of the trip stronger than the first ones", () => {
		for (const playerLevel of [PVEConstants.MIN_LEVEL, 60, 99]) {
			expect(getLowLevelBossTargetLevelRatio(PVE_BOSS_ROLES.EARLY, playerLevel))
				.toBeLessThan(getLowLevelBossTargetLevelRatio(PVE_BOSS_ROLES.MIDDLE, playerLevel));
			expect(getLowLevelBossTargetLevelRatio(PVE_BOSS_ROLES.MIDDLE, playerLevel))
				.toBeLessThan(getLowLevelBossTargetLevelRatio(PVE_BOSS_ROLES.FINAL, playerLevel));
		}
	});
});

describe("getLowLevelPveMonsterLevel", () => {
	const ladderConstants = PVEConstants.LOW_LEVEL_BOSS_LADDER;
	const playerLevel = 70;
	const role = PVE_BOSS_ROLES.FINAL;
	const targetLevel = playerLevel * (1 + getLowLevelBossTargetLevelRatio(role, playerLevel));
	const sum = (levels: number[]): number => levels.reduce((total, level) => total + level, 0);

	function ladderLevels(ladder: BossLadder, ladderRole: PveBossRole = role): number[] {
		return SEEDS.map(seed => getLowLevelPveMonsterLevel({
			ladder, playerLevel, seed, role: ladderRole
		}));
	}

	function victory(strongestVictoryLevel: number): BossLadder {
		return {
			strongestVictoryLevel,
			lastFight: {
				level: strongestVictoryLevel, isDefeat: false, playerLevel
			}
		};
	}

	function defeat(level: number, defeatPlayerLevel: number | null): BossLadder {
		return {
			strongestVictoryLevel: level - 5,
			lastFight: {
				level, isDefeat: true, playerLevel: defeatPlayerLevel
			}
		};
	}

	it("draws a boss met for the first time around its target level", () => {
		for (const level of ladderLevels({
			strongestVictoryLevel: null, lastFight: null
		})) {
			expect(level).toBeGreaterThanOrEqual(Math.floor(targetLevel * (1 - ladderConstants.FIRST_ENCOUNTER_VARIATION)));
			expect(level).toBeLessThanOrEqual(Math.ceil(targetLevel * (1 + ladderConstants.FIRST_ENCOUNTER_VARIATION)));
		}
	});

	it("brings a boss far below its target much closer to it after a victory, so that it keeps up with players who level up fast", () => {
		// A high player level, so that the safety around the player level does not move the bosses
		const highPlayerLevel = 95;
		const highTargetLevel = highPlayerLevel * (1 + getLowLevelBossTargetLevelRatio(role, highPlayerLevel));
		const strongestVictoryLevel = highPlayerLevel - PVEConstants.LOW_LEVEL_BOSS_LADDER.MAX_LEVELS_BELOW_PLAYER + 1;
		const levels = SEEDS.map(seed => getLowLevelPveMonsterLevel({
			ladder: victory(strongestVictoryLevel), playerLevel: highPlayerLevel, seed, role
		}));
		const minCatchUpLevel = strongestVictoryLevel
			+ (highTargetLevel - strongestVictoryLevel) * ladderConstants.CATCH_UP_GAP_SHARE * (1 - ladderConstants.CATCH_UP_VARIATION);
		const catchingUpShare = levels.filter(level => level >= Math.floor(minCatchUpLevel)).length / levels.length;

		expect(catchingUpShare).toBeCloseTo(1 - ladderConstants.WEAKENED.PROBABILITY, 1);
	});

	it("only grows a bit after a victory once the boss reached its target, sometimes coming back weaker", () => {
		const strongestVictoryLevel = Math.round(targetLevel) + 1;
		const levels = ladderLevels(victory(strongestVictoryLevel));
		const climbRange = ladderConstants.PACE[role].CLIMB_AFTER_VICTORY;
		const weakenedShare = levels.filter(level => level < strongestVictoryLevel).length / levels.length;

		for (const level of levels) {
			expect(level).toBeGreaterThanOrEqual(Math.floor(strongestVictoryLevel * (1 + ladderConstants.WEAKENED.MIN)));
			expect(level).toBeLessThanOrEqual(Math.ceil(strongestVictoryLevel * (1 + climbRange.MAX)));
		}
		expect(weakenedShare).toBeCloseTo(ladderConstants.WEAKENED.PROBABILITY, 1);
	});

	it("keeps growing for a player who keeps beating it, whatever its level", () => {
		const strongestVictoryLevel = playerLevel + 30;

		expect(Math.max(...ladderLevels(victory(strongestVictoryLevel)))).toBeGreaterThan(strongestVictoryLevel);
	});

	it("grows slower and drops more for the first bosses of the island than for the final ones, so that the players are seldom kicked out early", () => {
		const strongestVictoryLevel = Math.round(targetLevel) + 1;
		const pace = ladderConstants.PACE;

		expect(sum(ladderLevels(victory(strongestVictoryLevel), PVE_BOSS_ROLES.EARLY)))
			.toBeLessThan(sum(ladderLevels(victory(strongestVictoryLevel), PVE_BOSS_ROLES.FINAL)));
		expect(ladderLevels(defeat(60, playerLevel), PVE_BOSS_ROLES.EARLY)[0])
			.toBeLessThan(ladderLevels(defeat(60, playerLevel), PVE_BOSS_ROLES.FINAL)[0]);
		expect(pace[PVE_BOSS_ROLES.EARLY].CLIMB_AFTER_VICTORY.MAX).toBeLessThan(pace[PVE_BOSS_ROLES.MIDDLE].CLIMB_AFTER_VICTORY.MAX);
		expect(pace[PVE_BOSS_ROLES.EARLY].DROP_AFTER_DEFEAT).toBeGreaterThan(pace[PVE_BOSS_ROLES.MIDDLE].DROP_AFTER_DEFEAT);
		expect(pace[PVE_BOSS_ROLES.MIDDLE].DROP_AFTER_DEFEAT).toBeGreaterThan(pace[PVE_BOSS_ROLES.FINAL].DROP_AFTER_DEFEAT);
	});

	it("brings a boss a bit weaker than the one who won after a defeat", () => {
		const drop = ladderConstants.PACE[role].DROP_AFTER_DEFEAT;

		expect(new Set(ladderLevels(defeat(60, playerLevel)))).toEqual(new Set([Math.round(60 * (1 - drop))]));
	});

	it("brings a boss stronger after a defeat when the player levelled up since, as the player progressed", () => {
		const drop = ladderConstants.PACE[role].DROP_AFTER_DEFEAT;

		expect(ladderLevels(defeat(60, 60))[0]).toBe(Math.round(60 * playerLevel / 60 * (1 - drop)));
		expect(ladderLevels(defeat(60, 60))[0]).toBeGreaterThan(ladderLevels(defeat(60, playerLevel))[0]);
	});

	it("considers the player did not progress since a defeat logged without the player level", () => {
		expect(ladderLevels(defeat(60, null))).toEqual(ladderLevels(defeat(60, playerLevel)));
	});

	it("brings stronger bosses to a player who killed stronger ones", () => {
		expect(sum(ladderLevels(victory(45)))).toBeGreaterThan(sum(ladderLevels(victory(35))));
	});

	it("keeps the first bosses of the island weaker than the final ones", () => {
		const ladder: BossLadder = {
			strongestVictoryLevel: null, lastFight: null
		};

		expect(sum(ladderLevels(ladder, PVE_BOSS_ROLES.EARLY))).toBeLessThan(sum(ladderLevels(ladder, PVE_BOSS_ROLES.FINAL)));
	});

	it("keeps the boss close to the player level, whatever its ladder (Yuki-Onna level 4 for a level 67 player)", () => {
		for (const level of ladderLevels(victory(4))) {
			expect(level).toBeGreaterThanOrEqual(playerLevel - PVEConstants.LOW_LEVEL_BOSS_LADDER.MAX_LEVELS_BELOW_PLAYER);
		}
	});

	it("draws the same level for the same seed", () => {
		expect(ladderLevels(victory(50))).toEqual(ladderLevels(victory(50)));
	});
});
