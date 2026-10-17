import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import breakArmor from "../../../../../src/core/fights/actions/interfaces/pets/breakArmor";
import { PlayerFighter } from "../../../../../src/core/fights/fighter/PlayerFighter";
import { InventorySlots } from "../../../../../src/core/database/game/models/InventorySlot";
import { RandomUtils } from "../../../../../../Lib/src/utils/RandomUtils";
import { PetAssistanceState } from "../../../../../../Lib/src/types/PetAssistanceResult";
import type { FightController } from "../../../../../src/core/fights/FightController";
import type { Fighter } from "../../../../../src/core/fights/fighter/Fighter";

type ArmorStats = {
	attack: number;
	defense: number;
	speed: number;
};

function buildOpponent(stats: ArmorStats): PlayerFighter {
	return Object.assign(Object.create(PlayerFighter.prototype) as PlayerFighter, {
		player: { id: 1 },
		stats: { ...stats },
		attackModifiers: [],
		defenseModifiers: [],
		speedModifiers: []
	});
}

function mockArmor(armor: ArmorStats): void {
	vi.spyOn(InventorySlots, "getMainSlotsItems").mockResolvedValue({
		armor: {
			itemLevel: 0,
			item: {
				getAttack: () => armor.attack,
				getDefense: () => armor.defense,
				getSpeed: () => armor.speed
			}
		}
	} as never);
}

describe("breakArmor pet assistance", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(false);
	});

	it("keeps the stats usable when the opponent has no speed left (#4883)", async () => {
		const opponent = buildOpponent({
			attack: 300, defense: 250, speed: 0
		});
		mockArmor({
			attack: -36, defense: 170, speed: 15
		});

		const result = await breakArmor({} as Fighter, opponent, 1, {} as FightController);

		expect(result?.assistanceStatus).toBe(PetAssistanceState.SUCCESS);
		expect(opponent.getSpeed()).toBe(0);
		expect(opponent.getDefense()).toBe(80);
		expect(opponent.getAttack()).toBe(336);
	});

	it("never turns a stat negative when the armor share exceeds the current stat", async () => {
		const opponent = buildOpponent({
			attack: 300, defense: 100, speed: 50
		});
		mockArmor({
			attack: 0, defense: 150, speed: 80
		});

		await breakArmor({} as Fighter, opponent, 1, {} as FightController);

		expect(opponent.getDefense()).toBe(0);
		expect(opponent.getSpeed()).toBe(0);
		expect(opponent.getAttack()).toBe(300);
	});
});
