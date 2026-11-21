import {
	beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../../../src/core/database/game/models/InventorySlot", () => ({
	InventorySlots: {
		getPlayerActiveObjects: vi.fn(),
		countObjectsOfPlayer: vi.fn().mockResolvedValue(0)
	}
}));
vi.mock("../../../../../src/data/FightAction", async importOriginal => ({
	...await importOriginal<typeof import("../../../../../src/data/FightAction")>(),
	FightActionDataController: { instance: { getListById: vi.fn().mockReturnValue([]) } }
}));

import stealWeapon from "../../../../../src/core/fights/actions/interfaces/pets/stealWeapon";
import { RandomUtils } from "../../../../../../Lib/src/utils/RandomUtils";
import { PetAssistanceState } from "../../../../../../Lib/src/types/PetAssistanceResult";
import { FightStatModifierOperation } from "../../../../../../Lib/src/types/FightStatModifierOperation";
import type { FightController } from "../../../../../src/core/fights/FightController";
import type { PlayerBaseFighter } from "../../../../../src/core/fights/fighter/PlayerBaseFighter";
import type { Fighter } from "../../../../../src/core/fights/fighter/Fighter";
import {
	buildLoadedGearFighter, getFightStats
} from "./GearFighterFixture";

const UNCAPPED_CLASS_STATS = {
	attack: 150, defense: 150, speed: 75
};

function steal(opponent: Fighter): ReturnType<typeof stealWeapon> {
	return stealWeapon({} as PlayerBaseFighter, opponent, 1, {} as FightController);
}

describe("stealWeapon pet assistance", () => {
	beforeEach(() => {
		vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(false);
	});

	it("steals the weapon of the human player of a PvP fight and removes its share of every stat (#5064)", async () => {
		const opponent = await buildLoadedGearFighter({
			classStats: UNCAPPED_CLASS_STATS,
			weapon: {
				attack: 150, defense: 50, speed: 25
			}
		});

		const result = await steal(opponent);

		expect(result?.assistanceStatus).toBe(PetAssistanceState.SUCCESS);
		expect(getFightStats(opponent)).toEqual(UNCAPPED_CLASS_STATS);
	});

	it("removes the weapon speed scaled by the speed enchantment of the armor, which keeps scaling the remaining speed", async () => {
		const opponent = await buildLoadedGearFighter({
			classStats: {
				attack: 100, defense: 100, speed: 100
			},
			weapon: {
				attack: 30, defense: 0, speed: 50
			},
			armorEnchantmentId: "speed3"
		});
		expect(opponent.getSpeed()).toBe(180);

		await steal(opponent);

		expect(opponent.getSpeed()).toBe(120);
	});

	it("only removes the weapon stats capped by the class of the opponent (#5075)", async () => {
		const opponent = await buildLoadedGearFighter({
			classStats: {
				attack: 20, defense: 15, speed: 10
			},
			weapon: {
				attack: 60, defense: 5, speed: 30
			}
		});

		await steal(opponent);

		expect(getFightStats(opponent)).toEqual({
			attack: 20, defense: 15, speed: 10
		});
	});

	it("keeps the stats usable when the opponent has no speed left (#4982)", async () => {
		const opponent = await buildLoadedGearFighter({
			classStats: {
				attack: 180, defense: 300, speed: 40
			},
			weapon: {
				attack: 120, defense: -50, speed: 15
			}
		});
		opponent.applySpeedModifier({
			origin: null, operation: FightStatModifierOperation.MULTIPLIER, value: 0
		});

		const result = await steal(opponent);

		expect(result?.assistanceStatus).toBe(PetAssistanceState.SUCCESS);
		expect(getFightStats(opponent)).toEqual({
			attack: 180, defense: 300, speed: 0
		});
	});

	it("never turns a stat negative when the weapon share exceeds the current stat", async () => {
		const opponent = await buildLoadedGearFighter({
			classStats: {
				attack: 100, defense: 300, speed: 50
			},
			weapon: {
				attack: 150, defense: 0, speed: 80
			}
		});
		opponent.applyAttackModifier({
			origin: null, operation: FightStatModifierOperation.MULTIPLIER, value: 0.5
		});
		opponent.applySpeedModifier({
			origin: null, operation: FightStatModifierOperation.MULTIPLIER, value: 0.5
		});

		await steal(opponent);

		expect(getFightStats(opponent)).toEqual({
			attack: 0, defense: 300, speed: 0
		});
	});

	it("fails against a weapon without attack", async () => {
		const opponent = await buildLoadedGearFighter({
			classStats: UNCAPPED_CLASS_STATS,
			weapon: {
				attack: 0, defense: 40, speed: 10
			}
		});

		const result = await steal(opponent);

		expect(result?.assistanceStatus).toBe(PetAssistanceState.FAILURE);
	});
});
