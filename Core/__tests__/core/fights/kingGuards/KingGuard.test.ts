import {
	beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../../src/core/database/game/models/InventorySlot", () => ({
	InventorySlots: {
		getPlayerActiveObjects: vi.fn(),
		getMainSlotsItems: vi.fn(),
		countObjectsOfPlayer: vi.fn()
	}
}));
vi.mock("../../../../src/data/FightAction", async importOriginal => ({
	...await importOriginal<typeof import("../../../../src/data/FightAction")>(),
	FightActionDataController: { instance: { getListById: vi.fn().mockReturnValue([]) } }
}));
vi.mock("../../../../src/core/database/logs/requests/LogsKingGuardFightsRequests", () => ({
	LogsKingGuardFightsRequests: { getGuardLevelBase: vi.fn() }
}));

import { KingGuardFighter } from "../../../../src/core/fights/fighter/KingGuardFighter";
import { InventorySlots } from "../../../../src/core/database/game/models/InventorySlot";
import { LogsKingGuardFightsRequests } from "../../../../src/core/database/logs/requests/LogsKingGuardFightsRequests";
import { computeKingGuardLevel } from "../../../../src/core/fights/kingGuards/KingGuardGenerator";
import { PVEConstants } from "../../../../../Lib/src/constants/PVEConstants";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { ItemConstants } from "../../../../../Lib/src/constants/ItemConstants";
import Player from "../../../../src/core/database/game/models/Player";
import { Class } from "../../../../src/data/Class";
import { PlayerActiveObjects } from "../../../../src/core/database/game/models/PlayerActiveObjects";
import PetEntity from "../../../../src/core/database/game/models/PetEntity";

function buildGuardPlayer(): Player {
	return {
		keycloakId: FightConstants.KING_GUARD.KEYCLOAK_ID,
		level: 30,
		class: 0,
		petId: null,
		getMaxCumulativeEnergy: vi.fn().mockReturnValue(800),
		getCumulativeAttack: vi.fn().mockReturnValue(10),
		getCumulativeDefense: vi.fn().mockReturnValue(10),
		getCumulativeSpeed: vi.fn().mockReturnValue(10),
		getBaseBreath: vi.fn().mockReturnValue(2),
		getMaxBreath: vi.fn().mockReturnValue(6),
		getBreathRegen: vi.fn().mockReturnValue(2),
		getGloryPoints: vi.fn().mockReturnValue(0)
	} as unknown as Player;
}

const metallicItem = { tags: [ItemConstants.TAGS.METALLIC] };
const activeObjects = {
	weapon: {
		item: metallicItem, itemLevel: 0, itemEnchantmentId: null
	},
	armor: {
		item: metallicItem, itemLevel: 0, itemEnchantmentId: null
	},
	potion: { item: {} },
	object: { item: {} }
} as unknown as PlayerActiveObjects;

describe("KingGuardFighter", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	function buildGuardFighter(pet: PetEntity | null = null): KingGuardFighter {
		return new KingGuardFighter({
			player: buildGuardPlayer(),
			guardClass: { fightActionsIds: [] } as unknown as Class,
			activeObjects,
			pet: pet as PetEntity
		});
	}

	it("loads its stats from the generated equipment without touching the database", async () => {
		const guard = buildGuardFighter();

		await guard.loadStats();

		expect(guard.getEnergy()).toBe(800);
		expect(guard.metallicItemCount).toBe(2);
		expect(await guard.getMainActiveObjects()).toBe(activeObjects);
		expect(InventorySlots.getPlayerActiveObjects).not.toHaveBeenCalled();
		expect(InventorySlots.countObjectsOfPlayer).not.toHaveBeenCalled();
	});

	it("fights with its generated pet although its player has no pet id", async () => {
		const pet = { typeId: 7 } as PetEntity;
		const guard = buildGuardFighter(pet);

		await guard.loadStats();

		expect(guard.pet).toBe(pet);
	});

	it("has no glory at stake", () => {
		expect(buildGuardFighter().getDisplayedGloryPoints()).toBeUndefined();
	});
});

describe("computeKingGuardLevel", () => {
	const player = {
		keycloakId: "player",
		class: 0,
		level: 60
	} as Player;

	function expectedRange(baseLevel: number): [number, number] {
		return [
			baseLevel + PVEConstants.NON_FINAL_BOSS_MONSTER_LEVEL_RANDOM_OFFSET.MIN,
			baseLevel + PVEConstants.NON_FINAL_BOSS_MONSTER_LEVEL_RANDOM_OFFSET.MAX
		];
	}

	it("starts from the player level when no guard was fought yet", async () => {
		vi.mocked(LogsKingGuardFightsRequests.getGuardLevelBase).mockResolvedValue(null);
		const [min, max] = expectedRange(player.level);

		for (let i = 0; i < 50; i++) {
			const level = await computeKingGuardLevel(player);
			expect(level).toBeGreaterThanOrEqual(min);
			expect(level).toBeLessThanOrEqual(max);
		}
	});

	it("starts from the guard fights history when there is one", async () => {
		vi.mocked(LogsKingGuardFightsRequests.getGuardLevelBase).mockResolvedValue(100);
		const [min, max] = expectedRange(100);

		for (let i = 0; i < 50; i++) {
			const level = await computeKingGuardLevel(player);
			expect(level).toBeGreaterThanOrEqual(min);
			expect(level).toBeLessThanOrEqual(max);
		}
	});

	it("never generates a guard below the level required to fight", async () => {
		vi.mocked(LogsKingGuardFightsRequests.getGuardLevelBase).mockResolvedValue(0);

		for (let i = 0; i < 50; i++) {
			expect(await computeKingGuardLevel(player)).toBeGreaterThanOrEqual(FightConstants.REQUIRED_LEVEL);
		}
	});
});
