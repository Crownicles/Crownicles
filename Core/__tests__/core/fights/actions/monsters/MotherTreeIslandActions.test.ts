import {
	describe, expect, it
} from "vitest";
import { MonsterFighter } from "../../../../../src/core/fights/fighter/MonsterFighter";
import { MonsterDataController } from "../../../../../src/data/Monster";
import {
	FightAction, FightActionDataController, FightActionFunc
} from "../../../../../src/data/FightAction";
import type { FightController } from "../../../../../src/core/fights/FightController";
import type { Fighter } from "../../../../../src/core/fights/fighter/Fighter";
import leechBite, { DRAINED_DAMAGE_RATIO } from "../../../../../src/core/fights/actions/interfaces/monsters/leechBite";
import { getMultiHeadBiteMultiplier } from "../../../../../src/core/fights/actions/interfaces/monsters/multiHeadBite";
import { getRegrowthMultiplier } from "../../../../../src/core/fights/actions/interfaces/monsters/regrowth";
import { getWrathOfTheForestMultiplier } from "../../../../../src/core/fights/actions/interfaces/monsters/wrathOfTheForest";
import rootBind from "../../../../../src/core/fights/actions/interfaces/monsters/rootBind";
import sporeCloud from "../../../../../src/core/fights/actions/interfaces/monsters/sporeCloud";
import { FightConstants } from "../../../../../../Lib/src/constants/FightConstants";
import { FightActionResult } from "../../../../../../Lib/src/types/FightActionResult";

const FIGHTER_LEVEL = 100;

const ATTEMPTS = 20;

const MONSTER_ACTIONS = FightConstants.FIGHT_ACTIONS.MONSTER;

const ALTERATIONS = FightConstants.FIGHT_ACTIONS.ALTERATION;

function buildFighter(monsterId: string): MonsterFighter {
	return new MonsterFighter(FIGHTER_LEVEL, MonsterDataController.instance.getById(monsterId)!);
}

function getFightAction(id: string): FightAction {
	return FightActionDataController.instance.getById(id)!;
}

function useAction(action: FightActionFunc, fighters: { sender: Fighter; receiver: Fighter }, actionId: string): FightActionResult {
	return action(fighters.sender, fighters.receiver, getFightAction(actionId), 1, null as unknown as FightController);
}

function woundToEnergyRatio(fighter: Fighter, ratio: number): void {
	fighter.damage(fighter.getEnergy() - Math.round(fighter.getMaxEnergy() * ratio));
}

describe("Mother Tree island fight actions", () => {
	it("leech bite drains half of the damage dealt as energy for the leech", () => {
		for (let i = 0; i < ATTEMPTS; i++) {
			const leech = buildFighter("giantLeech");
			woundToEnergyRatio(leech, 0.2);
			const energyBefore = leech.getEnergy();

			const result = useAction(leechBite, {
				sender: leech,
				receiver: buildFighter("corruptedSylvan")
			}, MONSTER_ACTIONS.LEECH_BITE);

			expect(leech.getEnergy() - energyBefore).toBe(Math.round((result.damages ?? 0) * DRAINED_DAMAGE_RATIO));
		}
	});

	it("multi-head bite grows with each regrowth of the hydra, up to a cap", () => {
		const hydra = buildFighter("swampHydra");
		const regrowth = getFightAction(MONSTER_ACTIONS.REGROWTH);
		const multipliers = [getMultiHeadBiteMultiplier(hydra)];
		for (let i = 0; i < 6; i++) {
			hydra.fightActionsHistory.push(regrowth);
			multipliers.push(getMultiHeadBiteMultiplier(hydra));
		}

		expect(multipliers[0]).toBe(1);
		expect(multipliers[1]).toBeGreaterThan(multipliers[0]);
		for (let i = 1; i < multipliers.length; i++) {
			expect(multipliers[i]).toBeGreaterThanOrEqual(multipliers[i - 1]);
		}
		expect(multipliers[multipliers.length - 1]).toBe(multipliers[multipliers.length - 2]);
	});

	it("regrowth heals more once the sender is under half of its energy", () => {
		const motherTree = buildFighter("motherTree");
		const healthyMultiplier = getRegrowthMultiplier(motherTree);
		woundToEnergyRatio(motherTree, 0.4);

		expect(healthyMultiplier).toBe(1);
		expect(getRegrowthMultiplier(motherTree)).toBeGreaterThan(healthyMultiplier);
	});

	it("wrath of the forest grows with the missing energy of the Mother Tree", () => {
		const motherTree = buildFighter("motherTree");
		const fullEnergyMultiplier = getWrathOfTheForestMultiplier(motherTree);
		woundToEnergyRatio(motherTree, 0.5);
		const halfEnergyMultiplier = getWrathOfTheForestMultiplier(motherTree);
		woundToEnergyRatio(motherTree, 0.1);

		expect(fullEnergyMultiplier).toBe(1);
		expect(halfEnergyMultiplier).toBeGreaterThan(fullEnergyMultiplier);
		expect(getWrathOfTheForestMultiplier(motherTree)).toBeGreaterThan(halfEnergyMultiplier);
	});

	it("root bind paralyzes the opponent", () => {
		const opponent = buildFighter("orchidMantis");

		useAction(rootBind, {
			sender: buildFighter("corruptedSylvan"),
			receiver: opponent
		}, MONSTER_ACTIONS.ROOT_BIND);

		expect(opponent.alteration?.id).toBe(ALTERATIONS.PARALYZED);
	});

	it("spore cloud either poisons or confuses the opponent", () => {
		for (let i = 0; i < ATTEMPTS; i++) {
			const opponent = buildFighter("orchidMantis");

			useAction(sporeCloud, {
				sender: buildFighter("mycelialLord"),
				receiver: opponent
			}, MONSTER_ACTIONS.SPORE_CLOUD);

			expect([ALTERATIONS.POISONED, ALTERATIONS.CONFUSED]).toContain(opponent.alteration?.id);
		}
	});
});
