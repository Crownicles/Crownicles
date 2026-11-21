import {
	beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../../src/core/database/game/models/InventorySlot", () => ({
	InventorySlots: {
		getPlayerActiveObjects: vi.fn(),
		countObjectsOfPlayer: vi.fn().mockResolvedValue(0)
	}
}));
vi.mock("../../../../src/data/FightAction", async importOriginal => ({
	...await importOriginal<typeof import("../../../../src/data/FightAction")>(),
	FightActionDataController: { instance: { getListById: vi.fn().mockReturnValue([]) } }
}));

import stealWeapon from "../../../../src/core/fights/actions/interfaces/pets/stealWeapon";
import breakArmor from "../../../../src/core/fights/actions/interfaces/pets/breakArmor";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { ZERO_STATS } from "../../../../../Lib/src/types/StatValues";
import type { FightController } from "../../../../src/core/fights/FightController";
import type { PlayerBaseFighter } from "../../../../src/core/fights/fighter/PlayerBaseFighter";
import {
	buildLoadedGearFighter, getFightStats, GearFighterSetup
} from "./pets/GearFighterFixture";

const GEAR_REMOVALS = [
	{
		name: "stealWeapon", action: stealWeapon, slot: "weapon"
	},
	{
		name: "breakArmor", action: breakArmor, slot: "armor"
	}
] as const;

const SETUPS: Record<string, GearFighterSetup> = {
	"plain gear": {
		classStats: {
			attack: 137, defense: 91, speed: 53
		},
		weapon: {
			attack: 61, defense: 7, speed: 19
		},
		armor: {
			attack: 5, defense: 73, speed: 11
		}
	},
	"gear capped by the class": {
		classStats: {
			attack: 40, defense: 30, speed: 20
		},
		weapon: {
			attack: 90, defense: 45, speed: 33
		},
		armor: {
			attack: 12, defense: 80, speed: 27
		}
	},
	"speed enchanted armor and a potion": {
		classStats: {
			attack: 137, defense: 91, speed: 53
		},
		weapon: {
			attack: 61, defense: 7, speed: 19
		},
		armor: {
			attack: 5, defense: 73, speed: 11
		},
		armorEnchantmentId: "speed1",
		potion: {
			attack: 0, defense: 0, speed: 17
		}
	},
	"speed enchanted armor in a fight without consequences": {
		classStats: {
			attack: 137, defense: 91, speed: 53
		},
		weapon: {
			attack: 61, defense: 7, speed: 19
		},
		armor: {
			attack: 5, defense: 73, speed: 11
		},
		armorEnchantmentId: "speed3",
		potion: {
			attack: 0, defense: 0, speed: 17
		},
		withoutConsequences: true
	}
};

describe("gear removal by a pet", () => {
	beforeEach(() => {
		vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(false);
	});

	describe.each(GEAR_REMOVALS)("$name", ({
		action, slot
	}) => {
		it.each(Object.entries(SETUPS))("leaves the stats of the same fighter loaded without the gear, %s", async (_name, setup) => {
			const opponent = await buildLoadedGearFighter(setup);
			const withoutGear = await buildLoadedGearFighter({
				...setup,
				[slot]: ZERO_STATS
			});

			await action({} as PlayerBaseFighter, opponent, 1, {} as FightController);

			expect(getFightStats(opponent)).toEqual(getFightStats(withoutGear));
		});
	});
});
