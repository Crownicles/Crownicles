import {
	afterEach, describe, expect, it, vi
} from "vitest";
import {
	FightAction, FightActionDataController, FightActionFunc
} from "../../../../../src/data/FightAction";
import { FightConstants } from "../../../../../../Lib/src/constants/FightConstants";
import { FightActionStatus } from "../../../../../../Lib/src/types/FightActionStatus";
import { FightActionResult } from "../../../../../../Lib/src/types/FightActionResult";
import type { FightController } from "../../../../../src/core/fights/FightController";
import { FightAlterations } from "../../../../../src/core/fights/actions/FightAlterations";
import {
	fixFightRandomness, FightRolls
} from "../FightRandomness";
import {
	TestFighter, TestFighterStats
} from "./TestFighter";
import benediction from "../../../../../src/core/fights/actions/interfaces/players/benediction";
import boomerangAttack from "../../../../../src/core/fights/actions/interfaces/players/boomerangAttack";
import canonAttack from "../../../../../src/core/fights/actions/interfaces/players/canonAttack";
import chargeChargingAttack from "../../../../../src/core/fights/actions/interfaces/players/chargeChargingAttack";
import chargeUltimateAttack from "../../../../../src/core/fights/actions/interfaces/players/chargeUltimateAttack";
import chargingAttack from "../../../../../src/core/fights/actions/interfaces/players/chargingAttack";
import concentration from "../../../../../src/core/fights/actions/interfaces/players/concentration";
import cursedAttack from "../../../../../src/core/fights/actions/interfaces/players/cursedAttack";
import defenseBuff from "../../../../../src/core/fights/actions/interfaces/players/defenseBuff";
import divineAttack from "../../../../../src/core/fights/actions/interfaces/players/divineAttack";
import fireAttack from "../../../../../src/core/fights/actions/interfaces/players/fireAttack";
import heavyAttack from "../../../../../src/core/fights/actions/interfaces/players/heavyAttack";
import intenseAttack from "../../../../../src/core/fights/actions/interfaces/players/intenseAttack";
import none from "../../../../../src/core/fights/actions/interfaces/players/none";
import piercingAttack from "../../../../../src/core/fights/actions/interfaces/players/piercingAttack";
import poisonousAttack from "../../../../../src/core/fights/actions/interfaces/players/poisonousAttack";
import powerfulAttack from "../../../../../src/core/fights/actions/interfaces/players/powerfulAttack";
import protection from "../../../../../src/core/fights/actions/interfaces/players/protection";
import quickAttack from "../../../../../src/core/fights/actions/interfaces/players/quickAttack";
import resting from "../../../../../src/core/fights/actions/interfaces/players/resting";
import sabotageAttack from "../../../../../src/core/fights/actions/interfaces/players/sabotageAttack";
import shieldAttack from "../../../../../src/core/fights/actions/interfaces/players/shieldAttack";
import simpleAttack from "../../../../../src/core/fights/actions/interfaces/players/simpleAttack";
import ultimateAttack from "../../../../../src/core/fights/actions/interfaces/players/ultimateAttack";
import darkAttack from "../../../../../src/core/fights/actions/interfaces/players/darkAttack";
import energeticAttack from "../../../../../src/core/fights/actions/interfaces/players/energeticAttack";
import breathTakingAttack from "../../../../../src/core/fights/actions/interfaces/players/breathTakingAttack";
import ramAttack from "../../../../../src/core/fights/actions/interfaces/players/ramAttack";
import { MonsterFighter } from "../../../../../src/core/fights/fighter/MonsterFighter";
import { RandomUtils } from "../../../../../../Lib/src/utils/RandomUtils";
import {
	FightActionBuff, FightStatBuffed
} from "../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../Lib/src/types/FightStatModifierOperation";
import {
	fightAlterationById, monsterById, required
} from "../../FightTestData";

const PLAYER_ACTIONS = FightConstants.FIGHT_ACTIONS.PLAYER;
// These actions never read the fight controller: they are played outside of any fight
const NO_FIGHT = null as unknown as FightController;

// A well geared fighter and a weaker one of the same level: every stat of the formula weighs on the damage
const STRONG: TestFighterStats = {
	level: 50, attack: 400, defense: 300, speed: 250
};
const WEAK: TestFighterStats = {
	level: 50, attack: 150, defense: 100, speed: 80
};

function action(id: string): FightAction {
	const fightAction = FightActionDataController.instance.getById(id);
	if (!fightAction) {
		throw new Error(`Unknown fight action ${id}`);
	}
	return fightAction;
}

type Duel = {
	sender: TestFighter;
	receiver: TestFighter;
	result: FightActionResult;
};

type DuelSetup = {
	sender?: TestFighterStats;
	receiver?: TestFighterStats;
	senderHistory?: string[];
	receiverHistory?: string[];
	turn?: number;
	rolls?: FightRolls;
};

/**
 * Play an action of a player between two fighters, the randomness being fixed by the rolls
 */
function duel(use: FightActionFunc, actionId: string, setup: DuelSetup = {}): Duel {
	fixFightRandomness(setup.rolls);
	const sender = new TestFighter(setup.sender ?? STRONG);
	const receiver = new TestFighter(setup.receiver ?? WEAK);
	sender.fightActionsHistory = (setup.senderHistory ?? []).map(action);
	receiver.fightActionsHistory = (setup.receiverHistory ?? []).map(action);
	const result = use(sender, receiver, action(actionId), setup.turn ?? 5, NO_FIGHT);
	return {
		sender, receiver, result
	};
}

function buffOf(selfTarget: boolean, stat: FightStatBuffed, value: number, operator = FightStatModifierOperation.MULTIPLIER): FightActionBuff[] {
	return [{
		selfTarget, stat, operator, value
	}];
}

function damagesOf(use: FightActionFunc, actionId: string, setup: DuelSetup = {}): number | undefined {
	return duel(use, actionId, setup).result.damages;
}

function statusAtRoll(use: FightActionFunc, actionId: string, roll: number, setup: DuelSetup = {}): FightActionStatus {
	return duel(use, actionId, {
		...setup, rolls: {
			...setup.rolls, secondaryEffectRoll: roll
		}
	}).result.attackStatus;
}

describe("player attacks", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("damage balance", () => {
		const DAMAGE_ACTIONS: [string, FightActionFunc, [number, number]][] = [
			[PLAYER_ACTIONS.SIMPLE_ATTACK, simpleAttack, [175, 88]],
			[PLAYER_ACTIONS.QUICK_ATTACK, quickAttack, [173, 71]],
			[PLAYER_ACTIONS.PIERCING_ATTACK, piercingAttack, [169, 105]],
			[PLAYER_ACTIONS.SHIELD_ATTACK, shieldAttack, [228, 102]],
			[PLAYER_ACTIONS.CHARGING_ATTACK, chargingAttack, [299, 155]],
			[PLAYER_ACTIONS.CHARGE_CHARGING_ATTACK, chargeChargingAttack, [105, 47]],
			[PLAYER_ACTIONS.CURSED_ATTACK, cursedAttack, [151, 95]],
			[PLAYER_ACTIONS.POISONOUS_ATTACK, poisonousAttack, [104, 59]],
			[PLAYER_ACTIONS.BOOMERANG_ATTACK, boomerangAttack, [181, 93]],
			[PLAYER_ACTIONS.FIRE_ATTACK, fireAttack, [178, 141]],
			[PLAYER_ACTIONS.HEAVY_ATTACK, heavyAttack, [158, 89]],
			[PLAYER_ACTIONS.INTENSE_ATTACK, intenseAttack, [225, 127]],
			[PLAYER_ACTIONS.POWERFUL_ATTACK, powerfulAttack, [316, 155]],
			[PLAYER_ACTIONS.ULTIMATE_ATTACK, ultimateAttack, [509, 336]],
			[PLAYER_ACTIONS.CANON_ATTACK, canonAttack, [251, 92]],
			[PLAYER_ACTIONS.DIVINE_ATTACK, divineAttack, [424, 221]],
			[PLAYER_ACTIONS.BENEDICTION, benediction, [311, 142]],
			[PLAYER_ACTIONS.SABOTAGE_ATTACK, sabotageAttack, [154, 76]],
			[PLAYER_ACTIONS.DARK_ATTACK, darkAttack, [221, 206]],
			[PLAYER_ACTIONS.ENERGETIC_ATTACK, energeticAttack, [169, 116]],
			[PLAYER_ACTIONS.BREATH_TAKING_ATTACK, breathTakingAttack, [105, 56]],
			[PLAYER_ACTIONS.RAM_ATTACK, ramAttack, [195, 98]]
		];

		it.each(DAMAGE_ACTIONS)("%s deals its balanced damage to a weaker and to a stronger opponent", (actionId, use, expected) => {
			expect([
				damagesOf(use, actionId, {
					sender: STRONG, receiver: WEAK
				}),
				damagesOf(use, actionId, {
					sender: WEAK, receiver: STRONG
				})
			]).toEqual(expected);
		});
	});

	describe("critical hits and failures", () => {
		// Critical hit then failure probabilities (in %) of the attacks whose odds do not depend on the fight
		const FIXED_ODDS_ACTIONS: [string, FightActionFunc, number, number][] = [
			[PLAYER_ACTIONS.SIMPLE_ATTACK, simpleAttack, 5, 10],
			[PLAYER_ACTIONS.PIERCING_ATTACK, piercingAttack, 5, 10],
			[PLAYER_ACTIONS.SHIELD_ATTACK, shieldAttack, 5, 1],
			[PLAYER_ACTIONS.CHARGING_ATTACK, chargingAttack, 7, 1],
			[PLAYER_ACTIONS.CHARGE_CHARGING_ATTACK, chargeChargingAttack, 1, 1],
			[PLAYER_ACTIONS.CURSED_ATTACK, cursedAttack, 5, 0],
			[PLAYER_ACTIONS.BOOMERANG_ATTACK, boomerangAttack, 30, 5],
			[PLAYER_ACTIONS.FIRE_ATTACK, fireAttack, 12, 4],
			[PLAYER_ACTIONS.HEAVY_ATTACK, heavyAttack, 5, 4],
			[PLAYER_ACTIONS.SABOTAGE_ATTACK, sabotageAttack, 15, 5],
			[PLAYER_ACTIONS.BENEDICTION, benediction, 5, 1],
			[PLAYER_ACTIONS.DARK_ATTACK, darkAttack, 20, 9],
			[PLAYER_ACTIONS.BREATH_TAKING_ATTACK, breathTakingAttack, 1, 10],
			[PLAYER_ACTIONS.RAM_ATTACK, ramAttack, 5, 6]
		];

		it.each(FIXED_ODDS_ACTIONS)("%s lands a critical hit, then misses, then hits normally as the roll grows", (actionId, use, critical, failure) => {
			expect([critical - 1, critical, critical + failure].map(roll => statusAtRoll(use, actionId, roll)))
				.toEqual([FightActionStatus.CRITICAL, failure > 0 ? FightActionStatus.MISSED : FightActionStatus.NORMAL, FightActionStatus.NORMAL]);
		});

		it("makes a critical hit deal half more damage and a miss a fraction of it", () => {
			expect([0, 5, 99].map(roll => damagesOf(simpleAttack, PLAYER_ACTIONS.SIMPLE_ATTACK, { rolls: { secondaryEffectRoll: roll } })))
				.toEqual([263, 44, 175]);
		});
	});

	describe("quickAttack", () => {
		it("never misses when the sender is faster than its opponent", () => {
			expect(statusAtRoll(quickAttack, PLAYER_ACTIONS.QUICK_ATTACK, 10)).toBe(FightActionStatus.NORMAL);
		});

		it("misses one time out of five against an opponent as fast or faster", () => {
			const asFast = {
				sender: STRONG, receiver: {
					...WEAK, speed: STRONG.speed
				}
			};
			expect([9, 10, 29, 30].map(roll => statusAtRoll(quickAttack, PLAYER_ACTIONS.QUICK_ATTACK, roll, asFast)))
				.toEqual([FightActionStatus.CRITICAL, FightActionStatus.MISSED, FightActionStatus.MISSED, FightActionStatus.NORMAL]);
		});
	});

	describe("intenseAttack", () => {
		it("never misses when the sender is slower than its opponent, but does otherwise", () => {
			const slower = {
				sender: WEAK, receiver: STRONG
			};
			const asFast = {
				sender: STRONG, receiver: {
					...WEAK, speed: STRONG.speed
				}
			};
			expect([
				statusAtRoll(intenseAttack, PLAYER_ACTIONS.INTENSE_ATTACK, 5, slower),
				statusAtRoll(intenseAttack, PLAYER_ACTIONS.INTENSE_ATTACK, 5, asFast),
				statusAtRoll(intenseAttack, PLAYER_ACTIONS.INTENSE_ATTACK, 14, asFast),
				statusAtRoll(intenseAttack, PLAYER_ACTIONS.INTENSE_ATTACK, 15, asFast)
			]).toEqual([FightActionStatus.NORMAL, FightActionStatus.MISSED, FightActionStatus.MISSED, FightActionStatus.NORMAL]);
		});

		it("forces the sender to rest next turn and never knocks out its opponent", () => {
			const {
				sender, result
			} = duel(intenseAttack, PLAYER_ACTIONS.INTENSE_ATTACK, {
				receiver: {
					...WEAK, energy: 50
				}
			});

			expect(sender.nextFightAction?.id).toBe(PLAYER_ACTIONS.RESTING);
			expect(result.damages).toBe(49);
		});
	});

	describe("poisonousAttack", () => {
		it("is almost always critical during the first two turns", () => {
			expect([
				statusAtRoll(poisonousAttack, PLAYER_ACTIONS.POISONOUS_ATTACK, 89, { turn: 2 }),
				statusAtRoll(poisonousAttack, PLAYER_ACTIONS.POISONOUS_ATTACK, 90, { turn: 2 }),
				statusAtRoll(poisonousAttack, PLAYER_ACTIONS.POISONOUS_ATTACK, 89, { turn: 3 }),
				statusAtRoll(poisonousAttack, PLAYER_ACTIONS.POISONOUS_ATTACK, 4, { turn: 3 })
			]).toEqual([FightActionStatus.CRITICAL, FightActionStatus.NORMAL, FightActionStatus.NORMAL, FightActionStatus.CRITICAL]);
		});

		it("never misses before the seventh turn and often misses after", () => {
			expect([
				statusAtRoll(poisonousAttack, PLAYER_ACTIONS.POISONOUS_ATTACK, 5, { turn: 6 }),
				statusAtRoll(poisonousAttack, PLAYER_ACTIONS.POISONOUS_ATTACK, 5, { turn: 7 }),
				statusAtRoll(poisonousAttack, PLAYER_ACTIONS.POISONOUS_ATTACK, 44, { turn: 7 }),
				statusAtRoll(poisonousAttack, PLAYER_ACTIONS.POISONOUS_ATTACK, 45, { turn: 7 })
			]).toEqual([FightActionStatus.NORMAL, FightActionStatus.MISSED, FightActionStatus.MISSED, FightActionStatus.NORMAL]);
		});
	});

	describe("attacks inflicting an alteration to the opponent", () => {
		const ALTERATION_ACTIONS: [string, FightActionFunc, string][] = [
			[PLAYER_ACTIONS.POISONOUS_ATTACK, poisonousAttack, FightAlterations.POISONED],
			[PLAYER_ACTIONS.BOOMERANG_ATTACK, boomerangAttack, FightAlterations.TARGETED],
			[PLAYER_ACTIONS.FIRE_ATTACK, fireAttack, FightAlterations.BURNED],
			[PLAYER_ACTIONS.SHIELD_ATTACK, shieldAttack, FightAlterations.WEAK],
			[PLAYER_ACTIONS.CURSED_ATTACK, cursedAttack, FightAlterations.CURSED],
			[PLAYER_ACTIONS.ULTIMATE_ATTACK, ultimateAttack, FightAlterations.SLOWED]
		];

		it.each(ALTERATION_ACTIONS)("%s inflicts its alteration to the opponent only", (actionId, use, alterationId) => {
			const {
				sender, receiver, result
			} = duel(use, actionId);

			expect(receiver.alteration?.id).toBe(alterationId);
			expect(sender.alteration).toBeNull();
			expect(result.alterations).toEqual([{
				selfTarget: false, alteration: alterationId
			}]);
		});
	});

	describe("attacks changing the stats", () => {
		it("piercingAttack lowers the defense of the opponent a bit less than half of the time", () => {
			const piercedDefense = (mathRandom: number): number => duel(piercingAttack, PLAYER_ACTIONS.PIERCING_ATTACK, { rolls: { mathRandom } }).receiver.getDefense();

			expect([piercedDefense(0.44), piercedDefense(0.45)]).toEqual([90, 100]);
			expect(duel(piercingAttack, PLAYER_ACTIONS.PIERCING_ATTACK, { rolls: { mathRandom: 0.1 } }).result.buffs).toEqual(buffOf(false, FightStatBuffed.DEFENSE, 0.9));
		});

		it("chargingAttack lowers the defense of the sender", () => {
			const {
				sender, result
			} = duel(chargingAttack, PLAYER_ACTIONS.CHARGING_ATTACK);

			expect(sender.getDefense()).toBe(201);
			expect(result.buffs).toEqual(buffOf(true, FightStatBuffed.DEFENSE, 0.67));
		});

		it("chargeChargingAttack raises the defense of the sender and prepares the charging attack", () => {
			const {
				sender, result
			} = duel(chargeChargingAttack, PLAYER_ACTIONS.CHARGE_CHARGING_ATTACK);

			expect(sender.getDefense()).toBe(450);
			expect(result.buffs).toEqual(buffOf(true, FightStatBuffed.DEFENSE, 1.5));
			expect(sender.nextFightAction?.id).toBe(PLAYER_ACTIONS.CHARGING_ATTACK);
		});

		it("defenseBuff raises the defense more and more as it is repeated in the last three actions", () => {
			const buffedDefense = (history: string[]): number => duel(defenseBuff, PLAYER_ACTIONS.DEFENSE_BUFF, { senderHistory: history }).sender.getDefense();
			const DEFENSE_BUFF = PLAYER_ACTIONS.DEFENSE_BUFF;
			const OTHER = PLAYER_ACTIONS.SIMPLE_ATTACK;

			expect([
				buffedDefense([]),
				buffedDefense([DEFENSE_BUFF]),
				buffedDefense([DEFENSE_BUFF, DEFENSE_BUFF]),
				buffedDefense([DEFENSE_BUFF, DEFENSE_BUFF, DEFENSE_BUFF]),
				buffedDefense([DEFENSE_BUFF, OTHER, OTHER, OTHER])
			]).toEqual([360, 375, 405, 420, 360]);
			expect(duel(defenseBuff, DEFENSE_BUFF).result).toMatchObject({
				customMessage: true, buffs: buffOf(true, FightStatBuffed.DEFENSE, 1.2)
			});
		});
	});

	describe("heavyAttack", () => {
		it("hits much harder right after a rest", () => {
			expect([
				damagesOf(heavyAttack, PLAYER_ACTIONS.HEAVY_ATTACK, { senderHistory: [PLAYER_ACTIONS.RESTING] }),
				damagesOf(heavyAttack, PLAYER_ACTIONS.HEAVY_ATTACK, { senderHistory: [PLAYER_ACTIONS.SIMPLE_ATTACK] })
			]).toEqual([299, 158]);
		});

		it("lowers the defense of the opponent less and less with each use", () => {
			const HEAVY = PLAYER_ACTIONS.HEAVY_ATTACK;
			const opponentDefense = (history: string[]): number => duel(heavyAttack, HEAVY, { senderHistory: history }).receiver.getDefense();

			expect([
				opponentDefense([]),
				opponentDefense([HEAVY]),
				opponentDefense([HEAVY, HEAVY]),
				opponentDefense([HEAVY, HEAVY, HEAVY]),
				opponentDefense([PLAYER_ACTIONS.SIMPLE_ATTACK, PLAYER_ACTIONS.RESTING, PLAYER_ACTIONS.SIMPLE_ATTACK])
			]).toEqual([80, 90, 95, 100, 80]);
			expect(duel(heavyAttack, HEAVY).result.buffs).toEqual(buffOf(false, FightStatBuffed.DEFENSE, 0.8));
			expect(duel(heavyAttack, HEAVY, { senderHistory: [HEAVY, HEAVY, HEAVY] }).result.buffs).toBeUndefined();
		});
	});

	describe("powerfulAttack", () => {
		const POWERFUL = PLAYER_ACTIONS.POWERFUL_ATTACK;

		it("is almost useless once used more than three times", () => {
			expect([
				damagesOf(powerfulAttack, POWERFUL, { senderHistory: [POWERFUL, POWERFUL, PLAYER_ACTIONS.SIMPLE_ATTACK] }),
				damagesOf(powerfulAttack, POWERFUL, { senderHistory: [POWERFUL, POWERFUL, POWERFUL] })
			]).toEqual([316, 32]);
		});

		it("sometimes stuns the sender and then deals half more damage", () => {
			const stunned = duel(powerfulAttack, POWERFUL, { rolls: { mathRandom: 0.19 } });
			const notStunned = duel(powerfulAttack, POWERFUL, { rolls: { mathRandom: 0.2 } });

			expect(stunned.sender.alteration?.id).toBe(FightAlterations.STUNNED);
			expect(stunned.result.alterations).toEqual([{
				selfTarget: true, alteration: FightAlterations.STUNNED
			}]);
			expect(stunned.result.damages).toBe(474);
			expect(notStunned.sender.alteration).toBeNull();
			expect(notStunned.result.damages).toBe(316);
		});

		it("does not deal more damage when the sender cannot be stunned because of another alteration", () => {
			fixFightRandomness({ mathRandom: 0.1 });
			const sender = new TestFighter(STRONG);
			sender.newAlteration(fightAlterationById(FightAlterations.POISONED));

			const result = powerfulAttack(sender, new TestFighter(WEAK), action(POWERFUL), 5, NO_FIGHT);

			expect(result.damages).toBe(316);
			expect(sender.alteration?.id).toBe(FightAlterations.POISONED);
		});

		it("slows the opponent down", () => {
			const {
				receiver, result
			} = duel(powerfulAttack, POWERFUL);

			expect(receiver.getSpeed()).toBe(68);
			expect(result.buffs).toEqual(buffOf(false, FightStatBuffed.SPEED, 0.85));
		});

		it("misses less often when used by a high level sender", () => {
			const highLevel = {
				sender: {
					...STRONG, level: 120
				}
			};
			expect([
				statusAtRoll(powerfulAttack, POWERFUL, 11),
				statusAtRoll(powerfulAttack, POWERFUL, 12),
				statusAtRoll(powerfulAttack, POWERFUL, 4, highLevel),
				statusAtRoll(powerfulAttack, POWERFUL, 5, highLevel)
			]).toEqual([FightActionStatus.MISSED, FightActionStatus.NORMAL, FightActionStatus.MISSED, FightActionStatus.NORMAL]);
		});
	});

	describe("ultimateAttack", () => {
		it("only reliably lands when the sender has lost more than 55% of its energy", () => {
			const withEnergy = (energy: number): DuelSetup => ({
				sender: {
					...STRONG, energy
				}
			});
			expect([
				statusAtRoll(ultimateAttack, PLAYER_ACTIONS.ULTIMATE_ATTACK, 9, withEnergy(449)),
				statusAtRoll(ultimateAttack, PLAYER_ACTIONS.ULTIMATE_ATTACK, 10, withEnergy(449)),
				statusAtRoll(ultimateAttack, PLAYER_ACTIONS.ULTIMATE_ATTACK, 10, withEnergy(450)),
				statusAtRoll(ultimateAttack, PLAYER_ACTIONS.ULTIMATE_ATTACK, 79, withEnergy(450)),
				statusAtRoll(ultimateAttack, PLAYER_ACTIONS.ULTIMATE_ATTACK, 80, withEnergy(450))
			]).toEqual([FightActionStatus.CRITICAL, FightActionStatus.NORMAL, FightActionStatus.MISSED, FightActionStatus.MISSED, FightActionStatus.NORMAL]);
		});
	});

	describe("canonAttack", () => {
		const CANON = PLAYER_ACTIONS.CANON_ATTACK;

		it("hits harder when fired twice in a row", () => {
			expect([
				damagesOf(canonAttack, CANON, { senderHistory: [CANON] }),
				damagesOf(canonAttack, CANON, { senderHistory: [CANON, PLAYER_ACTIONS.SIMPLE_ATTACK] })
			]).toEqual([377, 251]);
		});

		it("misses more against a fast opponent", () => {
			const fastOpponent = {
				receiver: {
					...WEAK, speed: 1000
				}
			};
			expect([
				statusAtRoll(canonAttack, CANON, 9),
				statusAtRoll(canonAttack, CANON, 17),
				statusAtRoll(canonAttack, CANON, 18),
				statusAtRoll(canonAttack, CANON, 24, fastOpponent),
				statusAtRoll(canonAttack, CANON, 25, fastOpponent)
			]).toEqual([FightActionStatus.CRITICAL, FightActionStatus.MISSED, FightActionStatus.NORMAL, FightActionStatus.MISSED, FightActionStatus.NORMAL]);
		});

		it("sometimes slows the opponent down", () => {
			expect([0.19, 0.2].map(mathRandom => duel(canonAttack, CANON, { rolls: { mathRandom } }).result.alterations))
				.toEqual([[{
					selfTarget: false, alteration: FightAlterations.SLOWED
				}], undefined]);
		});
	});

	describe("god moves", () => {
		const DIVINE = PLAYER_ACTIONS.DIVINE_ATTACK;

		it("divineAttack can only be used while less than two god moves were used in the fight", () => {
			expect([
				duel(divineAttack, DIVINE, { senderHistory: [DIVINE] }).result.attackStatus,
				duel(divineAttack, DIVINE, {
					senderHistory: [DIVINE], receiverHistory: [PLAYER_ACTIONS.BENEDICTION]
				}).result.attackStatus,
				duel(divineAttack, DIVINE, { senderHistory: [DIVINE, DIVINE] }).result.attackStatus
			]).toEqual([FightActionStatus.NORMAL, FightActionStatus.MAX_USES, FightActionStatus.MAX_USES]);
		});

		it("divineAttack misses less and less as the fight goes on, down to a floor", () => {
			expect([
				statusAtRoll(divineAttack, DIVINE, 61, { turn: 5 }),
				statusAtRoll(divineAttack, DIVINE, 62, { turn: 5 }),
				statusAtRoll(divineAttack, DIVINE, 5, { turn: 13 }),
				statusAtRoll(divineAttack, DIVINE, 6, { turn: 13 }),
				statusAtRoll(divineAttack, DIVINE, 4, { turn: 14 }),
				statusAtRoll(divineAttack, DIVINE, 5, { turn: 14 })
			]).toEqual([
				FightActionStatus.MISSED, FightActionStatus.NORMAL,
				FightActionStatus.MISSED, FightActionStatus.NORMAL,
				FightActionStatus.MISSED, FightActionStatus.NORMAL
			]);
		});

		it("divineAttack sometimes paralyzes the opponent", () => {
			expect([0.19, 0.2].map(mathRandom => duel(divineAttack, DIVINE, { rolls: { mathRandom } }).result.alterations))
				.toEqual([[{
					selfTarget: false, alteration: FightAlterations.PARALYZED
				}], undefined]);
		});

		it("benediction can only be used once per fight, by any of the fighters", () => {
			expect([
				duel(benediction, PLAYER_ACTIONS.BENEDICTION, { receiverHistory: [PLAYER_ACTIONS.SIMPLE_ATTACK] }).result.attackStatus,
				duel(benediction, PLAYER_ACTIONS.BENEDICTION, { receiverHistory: [DIVINE] }).result.attackStatus,
				duel(benediction, PLAYER_ACTIONS.BENEDICTION, { senderHistory: [PLAYER_ACTIONS.BENEDICTION] }).result.attackStatus
			]).toEqual([FightActionStatus.NORMAL, FightActionStatus.MAX_USES, FightActionStatus.MAX_USES]);
		});

		it("benediction boosts every stat of the sender more the later it is used, up to a cap", () => {
			const boostedStats = (turn: number): number[] => {
				const { sender } = duel(benediction, PLAYER_ACTIONS.BENEDICTION, { turn });
				return [sender.getAttack(), sender.getDefense(), sender.getSpeed()];
			};

			expect([boostedStats(5), boostedStats(14), boostedStats(15), boostedStats(30)])
				.toEqual([[432, 324, 270], [492, 369, 308], [500, 375, 313], [500, 375, 313]]);
			expect(duel(benediction, PLAYER_ACTIONS.BENEDICTION, { turn: 15 }).result.buffs?.map(buff => buff.selfTarget)).toEqual([true, true, true]);
		});
	});

	describe("sabotageAttack", () => {
		it("often paralyzes the sender to deal half more damage", () => {
			const paralyzed = duel(sabotageAttack, PLAYER_ACTIONS.SABOTAGE_ATTACK, { rolls: { mathRandom: 0.59 } });
			const notParalyzed = duel(sabotageAttack, PLAYER_ACTIONS.SABOTAGE_ATTACK, { rolls: { mathRandom: 0.6 } });

			expect([paralyzed.result.alterations, paralyzed.result.damages]).toEqual([[{
				selfTarget: true, alteration: FightAlterations.PARALYZED
			}], 231]);
			expect([notParalyzed.sender.alteration, notParalyzed.result.damages]).toEqual([null, 154]);
		});
	});

	describe("cursedAttack", () => {
		const healOfSender = (receiverEnergy: number): number => duel(cursedAttack, PLAYER_ACTIONS.CURSED_ATTACK, {
			sender: {
				...STRONG, energy: 500
			},
			receiver: {
				...WEAK, energy: receiverEnergy
			}
		}).sender.getEnergy() - 500;

		it("heals the sender more when the opponent still has a lot of energy", () => {
			expect([healOfSender(1000), healOfSender(700), healOfSender(401)]).toEqual([106, 60, 15]);
		});

		it("records the heal as a buff of the sender", () => {
			const { result } = duel(cursedAttack, PLAYER_ACTIONS.CURSED_ATTACK);

			expect(result.buffs).toEqual(buffOf(true, FightStatBuffed.ENERGY, 106, FightStatModifierOperation.ADDITION));
		});

		it("does not heal the sender when the opponent has 40% of its energy or less", () => {
			expect(healOfSender(400)).toBe(0);
		});
	});

	describe("resting", () => {
		const restedEnergy = (history: string[]): number => duel(resting, PLAYER_ACTIONS.RESTING, {
			sender: {
				...STRONG, energy: 400
			},
			senderHistory: history
		}).sender.getEnergy() - 400;
		const REST = PLAYER_ACTIONS.RESTING;

		it("heals the sender, four times less once it has already rested four times", () => {
			expect([
				restedEnergy([]),
				restedEnergy([REST, REST, REST, PLAYER_ACTIONS.SIMPLE_ATTACK]),
				restedEnergy([REST, REST, REST, REST])
			]).toEqual([128, 128, 32]);
		});

		it("heals the same whatever the damage boosts of the sender", () => {
			fixFightRandomness();
			const sender = new TestFighter({
				...STRONG, energy: 400
			});
			sender.applyDamageMultiplier(2, 1);

			const result = resting(sender, new TestFighter(WEAK), action(PLAYER_ACTIONS.RESTING), 5, NO_FIGHT);

			expect(sender.getEnergy()).toBe(528);
			expect(result.buffs).toEqual(buffOf(true, FightStatBuffed.ENERGY, 128, FightStatModifierOperation.ADDITION));
		});

		it("ends any planned action with a custom message", () => {
			fixFightRandomness();
			const sender = new TestFighter(STRONG);
			sender.nextFightAction = action(PLAYER_ACTIONS.CHARGING_ATTACK);
			const result = resting(sender, new TestFighter(WEAK), action(REST), 5, NO_FIGHT);

			expect(sender.nextFightAction).toBeNull();
			expect(result.customMessage).toBe(true);
		});
	});

	describe("actions without damage", () => {
		it("concentration concentrates the sender with a custom message", () => {
			const {
				sender, result
			} = duel(concentration, PLAYER_ACTIONS.CONCENTRATION);

			expect(result.alterations).toEqual([{
				selfTarget: true, alteration: FightAlterations.CONCENTRATED
			}]);
			expect(sender.alteration?.id).toBe(FightAlterations.CONCENTRATED);
			expect(result).toMatchObject({
				fail: false, attackStatus: FightActionStatus.NORMAL, customMessage: true
			});
		});

		it("protection protects the sender", () => {
			const {
				sender, result
			} = duel(protection, PLAYER_ACTIONS.PROTECTION);

			expect(result.alterations).toEqual([{
				selfTarget: true, alteration: FightAlterations.PROTECTED
			}]);
			expect(sender.alteration?.id).toBe(FightAlterations.PROTECTED);
			expect(result.customMessage).toBe(false);
			expect(result.fail).toBe(false);
		});

		it("fails to protect a sender already suffering from another alteration", () => {
			fixFightRandomness();
			const sender = new TestFighter(STRONG);
			sender.newAlteration(fightAlterationById(FightAlterations.POISONED));

			const result = protection(sender, new TestFighter(WEAK), action(PLAYER_ACTIONS.PROTECTION), 5, NO_FIGHT);

			expect(result).toMatchObject({
				fail: true, attackStatus: FightActionStatus.MISSED
			});
			expect(sender.alteration?.id).toBe(FightAlterations.POISONED);
		});

		it("none ends any planned action with a custom message", () => {
			fixFightRandomness();
			const sender = new TestFighter(STRONG);
			sender.nextFightAction = action(PLAYER_ACTIONS.CHARGING_ATTACK);

			const result = none(sender, new TestFighter(WEAK), action(PLAYER_ACTIONS.NONE), 5, NO_FIGHT);

			expect(sender.nextFightAction).toBeNull();
			expect(result.customMessage).toBe(true);
		});

		it("chargeUltimateAttack prepares the ultimate attack only once per fight", () => {
			const first = duel(chargeUltimateAttack, PLAYER_ACTIONS.CHARGE_ULTIMATE_ATTACK);
			const afterOtherAttacks = duel(chargeUltimateAttack, PLAYER_ACTIONS.CHARGE_ULTIMATE_ATTACK, { senderHistory: [PLAYER_ACTIONS.SIMPLE_ATTACK] });
			const second = duel(chargeUltimateAttack, PLAYER_ACTIONS.CHARGE_ULTIMATE_ATTACK, { senderHistory: [PLAYER_ACTIONS.ULTIMATE_ATTACK] });

			expect([first.sender.nextFightAction?.id, first.result.fail]).toEqual([PLAYER_ACTIONS.ULTIMATE_ATTACK, undefined]);
			expect(afterOtherAttacks.sender.nextFightAction?.id).toBe(PLAYER_ACTIONS.ULTIMATE_ATTACK);
			expect([second.sender.nextFightAction, second.result.fail]).toEqual([null, true]);
		});
	});

	describe("energeticAttack", () => {
		const ENERGETIC = PLAYER_ACTIONS.ENERGETIC_ATTACK;

		it("misses more and more as it is repeated", () => {
			const statusesAfter = (history: string[], rolls: number[]): FightActionStatus[] => rolls.map(roll => statusAtRoll(energeticAttack, ENERGETIC, roll, { senderHistory: history }));

			expect(statusesAfter([], [34, 35])).toEqual([FightActionStatus.CRITICAL, FightActionStatus.NORMAL]);
			expect(statusesAfter([ENERGETIC, PLAYER_ACTIONS.SIMPLE_ATTACK], [37, 38])).toEqual([FightActionStatus.MISSED, FightActionStatus.NORMAL]);
			expect(statusesAfter([ENERGETIC, ENERGETIC], [41, 42])).toEqual([FightActionStatus.MISSED, FightActionStatus.NORMAL]);
			expect(statusesAfter([ENERGETIC, ENERGETIC, ENERGETIC], [94, 95])).toEqual([FightActionStatus.MISSED, FightActionStatus.NORMAL]);
			expect(statusesAfter([ENERGETIC, ENERGETIC, ENERGETIC, ENERGETIC, ENERGETIC], [94, 95])).toEqual([FightActionStatus.MISSED, FightActionStatus.NORMAL]);
		});

		it("heals the sender of half the damage dealt, ten times less after its third use", () => {
			const healAfter = (history: string[]): FightActionResult["buffs"] => duel(energeticAttack, ENERGETIC, {
				senderHistory: history,
				sender: {
					...STRONG, energy: 100
				}
			}).result.buffs;

			expect(healAfter([ENERGETIC, ENERGETIC])).toEqual(buffOf(true, FightStatBuffed.ENERGY, 85, FightStatModifierOperation.ADDITION));
			expect(healAfter([ENERGETIC, ENERGETIC, ENERGETIC])).toEqual(buffOf(true, FightStatBuffed.ENERGY, 8, FightStatModifierOperation.ADDITION));
		});

		it("heals the sender less against a monster", () => {
			fixFightRandomness();
			const sender = new TestFighter({
				...STRONG, energy: 100
			});
			const monster = new MonsterFighter(50, monsterById("captainCrow"));

			const result = energeticAttack(sender, monster, action(ENERGETIC), 5, NO_FIGHT);

			expect(sender.getEnergy() - 100).toBe(Math.round(required(result.damages, "damage") / 5));
		});

		it("never heals the sender more than about two hundred energy", () => {
			fixFightRandomness();
			const sender = new TestFighter({
				...STRONG, energy: 100
			});
			sender.applyDamageMultiplier(3, 1);
			vi.spyOn(RandomUtils, "variationInt").mockImplementation(variation => (variation === 10 ? 7 : 0));

			const result = energeticAttack(sender, new TestFighter(WEAK), action(ENERGETIC), 5, NO_FIGHT);

			expect(result.damages).toBe(508);
			expect(sender.getEnergy()).toBe(307);
		});
	});

	describe("breathTakingAttack", () => {
		it("slows an opponent out of breath instead of stealing breath from it", () => {
			const {
				sender, receiver, result
			} = duel(breathTakingAttack, PLAYER_ACTIONS.BREATH_TAKING_ATTACK, {
				sender: {
					...STRONG, breath: 2
				},
				receiver: {
					...WEAK, breath: 0
				}
			});

			expect([sender.getBreath(), receiver.getSpeed()]).toEqual([2, 68]);
			expect(result.buffs).toEqual(buffOf(false, FightStatBuffed.SPEED, 0.85));
		});

		it("records the breath moved from the opponent to the sender", () => {
			const { result } = duel(breathTakingAttack, PLAYER_ACTIONS.BREATH_TAKING_ATTACK);

			expect(result.buffs).toEqual([
				...buffOf(false, FightStatBuffed.BREATH, -2, FightStatModifierOperation.ADDITION),
				...buffOf(true, FightStatBuffed.BREATH, 2, FightStatModifierOperation.ADDITION)
			]);
		});
	});

	describe("ramAttack", () => {
		const RAM = PLAYER_ACTIONS.RAM_ATTACK;
		const ram = (mathRandom: number): Duel => duel(ramAttack, RAM, {
			rolls: { mathRandom }
		});

		it("often stuns the opponent", () => {
			expect([0.69, 0.7].map(mathRandom => ram(mathRandom).result.alterations?.[0])).toEqual([{
				selfTarget: false, alteration: FightAlterations.STUNNED
			}, undefined]);
		});

		it("sometimes stuns the sender instead of hurting it", () => {
			const selfStunned = ram(0.24);

			expect(selfStunned.sender.alteration?.id).toBe(FightAlterations.STUNNED);
			expect(selfStunned.result.alterations?.[1]).toEqual({
				selfTarget: true, alteration: FightAlterations.STUNNED
			});
			expect(selfStunned.sender.getEnergy()).toBe(1000);
		});

		it("otherwise hurts the sender with a recoil depending on its defense and speed", () => {
			const recoil = (sender: TestFighterStats): number => 1000 - duel(ramAttack, RAM, {
				sender, rolls: { mathRandom: 0.25 }
			}).sender.getEnergy();

			expect([recoil(STRONG), recoil(WEAK), recoil({
				...STRONG, speed: 1000
			})]).toEqual([40, 35, 39]);
			expect(ram(0.25).result.buffs?.[0].selfTarget).toBe(true);
		});
	});
});
