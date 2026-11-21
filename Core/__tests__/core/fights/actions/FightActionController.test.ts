import {
	afterAll, afterEach, beforeAll, describe, expect, it, vi
} from "vitest";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { FightActionController } from "../../../../src/core/fights/actions/FightActionController";
import type { Fighter } from "../../../../src/core/fights/fighter/Fighter";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import {
	defaultFightActionResult, FightStatBuffed
} from "../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../Lib/src/types/FightStatModifierOperation";
import { TestFighter } from "./players/TestFighter";
import { FightActionStatus } from "../../../../../Lib/src/types/FightActionStatus";
import {
	FightAction, FightActionDataController
} from "../../../../src/data/FightAction";
import { FightActionType } from "../../../../../Lib/src/types/FightActionType";
import { FightAlterations } from "../../../../src/core/fights/actions/FightAlterations";
import simpleAttack from "../../../../src/core/fights/actions/interfaces/players/simpleAttack";
import { simpleDamageFightAction } from "../../../../src/core/fights/actions/templates/SimpleDamageFightActionTemplate";
import { simpleBuffFightAction } from "../../../../src/core/fights/actions/templates/SimpleBuffFightActionTemplate";
import type { FightController } from "../../../../src/core/fights/FightController";
import { fixFightRandomness } from "./FightRandomness";
import {
	fightActionById, fightAlterationById, required
} from "../FightTestData";

function buildFighter(level: number): Fighter {
	return { level } as Fighter;
}

describe("FightActionController.getAttackDamage", () => {
	let variationIntSpy: ReturnType<typeof vi.spyOn>;

	beforeAll(() => {
		variationIntSpy = vi.spyOn(RandomUtils, "variationInt").mockReturnValue(0);
	});

	afterAll(() => {
		variationIntSpy.mockRestore();
	});

	const statsInfo = {
		attackerStats: [100], defenderStats: [100], statsEffect: [1]
	};
	const attackInfo = {
		minDamage: 10, averageDamage: 50, maxDamage: 100
	};

	it("applies the level bonus of the fighter passed as attacker, not any other fighter", () => {
		const lowLevelFighter = buildFighter(1);
		const highLevelFighter = buildFighter(100);

		const damageWithLowLevelAttacker = FightActionController.getAttackDamage(statsInfo, lowLevelFighter, attackInfo, true);
		const damageWithHighLevelAttacker = FightActionController.getAttackDamage(statsInfo, highLevelFighter, attackInfo, true);

		// A higher attacker level must yield a strictly higher level bonus (regression test for #4401:
		// alteration damage was previously computed using the victim's level instead of the original attacker's)
		expect(damageWithHighLevelAttacker).toBeGreaterThan(damageWithLowLevelAttacker);
	});
});

describe("FightActionController.applyBuff", () => {
	function healFighter(alterationId: string | null): {
		healed: number; recorded: number;
	} {
		const fighter = new TestFighter({ energy: 500 });
		if (alterationId) {
			fighter.newAlteration(fightAlterationById(alterationId));
		}
		const result = defaultFightActionResult();
		FightActionController.applyBuff(result, {
			selfTarget: true,
			stat: FightStatBuffed.ENERGY,
			operator: FightStatModifierOperation.ADDITION,
			value: 100
		}, fighter, null);
		return {
			healed: fighter.getEnergy() - 500,
			recorded: result.buffs![0].value
		};
	}

	it("reduces the healing of a cursed fighter and records the energy it actually gains", () => {
		expect(healFighter(FightConstants.FIGHT_ACTIONS.ALTERATION.CURSED)).toEqual({
			healed: 70, recorded: 70
		});
	});

	it("leaves the healing of a fighter with another alteration untouched", () => {
		expect(healFighter(FightConstants.FIGHT_ACTIONS.ALTERATION.POISONED)).toEqual({
			healed: 100, recorded: 100
		});
	});
});

// Level whose bonus ratio is exactly 0: the damage is the one computed from the stats
const NEUTRAL_LEVEL = FightConstants.MAX_PLAYER_LEVEL_FOR_BONUSES / 2;

describe("FightActionController damage formula", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	const attackInfo = {
		minDamage: 10, averageDamage: 50, maxDamage: 100
	};
	const strongerAttacker = {
		attackerStats: [400], defenderStats: [100], statsEffect: [1]
	};
	const weakerAttacker = {
		attackerStats: [100], defenderStats: [400], statsEffect: [1]
	};

	function damage(stats: typeof strongerAttacker, level = NEUTRAL_LEVEL, attacker = new TestFighter({ level })): number {
		return FightActionController.getAttackDamage(stats, attacker, attackInfo);
	}

	it("picks the damage above the average for a stronger attacker and below it for a weaker one", () => {
		fixFightRandomness();

		expect([damage(strongerAttacker), damage(weakerAttacker), damage({
			attackerStats: [250], defenderStats: [250], statsEffect: [1]
		})]).toEqual([91, 17, 50]);
	});

	it("sums the damage of every stat weighted by its effect", () => {
		fixFightRandomness();

		expect(damage({
			attackerStats: [400, 100], defenderStats: [100, 400], statsEffect: [0.7, 0.3]
		})).toBe(69);
	});

	it("keeps the damage of each stat between the minimum and the maximum of the attack", () => {
		fixFightRandomness();
		const unroundedBounds = {
			minDamage: 10.4, averageDamage: 50, maxDamage: 100.6
		};
		const overwhelming = FightActionController.getAttackDamage({
			attackerStats: [5000], defenderStats: [0], statsEffect: [10]
		}, new TestFighter({ level: NEUTRAL_LEVEL }), unroundedBounds);
		const overwhelmed = FightActionController.getAttackDamage({
			attackerStats: [0], defenderStats: [5000], statsEffect: [10]
		}, new TestFighter({ level: NEUTRAL_LEVEL }), unroundedBounds);

		expect([overwhelming, overwhelmed]).toEqual([1006, 104]);
	});

	it("varies the damage by a few percents", () => {
		vi.spyOn(RandomUtils, "variationInt").mockReturnValue(5);
		const raised = damage(strongerAttacker);
		vi.spyOn(RandomUtils, "variationInt").mockReturnValue(-5);
		const lowered = damage(strongerAttacker);

		expect([raised, lowered]).toEqual([96, 86]);
		expect(RandomUtils.variationInt).toHaveBeenCalledWith(FightConstants.DAMAGE_RANDOM_VARIATION);
	});

	it("gives a malus to low level attackers and a capped bonus to high level ones", () => {
		fixFightRandomness();

		expect([0, 50, 75, 150].map(level => damage(strongerAttacker, level))).toEqual([41, 108, 141, 141]);
	});

	it("multiplies the damage by the damage boosts of the attacker unless told to ignore them", () => {
		fixFightRandomness();
		const boosted = new TestFighter({ level: NEUTRAL_LEVEL });
		boosted.applyDamageMultiplier(2, 1);

		expect([
			FightActionController.getAttackDamage(strongerAttacker, boosted, attackInfo),
			FightActionController.getAttackDamage(strongerAttacker, boosted, attackInfo, true)
		]).toEqual([182, 91]);
	});
});

describe("FightActionController.applySecondaryEffects", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	function hitAtRoll(roll: number): ReturnType<typeof FightActionController.applySecondaryEffects> {
		fixFightRandomness({ secondaryEffectRoll: roll });
		return FightActionController.applySecondaryEffects(100, 10, 20);
	}

	it("lands a critical hit below the critical probability, dealing half more damage", () => {
		expect([hitAtRoll(0), hitAtRoll(9)]).toEqual([{
			damages: 150, status: FightActionStatus.CRITICAL
		}, {
			damages: 150, status: FightActionStatus.CRITICAL
		}]);
		expect(RandomUtils.randInt).toHaveBeenCalledWith(0, 100);
	});

	it("misses between the critical probability and the sum of both probabilities, dealing a fraction of the damage", () => {
		expect([hitAtRoll(10), hitAtRoll(29)]).toEqual([{
			damages: 25, status: FightActionStatus.MISSED
		}, {
			damages: 25, status: FightActionStatus.MISSED
		}]);
	});

	it("divides the damage of a miss by one of the failure dividers", () => {
		fixFightRandomness({ secondaryEffectRoll: 10 });
		vi.spyOn(RandomUtils.crowniclesRandom, "pick").mockReturnValue(0.2);

		expect(FightActionController.applySecondaryEffects(100, 10, 20).damages).toBe(20);
		expect(RandomUtils.crowniclesRandom.pick).toHaveBeenCalledWith(FightConstants.FAILURE_DIVIDERS);
	});

	it("hits normally above both probabilities", () => {
		expect(hitAtRoll(30)).toEqual({
			damages: 100, status: FightActionStatus.NORMAL
		});
	});
});

describe("FightActionController.applyBuff on every stat", () => {
	const ORIGIN = fightActionById(FightConstants.FIGHT_ACTIONS.PLAYER.DEFENSE_BUFF);

	function buff(fighter: TestFighter, stat: FightStatBuffed, value: number, options: {
		operator?: FightStatModifierOperation; duration?: number;
	} = {}): ReturnType<typeof defaultFightActionResult> {
		const result = defaultFightActionResult();
		FightActionController.applyBuff(result, {
			selfTarget: true,
			stat,
			operator: options.operator ?? FightStatModifierOperation.ADDITION,
			value,
			...options.duration === undefined ? {} : { duration: options.duration }
		}, fighter, ORIGIN);
		return result;
	}

	it("modifies the attack, the defense and the speed with a modifier removable by its origin", () => {
		const fighter = new TestFighter({
			attack: 100, defense: 100, speed: 100
		});

		buff(fighter, FightStatBuffed.ATTACK, 20);
		buff(fighter, FightStatBuffed.DEFENSE, 2, { operator: FightStatModifierOperation.MULTIPLIER });
		buff(fighter, FightStatBuffed.SPEED, 40, { operator: FightStatModifierOperation.SET_VALUE });

		expect([fighter.getAttack(), fighter.getDefense(), fighter.getSpeed()]).toEqual([120, 200, 40]);
		fighter.removeAttackModifiers(ORIGIN);
		fighter.removeDefenseModifiers(ORIGIN);
		fighter.removeSpeedModifiers(ORIGIN);
		expect([fighter.getAttack(), fighter.getDefense(), fighter.getSpeed()]).toEqual([100, 100, 100]);
	});

	it("gives breath, heals and damages the fighter", () => {
		const fighter = new TestFighter({
			energy: 500, breath: 5
		});

		buff(fighter, FightStatBuffed.BREATH, 3);
		buff(fighter, FightStatBuffed.ENERGY, 100);
		buff(fighter, FightStatBuffed.DAMAGE, 30);

		expect([fighter.getBreath(), fighter.getEnergy()]).toEqual([8, 570]);
	});

	it("boosts the damage and the breath regeneration for one turn by default", () => {
		const fighter = new TestFighter();

		buff(fighter, FightStatBuffed.DAMAGE_BOOST, 1.5);
		buff(fighter, FightStatBuffed.BREATH_REGEN, 2);
		expect([fighter.getDamageMultiplier(), fighter.getRegenBreath()]).toEqual([1.5, 6]);

		fighter.reduceCounters();
		expect([fighter.getDamageMultiplier(), fighter.getRegenBreath()]).toEqual([1.5, 4]);
		fighter.reduceCounters();
		expect(fighter.getDamageMultiplier()).toBe(1);
	});

	it("keeps the boosts for the requested duration", () => {
		const fighter = new TestFighter();

		buff(fighter, FightStatBuffed.DAMAGE_BOOST, 1.5, { duration: 2 });
		buff(fighter, FightStatBuffed.BREATH_REGEN, 2, { duration: 2 });
		fighter.reduceCounters();
		expect(fighter.getRegenBreath()).toBe(6);
		fighter.reduceCounters();

		expect([fighter.getDamageMultiplier(), fighter.getRegenBreath()]).toEqual([1.5, 4]);
	});

	it("records every applied buff, in order, but not the unhandled ones", () => {
		const fighter = new TestFighter();
		const result = defaultFightActionResult();
		const applied = (stat: FightStatBuffed): void => FightActionController.applyBuff(result, {
			selfTarget: false, stat, operator: FightStatModifierOperation.ADDITION, value: 1
		}, fighter, null);

		applied(FightStatBuffed.ATTACK);
		applied(FightStatBuffed.SUMMON);
		applied(FightStatBuffed.BREATH);

		expect(result.buffs?.map(recordedBuff => recordedBuff.stat)).toEqual([FightStatBuffed.ATTACK, FightStatBuffed.BREATH]);
	});

	it("only reduces the healing of a cursed fighter, not its other buffs nor its energy losses", () => {
		const fighter = new TestFighter({ energy: 500 });
		fighter.newAlteration(fightAlterationById(FightConstants.FIGHT_ACTIONS.ALTERATION.CURSED));

		const defenseBuff = buff(fighter, FightStatBuffed.DEFENSE, 100);
		const energyLoss = buff(fighter, FightStatBuffed.ENERGY, -100);

		expect([fighter.getDefense(), fighter.getEnergy()]).toEqual([200, 400]);
		expect([defenseBuff.buffs?.[0].value, energyLoss.buffs?.[0].value]).toEqual([100, -100]);
	});
});

describe("FightActionController.applyAlteration", () => {
	const alterationOf = (alteration: string): {
		selfTarget: boolean; alteration: string;
	} => ({
		selfTarget: false, alteration
	});

	it("records every alteration actually inflicted", () => {
		const result = defaultFightActionResult();
		const sender = new TestFighter();
		const receiver = new TestFighter();

		FightActionController.applyAlteration(result, alterationOf(FightAlterations.POISONED), receiver);
		FightActionController.applyAlteration(result, alterationOf(FightAlterations.STUNNED), sender);

		expect(result.alterations).toEqual([alterationOf(FightAlterations.POISONED), alterationOf(FightAlterations.STUNNED)]);
		expect([receiver.alteration?.id, sender.alteration?.id]).toEqual([FightAlterations.POISONED, FightAlterations.STUNNED]);
	});

	it("ignores an unknown alteration", () => {
		const result = defaultFightActionResult();
		const receiver = new TestFighter();

		FightActionController.applyAlteration(result, alterationOf("unknownAlteration"), receiver);

		expect([result.alterations, receiver.alteration]).toEqual([undefined, null]);
	});

	it("does not record an alteration the target resists because of another one, nor an unknown one", () => {
		const result = defaultFightActionResult();
		const receiver = new TestFighter();
		receiver.newAlteration(fightAlterationById(FightAlterations.BURNED));

		FightActionController.applyAlteration(result, alterationOf(FightAlterations.POISONED), receiver);
		FightActionController.applyAlteration(result, alterationOf("unknownAlteration"), receiver);

		expect(result.alterations).toBeUndefined();
		expect(receiver.alteration?.id).toBe(FightAlterations.BURNED);
	});
});

describe("FightActionController.applyResistance", () => {
	it("makes the target resist the damage of a type for one turn by default and records it", () => {
		const result = defaultFightActionResult();
		const target = new TestFighter();
		const resistance = {
			selfTarget: true, type: FightActionType.PHYSICAL, value: 0.4
		};

		FightActionController.applyResistance(result, resistance, target);
		FightActionController.applyResistance(result, {
			...resistance, type: FightActionType.MAGIC, duration: 2, reflectDamage: true
		}, target);

		expect(result.resistances).toHaveLength(2);
		expect([target.getResistanceMultiplier(FightActionType.PHYSICAL), target.getResistanceMultiplier(FightActionType.MAGIC)]).toEqual([0.6, 0.6]);
		expect([target.getReflectedDamage(FightActionType.PHYSICAL, 100), target.getReflectedDamage(FightActionType.MAGIC, 100)]).toEqual([0, 40]);
		target.reduceCounters();
		expect([target.getResistanceMultiplier(FightActionType.PHYSICAL), target.getResistanceMultiplier(FightActionType.MAGIC)]).toEqual([1, 0.6]);
	});
});

describe("FightActionController.useSecondAttack", () => {
	const SIMPLE_ATTACK = fightActionById(FightConstants.FIGHT_ACTIONS.PLAYER.SIMPLE_ATTACK);
	// The second attack is played outside of any fight: the simple attack never reads the fight controller
	const NO_FIGHT = null as unknown as FightController;

	afterEach(() => {
		vi.restoreAllMocks();
	});

	// The fight action functions are loaded from the compiled players and monsters folders: only those are known
	function loadPlayerAttacks(): void {
		vi.spyOn(FightActionDataController, "getFightActionFunction").mockImplementation(id => (id === SIMPLE_ATTACK.id ? simpleAttack : undefined));
	}

	it("uses the chosen attack and pays its breath", () => {
		fixFightRandomness();
		loadPlayerAttacks();
		const sender = new TestFighter({ breath: 10 });
		const receiver = new TestFighter({ energy: 1000 });

		const result = FightActionController.useSecondAttack(sender, receiver, SIMPLE_ATTACK, 3, NO_FIGHT);

		expect(result.usedAction?.id).toBe(SIMPLE_ATTACK.id);
		expect(sender.getBreath()).toBe(10 - SIMPLE_ATTACK.breath);
		expect(receiver.getEnergy()).toBe(1000 - required(result.usedAction?.result.damages, "damage of the used attack"));
	});

	it("never runs out of breath when the sender has exactly the breath of the attack", () => {
		fixFightRandomness({ mathRandom: 0 });
		loadPlayerAttacks();
		const sender = new TestFighter({ breath: SIMPLE_ATTACK.breath });

		const result = FightActionController.useSecondAttack(sender, new TestFighter(), SIMPLE_ATTACK, 3, NO_FIGHT);

		expect([result.usedAction?.id, sender.getBreath()]).toEqual([SIMPLE_ATTACK.id, 0]);
	});

	it("still uses the chosen attack with all its breath when the sender barely lacks breath", () => {
		fixFightRandomness({ mathRandom: FightConstants.OUT_OF_BREATH_FAILURE_PROBABILITY });
		loadPlayerAttacks();
		const sender = new TestFighter({ breath: SIMPLE_ATTACK.breath - 1 });

		const result = FightActionController.useSecondAttack(sender, new TestFighter(), SIMPLE_ATTACK, 3, NO_FIGHT);

		expect(result.usedAction?.id).toBe(SIMPLE_ATTACK.id);
		expect(sender.getBreath()).toBe(0);
	});

	// Bug: the out of breath action is an alteration, absent from the fight action functions: using it throws instead of failing the attack
	it.fails("makes the sender run out of breath most of the time when it lacks breath", () => {
		fixFightRandomness({ mathRandom: 0 });
		loadPlayerAttacks();
		const sender = new TestFighter({ breath: 0 });

		const result = FightActionController.useSecondAttack(sender, new TestFighter(), SIMPLE_ATTACK, 3, NO_FIGHT);

		expect(result.usedAction?.id).toBe(FightConstants.FIGHT_ACTIONS.ALTERATION.OUT_OF_BREATH);
	});
});

describe("FightActionController fight action variants", () => {
	it("converts a fight action to its mission variant and back", () => {
		const variant = FightActionController.fightActionIdToVariant(FightConstants.FIGHT_ACTIONS.PLAYER.HEAVY_ATTACK);

		expect(variant).toBe(fightActionById(FightConstants.FIGHT_ACTIONS.PLAYER.HEAVY_ATTACK).missionVariant);
		expect(FightActionController.variantToFightActionId(variant)).toBe(FightConstants.FIGHT_ACTIONS.PLAYER.HEAVY_ATTACK);
	});

	it("finds no fight action for an unknown variant", () => {
		expect(FightActionController.variantToFightActionId(123456)).toBeNull();
	});
});

describe("simpleDamageFightAction", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("multiplies the damage by the given multiplier", () => {
		fixFightRandomness();
		const fighters = {
			sender: new TestFighter({ level: NEUTRAL_LEVEL }), receiver: new TestFighter()
		};
		const info = {
			attackInfo: {
				minDamage: 10, averageDamage: 50, maxDamage: 100
			},
			statsInfo: {
				attackerStats: [100], defenderStats: [100], statsEffect: [1]
			}
		};
		const probabilities = {
			critical: 0, failure: 0
		};

		expect([
			simpleDamageFightAction(fighters, probabilities, info).damages,
			simpleDamageFightAction(fighters, probabilities, info, 3).damages
		]).toEqual([50, 150]);
	});
});

describe("simpleBuffFightAction", () => {
	it("buffs the target and records the buff", () => {
		const target = new TestFighter({ defense: 100 });
		const defenseBuff = {
			selfTarget: true, stat: FightStatBuffed.DEFENSE, operator: FightStatModifierOperation.MULTIPLIER, value: 1.5
		};

		const result = simpleBuffFightAction(target, defenseBuff, FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.DEFENSE_BUFF) as FightAction);

		expect(target.getDefense()).toBe(150);
		expect(result.buffs).toEqual([defenseBuff]);
	});
});
