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
	LogsKingGuardFightsRequests: {
		getGuardLevelBase: vi.fn(),
		getGuardLadder: vi.fn().mockResolvedValue({
			strongestVictoryLevel: null, lastFight: null
		})
	}
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
			pet: pet as PetEntity,
			playerLevel: 30
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
	const highLevelPlayer = {
		...player, level: 150
	} as Player;

	function expectedRange(baseLevel: number): [number, number] {
		return [
			baseLevel + PVEConstants.NON_FINAL_BOSS_MONSTER_LEVEL_RANDOM_OFFSET.MIN,
			baseLevel + PVEConstants.NON_FINAL_BOSS_MONSTER_LEVEL_RANDOM_OFFSET.MAX
		];
	}

	async function expectLevelsBetween(guardPlayer: Player, [min, max]: [number, number]): Promise<void> {
		for (let i = 0; i < 50; i++) {
			const level = await computeKingGuardLevel(guardPlayer);
			expect(level).toBeGreaterThanOrEqual(min);
			expect(level).toBeLessThanOrEqual(max);
		}
	}

	it("starts from the player level when a high level player never fought a guard with its class lineage", async () => {
		vi.mocked(LogsKingGuardFightsRequests.getGuardLevelBase).mockResolvedValue(null);

		await expectLevelsBetween(highLevelPlayer, expectedRange(highLevelPlayer.level));
	});

	it("starts from the guard fights history of a high level player when there is one", async () => {
		vi.mocked(LogsKingGuardFightsRequests.getGuardLevelBase).mockResolvedValue(140);

		await expectLevelsBetween(highLevelPlayer, expectedRange(140));
	});

	it("never generates a guard below the minimum level for a high level player, whatever its record", async () => {
		vi.mocked(LogsKingGuardFightsRequests.getGuardLevelBase).mockResolvedValue(11);

		await expectLevelsBetween(highLevelPlayer, [PVEConstants.HIGH_LEVEL_MIN_MONSTER_LEVEL, PVEConstants.HIGH_LEVEL_MIN_MONSTER_LEVEL]);
	});

	it("never generates a guard below the level required to fight", async () => {
		const lowLevelPlayer = {
			...player, level: FightConstants.REQUIRED_LEVEL
		} as Player;

		for (let i = 0; i < 50; i++) {
			expect(await computeKingGuardLevel(lowLevelPlayer)).toBeGreaterThanOrEqual(FightConstants.REQUIRED_LEVEL);
		}
	});

	it("follows the ladder of the strongest guard beaten for a low level player, whatever its class", async () => {
		vi.mocked(LogsKingGuardFightsRequests.getGuardLevelBase).mockClear();
		const strongestVictoryLevel = player.level - PVEConstants.LOW_LEVEL_BOSS_LADDER.MAX_LEVELS_BELOW_PLAYER;
		vi.mocked(LogsKingGuardFightsRequests.getGuardLadder).mockResolvedValue({
			strongestVictoryLevel,
			lastFight: {
				level: strongestVictoryLevel, isDefeat: false, playerLevel: player.level
			}
		});

		const levels = await Promise.all(Array.from({ length: 100 }, () => computeKingGuardLevel(player)));

		expect(levels.filter(level => level > strongestVictoryLevel).length).toBeGreaterThan(50);
		expect(LogsKingGuardFightsRequests.getGuardLevelBase).not.toHaveBeenCalled();
		vi.mocked(LogsKingGuardFightsRequests.getGuardLadder).mockResolvedValue({
			strongestVictoryLevel: null, lastFight: null
		});
	});

	it("keeps the guard close to the level of a low level player, whatever its ladder", async () => {
		vi.mocked(LogsKingGuardFightsRequests.getGuardLadder).mockResolvedValue({
			strongestVictoryLevel: 5,
			lastFight: {
				level: 5, isDefeat: false, playerLevel: player.level
			}
		});

		for (let i = 0; i < 50; i++) {
			expect(await computeKingGuardLevel(player)).toBeGreaterThanOrEqual(player.level - PVEConstants.LOW_LEVEL_BOSS_LADDER.MAX_LEVELS_BELOW_PLAYER);
		}
		vi.mocked(LogsKingGuardFightsRequests.getGuardLadder).mockResolvedValue({
			strongestVictoryLevel: null, lastFight: null
		});
	});
});
