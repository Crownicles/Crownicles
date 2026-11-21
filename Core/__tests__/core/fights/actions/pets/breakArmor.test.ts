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

import breakArmor from "../../../../../src/core/fights/actions/interfaces/pets/breakArmor";
import { RandomUtils } from "../../../../../../Lib/src/utils/RandomUtils";
import { PetAssistanceState } from "../../../../../../Lib/src/types/PetAssistanceResult";
import { FightStatModifierOperation } from "../../../../../../Lib/src/types/FightStatModifierOperation";
import type { FightController } from "../../../../../src/core/fights/FightController";
import type { PlayerBaseFighter } from "../../../../../src/core/fights/fighter/PlayerBaseFighter";
import type { Fighter } from "../../../../../src/core/fights/fighter/Fighter";
import {
	buildLoadedGearFighter, getFightStats
} from "./GearFighterFixture";

function breakOpponentArmor(opponent: Fighter): ReturnType<typeof breakArmor> {
	return breakArmor({} as PlayerBaseFighter, opponent, 1, {} as FightController);
}

describe("breakArmor pet assistance", () => {
	beforeEach(() => {
		vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(false);
	});

	it("removes at most the class defense when the armor exceeds the class cap (#5075)", async () => {
		const opponent = await buildLoadedGearFighter({
			classStats: {
				attack: 10, defense: 6, speed: 10
			},
			armor: {
				attack: 0, defense: 15, speed: 0
			}
		});

		const result = await breakOpponentArmor(opponent);

		expect(result?.assistanceStatus).toBe(PetAssistanceState.SUCCESS);
		expect(getFightStats(opponent)).toEqual({
			attack: 10, defense: 6, speed: 10
		});
	});

	it("removes the armor speed scaled by its speed enchantment, which keeps scaling the remaining speed", async () => {
		const opponent = await buildLoadedGearFighter({
			classStats: {
				attack: 100, defense: 100, speed: 100
			},
			armor: {
				attack: 0, defense: 40, speed: 50
			},
			armorEnchantmentId: "speed3"
		});
		expect(opponent.getSpeed()).toBe(180);

		await breakOpponentArmor(opponent);

		expect(opponent.getSpeed()).toBe(120);
	});

	it("keeps the stats usable when the opponent has no speed left (#4883)", async () => {
		const opponent = await buildLoadedGearFighter({
			classStats: {
				attack: 300, defense: 80, speed: 40
			},
			armor: {
				attack: -36, defense: 170, speed: 15
			}
		});
		opponent.applySpeedModifier({
			origin: null, operation: FightStatModifierOperation.MULTIPLIER, value: 0
		});

		const result = await breakOpponentArmor(opponent);

		expect(result?.assistanceStatus).toBe(PetAssistanceState.SUCCESS);
		expect(getFightStats(opponent)).toEqual({
			attack: 300, defense: 80, speed: 0
		});
	});

	it("never turns a stat negative when the armor share exceeds the current stat", async () => {
		const opponent = await buildLoadedGearFighter({
			classStats: {
				attack: 300, defense: 100, speed: 50
			},
			armor: {
				attack: 0, defense: 150, speed: 80
			}
		});
		opponent.applyDefenseModifier({
			origin: null, operation: FightStatModifierOperation.MULTIPLIER, value: 0.5
		});
		opponent.applySpeedModifier({
			origin: null, operation: FightStatModifierOperation.MULTIPLIER, value: 0.5
		});

		await breakOpponentArmor(opponent);

		expect(getFightStats(opponent)).toEqual({
			attack: 300, defense: 0, speed: 0
		});
	});
});
