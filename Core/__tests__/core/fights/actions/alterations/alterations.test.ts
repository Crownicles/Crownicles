import {
	afterEach, describe, expect, it, vi
} from "vitest";
import {
	FightAlteration, FightAlterationDataController, FightAlterationFunc
} from "../../../../../src/data/FightAlteration";
import { FightAlterations } from "../../../../../src/core/fights/actions/FightAlterations";
import {
	FightAlterationResult, FightAlterationState
} from "../../../../../../Lib/src/types/FightAlterationResult";
import { FightConstants } from "../../../../../../Lib/src/constants/FightConstants";
import { RandomUtils } from "../../../../../../Lib/src/utils/RandomUtils";
import { FightStatBuffed } from "../../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../../Lib/src/types/FightStatModifierOperation";
import type { FightController } from "../../../../../src/core/fights/FightController";
import { MonsterFighter } from "../../../../../src/core/fights/fighter/MonsterFighter";
import {
	fixFightRandomness, FightRolls
} from "../FightRandomness";
import {
	TestFighter, TestFighterStats
} from "../players/TestFighter";
import bleeding from "../../../../../src/core/fights/actions/interfaces/alterations/bleeding";
import burned from "../../../../../src/core/fights/actions/interfaces/alterations/burned";
import concentrated from "../../../../../src/core/fights/actions/interfaces/alterations/concentrated";
import confused from "../../../../../src/core/fights/actions/interfaces/alterations/confused";
import cursed from "../../../../../src/core/fights/actions/interfaces/alterations/cursed";
import frozen from "../../../../../src/core/fights/actions/interfaces/alterations/frozen";
import full from "../../../../../src/core/fights/actions/interfaces/alterations/full";
import outOfBreath from "../../../../../src/core/fights/actions/interfaces/alterations/outOfBreath";
import paralyzed from "../../../../../src/core/fights/actions/interfaces/alterations/paralyzed";
import poisoned from "../../../../../src/core/fights/actions/interfaces/alterations/poisoned";
import protectedAlteration from "../../../../../src/core/fights/actions/interfaces/alterations/protected";
import slowed from "../../../../../src/core/fights/actions/interfaces/alterations/slowed";
import stunned from "../../../../../src/core/fights/actions/interfaces/alterations/stunned";
import targeted from "../../../../../src/core/fights/actions/interfaces/alterations/targeted";
import weak from "../../../../../src/core/fights/actions/interfaces/alterations/weak";
import {
	fightActionById, monsterById, required
} from "../../FightTestData";

const PLAYER_ACTIONS = FightConstants.FIGHT_ACTIONS.PLAYER;
// These alterations never read the fight controller: they happen outside of any fight
const NO_FIGHT = null as unknown as FightController;

// The fighter suffering from the alteration and the opponent who inflicted it
const AFFECTED: TestFighterStats = {
	level: 50, attack: 150, defense: 100, speed: 80, breath: 4
};
const OPPONENT: TestFighterStats = {
	level: 50, attack: 400, defense: 300, speed: 250
};

function alteration(id: string): FightAlteration {
	const fightAlteration = FightAlterationDataController.instance.getById(id);
	if (!fightAlteration) {
		throw new Error(`Unknown alteration ${id}`);
	}
	return fightAlteration;
}

type AlterationTurn = {
	affected: TestFighter;
	opponent: TestFighter;
	result: FightAlterationResult;
};

type AlterationSetup = {
	alterationTurn: number;
	opponent?: TestFighter;
	affected?: TestFighterStats;
	affectedHistory?: string[];
	turn?: number;
	rolls?: FightRolls;
};

/**
 * Make the alteration happen to a fighter suffering from it since the given number of turns
 */
function sufferFrom(use: FightAlterationFunc, alterationId: string, setup: AlterationSetup): AlterationTurn {
	fixFightRandomness(setup.rolls);
	const affected = new TestFighter(setup.affected ?? AFFECTED);
	const opponent = setup.opponent ?? new TestFighter(OPPONENT);
	affected.newAlteration(alteration(alterationId));
	affected.alterationTurn = setup.alterationTurn;
	affected.fightActionsHistory = (setup.affectedHistory ?? []).map(id => fightActionById(id));
	const result = use(affected, alteration(alterationId), opponent, setup.turn ?? 5, NO_FIGHT);
	return {
		affected, opponent, result
	};
}

function damagesAt(use: FightAlterationFunc, alterationId: string, setup: AlterationSetup): number | undefined {
	return sufferFrom(use, alterationId, setup).result.damages;
}

function enchantedOpponent(alterationId: string): TestFighter {
	const opponent = new TestFighter(OPPONENT);
	opponent.boostAlterationDamage(alterationId, 2);
	return opponent;
}

function boostedOpponent(): TestFighter {
	const opponent = new TestFighter(OPPONENT);
	opponent.applyDamageMultiplier(3, 1);
	return opponent;
}

function statesAt(use: FightAlterationFunc, alterationId: string, alterationTurns: number[], rolls?: FightRolls): FightAlterationState[] {
	return alterationTurns.map(alterationTurn => sufferFrom(use, alterationId, {
		alterationTurn, rolls
	}).result.state);
}

describe("fight alterations", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("stat alterations lasting two turns", () => {
		const STAT_ALTERATIONS: [string, FightAlterationFunc, (fighter: TestFighter) => number, number][] = [
			[FightAlterations.SLOWED, slowed, (fighter): number => fighter.getSpeed(), 32],
			[FightAlterations.WEAK, weak, (fighter): number => fighter.getAttack(), 45],
			[FightAlterations.PROTECTED, protectedAlteration, (fighter): number => fighter.getDefense(), 130]
		];

		it.each(STAT_ALTERATIONS)("%s changes the stat of the fighter once, then heals after two turns", (alterationId, use, stat, alteredStat) => {
			const { affected, result } = sufferFrom(use, alterationId, { alterationTurn: 1 });
			expect([result.state, stat(affected)]).toEqual([FightAlterationState.NEW, alteredStat]);
			expect(result.buffs?.[0].selfTarget).toBe(true);

			affected.alterationTurn = 2;
			const secondTurn = use(affected, alteration(alterationId), new TestFighter(OPPONENT), 6, NO_FIGHT);
			expect([secondTurn.state, secondTurn.buffs, stat(affected)]).toEqual([FightAlterationState.ACTIVE, undefined, alteredStat]);

			affected.alterationTurn = 3;
			const healed = use(affected, alteration(alterationId), new TestFighter(OPPONENT), 7, NO_FIGHT);
			expect([healed.state, affected.alteration, stat(affected)]).toEqual([FightAlterationState.STOP, null, stat(new TestFighter(AFFECTED))]);
		});
	});

	describe("paralyzed", () => {
		it("stops the fighter and sometimes makes it skip its turn", () => {
			const skipping = sufferFrom(paralyzed, FightAlterations.PARALYZED, {
				alterationTurn: 1, rolls: { mathRandom: 0.19 }
			});
			const acting = sufferFrom(paralyzed, FightAlterations.PARALYZED, {
				alterationTurn: 1, rolls: { mathRandom: 0.2 }
			});

			expect([skipping.result.state, skipping.affected.nextFightAction?.id]).toEqual([FightAlterationState.NO_ACTION, PLAYER_ACTIONS.NONE]);
			expect([acting.result.state, acting.affected.nextFightAction, acting.affected.getSpeed()]).toEqual([FightAlterationState.NEW, null, 0]);
			expect(acting.result.buffs?.[0].selfTarget).toBe(true);

			acting.affected.alterationTurn = 2;
			const secondTurn = paralyzed(acting.affected, alteration(FightAlterations.PARALYZED), new TestFighter(OPPONENT), 6, NO_FIGHT);
			expect([secondTurn.state, secondTurn.buffs]).toEqual([FightAlterationState.ACTIVE, undefined]);
		});

		it("heals after two turns and gives the speed back", () => {
			const { affected } = sufferFrom(paralyzed, FightAlterations.PARALYZED, { alterationTurn: 2 });

			expect(affected.getSpeed()).toBe(0);
			affected.alterationTurn = 3;
			expect(paralyzed(affected, alteration(FightAlterations.PARALYZED), new TestFighter(OPPONENT), 6, NO_FIGHT).state).toBe(FightAlterationState.STOP);
			expect(affected.getSpeed()).toBe(AFFECTED.speed);
		});
	});

	describe("stunned", () => {
		it("makes the fighter skip its turn half of the time, then heals after one turn", () => {
			const skipping = sufferFrom(stunned, FightAlterations.STUNNED, {
				alterationTurn: 1, rolls: { mathRandom: 0.49 }
			});
			const acting = sufferFrom(stunned, FightAlterations.STUNNED, {
				alterationTurn: 1, rolls: { mathRandom: 0.5 }
			});

			expect([skipping.result.state, skipping.affected.nextFightAction?.id]).toEqual([FightAlterationState.NO_ACTION, PLAYER_ACTIONS.NONE]);
			expect([acting.result.state, acting.affected.nextFightAction]).toEqual([FightAlterationState.ACTIVE, null]);
			expect(statesAt(stunned, FightAlterations.STUNNED, [2], { mathRandom: 0 })).toEqual([FightAlterationState.STOP]);
		});
	});

	describe("full", () => {
		it("makes the fighter skip its turns and stops it for two turns", () => {
			const { affected, result } = sufferFrom(full, FightAlterations.FULL, { alterationTurn: 1 });

			expect([result.state, affected.nextFightAction?.id, affected.getSpeed()]).toEqual([FightAlterationState.NEW, PLAYER_ACTIONS.NONE, 0]);
			expect(result.buffs?.[0].selfTarget).toBe(true);
			affected.alterationTurn = 2;
			expect(full(affected, alteration(FightAlterations.FULL), new TestFighter(OPPONENT), 6, NO_FIGHT).state).toBe(FightAlterationState.ACTIVE);
			expect(statesAt(full, FightAlterations.FULL, [3])).toEqual([FightAlterationState.STOP]);
		});
	});

	describe("concentrated", () => {
		it("boosts the damage of the next action only, then heals", () => {
			const { affected, result } = sufferFrom(concentrated, FightAlterations.CONCENTRATED, { alterationTurn: 1 });

			expect(result.state).toBe(FightAlterationState.NEW);
			expect(result.buffs).toEqual([{
				selfTarget: true,
				stat: FightStatBuffed.DAMAGE_BOOST,
				operator: FightStatModifierOperation.MULTIPLIER,
				duration: 1,
				value: FightConstants.CONCENTRATED_DAMAGE_MULTIPLIER
			}]);
			expect(affected.getDamageMultiplier()).toBe(FightConstants.CONCENTRATED_DAMAGE_MULTIPLIER);
			expect(statesAt(concentrated, FightAlterations.CONCENTRATED, [2])).toEqual([FightAlterationState.STOP]);
		});
	});

	describe("outOfBreath", () => {
		it("cancels the planned action of the fighter", () => {
			fixFightRandomness();
			const affected = new TestFighter(AFFECTED);
			affected.nextFightAction = fightActionById(PLAYER_ACTIONS.CHARGING_ATTACK);

			const result = outOfBreath(affected, alteration(FightConstants.FIGHT_ACTIONS.ALTERATION.OUT_OF_BREATH), new TestFighter(OPPONENT), 5, NO_FIGHT);

			expect([result.state, affected.nextFightAction]).toEqual([FightAlterationState.ACTIVE, null]);
		});
	});

	describe("poisoned", () => {
		it("hurts the fighter according to the attack of the opponent and its poison enchantment", () => {
			expect(damagesAt(poisoned, FightAlterations.POISONED, { alterationTurn: 1 })).toBe(47);
			expect(damagesAt(poisoned, FightAlterations.POISONED, {
				alterationTurn: 1, opponent: enchantedOpponent(FightAlterations.POISONED)
			})).toBe(94);
		});

		it("can only heal after three turns", () => {
			expect(statesAt(poisoned, FightAlterations.POISONED, [3, 4], { mathRandom: 0.34 })).toEqual([FightAlterationState.ACTIVE, FightAlterationState.STOP]);
			expect(statesAt(poisoned, FightAlterations.POISONED, [4], { mathRandom: 0.35 })).toEqual([FightAlterationState.ACTIVE]);
		});
	});

	describe("burned", () => {
		it("hurts the fighter according to the attack of the opponent and the defense of the fighter", () => {
			expect([
				damagesAt(burned, FightAlterations.BURNED, { alterationTurn: 1 }),
				damagesAt(burned, FightAlterations.BURNED, {
					alterationTurn: 1, affected: {
						...AFFECTED, defense: 2000
					}
				})
			]).toEqual([77, 47]);
			expect(damagesAt(burned, FightAlterations.BURNED, {
				alterationTurn: 1, opponent: enchantedOpponent(FightAlterations.BURNED)
			})).toBe(154);
		});

		it("may heal from the second turn and nearly always heals from the third one", () => {
			expect(statesAt(burned, FightAlterations.BURNED, [1, 2, 3], { bool: true })).toEqual([FightAlterationState.ACTIVE, FightAlterationState.STOP, FightAlterationState.STOP]);
			expect(statesAt(burned, FightAlterations.BURNED, [2, 3], { bool: false })).toEqual([FightAlterationState.ACTIVE, FightAlterationState.ACTIVE]);
			expect(statesAt(burned, FightAlterations.BURNED, [3], { bool: probability => probability === 0.1 })).toEqual([FightAlterationState.ACTIVE]);
		});

		it("does not hurt a monster made of water", () => {
			fixFightRandomness();
			const waterSpirit = new MonsterFighter(50, monsterById("waterSpirit"));
			waterSpirit.newAlteration(alteration(FightAlterations.BURNED));

			const result = burned(waterSpirit, alteration(FightAlterations.BURNED), new TestFighter(OPPONENT), 5, NO_FIGHT);

			expect([result.state, result.damages, waterSpirit.alteration]).toEqual([FightAlterationState.STOP, undefined, null]);
		});
	});

	describe("bleeding", () => {
		it("hurts the fighter less and less, then stops after three turns", () => {
			expect([1, 2, 3].map(alterationTurn => damagesAt(bleeding, FightAlterations.BLEEDING, { alterationTurn }))).toEqual([77, 51, 26]);
			expect(statesAt(bleeding, FightAlterations.BLEEDING, [3, 4])).toEqual([FightAlterationState.ACTIVE, FightAlterationState.STOP]);
		});

		it("stops when the fighter rests, except on the first turn", () => {
			const restingAt = (alterationTurn: number): FightAlterationState => sufferFrom(bleeding, FightAlterations.BLEEDING, {
				alterationTurn, affectedHistory: [PLAYER_ACTIONS.RESTING]
			}).result.state;

			expect([restingAt(1), restingAt(2)]).toEqual([FightAlterationState.ACTIVE, FightAlterationState.STOP]);
			expect(sufferFrom(bleeding, FightAlterations.BLEEDING, {
				alterationTurn: 2, affectedHistory: [PLAYER_ACTIONS.SIMPLE_ATTACK]
			}).result.state).toBe(FightAlterationState.ACTIVE);
		});

		it("hurts the fighter less when inflicted by a weak opponent", () => {
			const weakOpponent = (): TestFighter => new TestFighter({
				...OPPONENT, attack: 20
			});

			expect([1, 2, 3].map(alterationTurn => damagesAt(bleeding, FightAlterations.BLEEDING, {
				alterationTurn, opponent: weakOpponent()
			}))).toEqual([58, 39, 19]);
		});

		it.each(["skeleton", "rockGolem", "magmaTitan", "shinyElementary", "celestialGuardian", "yukiOnna"])("does not hurt the %s, a monster without blood", monsterId => {
			fixFightRandomness();
			const monster = new MonsterFighter(50, monsterById(monsterId));
			monster.newAlteration(alteration(FightAlterations.BLEEDING));

			expect(bleeding(monster, alteration(FightAlterations.BLEEDING), new TestFighter(OPPONENT), 5, NO_FIGHT).state).toBe(FightAlterationState.STOP);
		});

		it("hurts a monster with blood", () => {
			fixFightRandomness();
			const monster = new MonsterFighter(50, monsterById("captainCrow"));
			monster.newAlteration(alteration(FightAlterations.BLEEDING));
			monster.alterationTurn = 1;

			expect(bleeding(monster, alteration(FightAlterations.BLEEDING), new TestFighter(OPPONENT), 5, NO_FIGHT).state).toBe(FightAlterationState.ACTIVE);
		});
	});

	describe("frozen", () => {
		it("slows the fighter once and hurts it more when it lacks breath", () => {
			const breathless = sufferFrom(frozen, FightAlterations.FROZEN, {
				alterationTurn: 1, affected: {
					...AFFECTED, breath: 0
				}
			});
			const breathing = sufferFrom(frozen, FightAlterations.FROZEN, {
				alterationTurn: 1, affected: {
					...AFFECTED, breath: 12
				}
			});

			expect([breathless.result.state, breathless.affected.getSpeed()]).toEqual([FightAlterationState.ACTIVE, 32]);
			expect(breathless.result.buffs?.[0].selfTarget).toBe(true);
			expect([breathless.result.damages, breathing.result.damages]).toEqual([95, 33]);
			expect([
				damagesAt(frozen, FightAlterations.FROZEN, {
					alterationTurn: 1, opponent: enchantedOpponent(FightAlterations.FROZEN)
				}),
				damagesAt(frozen, FightAlterations.FROZEN, {
					alterationTurn: 1, opponent: boostedOpponent()
				})
			]).toEqual([164, 82]);
		});

		it("does not slow the fighter twice", () => {
			const { affected } = sufferFrom(frozen, FightAlterations.FROZEN, { alterationTurn: 1 });
			affected.alterationTurn = 2;

			const result = frozen(affected, alteration(FightAlterations.FROZEN), new TestFighter(OPPONENT), 6, NO_FIGHT);

			expect([result.buffs, affected.getSpeed()]).toEqual([undefined, 32]);
		});

		it("may heal from the third turn and gives the speed back", () => {
			expect(statesAt(frozen, FightAlterations.FROZEN, [2, 3], { bool: true })).toEqual([FightAlterationState.ACTIVE, FightAlterationState.STOP]);
			expect(statesAt(frozen, FightAlterations.FROZEN, [3], { bool: false })).toEqual([FightAlterationState.ACTIVE]);
			const { affected } = sufferFrom(frozen, FightAlterations.FROZEN, { alterationTurn: 1 });
			affected.alterationTurn = 3;
			vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(true);
			frozen(affected, alteration(FightAlterations.FROZEN), new TestFighter(OPPONENT), 7, NO_FIGHT);
			expect(affected.getSpeed()).toBe(AFFECTED.speed);
		});

		it("heals after a fire attack of the fighter, except on the first turn", () => {
			const afterFireAttack = (alterationTurn: number): FightAlterationState => sufferFrom(frozen, FightAlterations.FROZEN, {
				alterationTurn, affectedHistory: [PLAYER_ACTIONS.FIRE_ATTACK]
			}).result.state;

			expect([afterFireAttack(1), afterFireAttack(2)]).toEqual([FightAlterationState.ACTIVE, FightAlterationState.STOP]);
		});
	});

	describe("cursed", () => {
		it("does nothing during the first two turns", () => {
			expect(sufferFrom(cursed, FightAlterations.CURSED, {
				alterationTurn: 2, rolls: { mathRandom: 0 }
			}).result).toEqual({ state: FightAlterationState.ACTIVE });
		});

		const curseDamage = (alterationTurn: number, turn: number): number | undefined => damagesAt(cursed, FightAlterations.CURSED, {
			alterationTurn, turn, rolls: { mathRandom: 0.49 }
		});

		it("may end from the third turn with damage growing with the length of the fight", () => {
			expect([curseDamage(3, 5), curseDamage(3, 20), curseDamage(3, FightConstants.MAX_TURNS), curseDamage(3, 40)]).toEqual([180, 267, 302, 302]);
			expect(damagesAt(cursed, FightAlterations.CURSED, {
				alterationTurn: 3, opponent: boostedOpponent(), rolls: { mathRandom: 0.49 }
			})).toBe(180);
			expect(statesAt(cursed, FightAlterations.CURSED, [3], { mathRandom: 0.5 })).toEqual([FightAlterationState.ACTIVE]);
		});

		// Bug: the alteration is removed (alterationTurn reset to 0) before its length is read, so the bonus for a long curse is always 0
		it.fails("deals more damage the longer the curse lasted", () => {
			expect(curseDamage(4, 5)).toBeGreaterThan(required(curseDamage(3, 5), "curse damage"));
		});

		it("always ends on its fifth turn", () => {
			expect(statesAt(cursed, FightAlterations.CURSED, [4, 5], { mathRandom: 0.99 })).toEqual([FightAlterationState.ACTIVE, FightAlterationState.STOP]);
		});
	});

	describe("confused", () => {
		it("ends after three turns", () => {
			expect(statesAt(confused, FightAlterations.CONFUSED, [3], { bool: true })).toEqual([FightAlterationState.STOP]);
			expect(statesAt(confused, FightAlterations.CONFUSED, [4], { bool: false })).toEqual([FightAlterationState.STOP]);
			expect(statesAt(confused, FightAlterations.CONFUSED, [3], { bool: false })).toEqual([FightAlterationState.ACTIVE]);
		});

		it("may only end early on its third turn", () => {
			expect(statesAt(confused, FightAlterations.CONFUSED, [2], { bool: probability => probability === undefined })).toEqual([FightAlterationState.ACTIVE]);
		});

		it("makes the fighter use a random action", () => {
			fixFightRandomness();
			const affected = new TestFighter(AFFECTED);
			const randomAction = fightActionById(PLAYER_ACTIONS.QUICK_ATTACK);
			affected.availableFightActions.set(randomAction.id, randomAction);
			affected.alterationTurn = 1;
			vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockImplementation(probability => probability === 0.6);

			const result = confused(affected, alteration(FightAlterations.CONFUSED), new TestFighter(OPPONENT), 5, NO_FIGHT);

			expect([result.state, affected.nextFightAction]).toEqual([FightAlterationState.RANDOM_ACTION, randomAction]);
		});

		it("sometimes makes the fighter hurt itself instead of acting", () => {
			fixFightRandomness();
			const affected = new TestFighter(AFFECTED);
			affected.alterationTurn = 1;
			vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockImplementation(probability => probability === 0.5);

			const result = confused(affected, alteration(FightAlterations.CONFUSED), new TestFighter(OPPONENT), 5, NO_FIGHT);

			expect([result.state, result.damages, affected.nextFightAction?.id]).toEqual([FightAlterationState.ACTIVE, 33, PLAYER_ACTIONS.NONE]);
		});

		it("otherwise lets the fighter act normally", () => {
			const { affected, result } = sufferFrom(confused, FightAlterations.CONFUSED, { alterationTurn: 1 });

			expect([result, affected.nextFightAction]).toEqual([{ state: FightAlterationState.ACTIVE }, null]);
		});
	});

	describe("targeted", () => {
		it("only announces the boomerang on its first and third turns", () => {
			expect(statesAt(targeted, FightAlterations.TARGETED, [1, 3], { bool: true })).toEqual([FightAlterationState.NEW, FightAlterationState.NEW]);
		});

		it("hits the fighter with the boomerang on the other turns", () => {
			expect([2, 4].map(alterationTurn => damagesAt(targeted, FightAlterations.TARGETED, { alterationTurn }))).toEqual([164, 164]);
		});

		it("ends after four turns, or sometimes earlier", () => {
			expect(statesAt(targeted, FightAlterations.TARGETED, [5])).toEqual([FightAlterationState.STOP]);
			expect(statesAt(targeted, FightAlterations.TARGETED, [2, 4], { bool: true })).toEqual([FightAlterationState.STOP, FightAlterationState.STOP]);
			expect(statesAt(targeted, FightAlterations.TARGETED, [2, 4], { bool: probability => probability === 0.15 })).toEqual([FightAlterationState.ACTIVE, FightAlterationState.STOP]);
		});
	});
});
