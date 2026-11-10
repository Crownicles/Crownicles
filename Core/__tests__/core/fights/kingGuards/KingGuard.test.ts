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

import { Sequelize } from "sequelize";
import { KingGuardFighter } from "../../../../src/core/fights/fighter/KingGuardFighter";
import { InventorySlots } from "../../../../src/core/database/game/models/InventorySlot";
import { ItemConstants } from "../../../../../Lib/src/constants/ItemConstants";
import Player, { initModel as initPlayer } from "../../../../src/core/database/game/models/Player";
import { initModel as initPetEntity } from "../../../../src/core/database/game/models/PetEntity";
import { Class } from "../../../../src/data/Class";
import { PlayerActiveObjects } from "../../../../src/core/database/game/models/PlayerActiveObjects";
import PetEntity from "../../../../src/core/database/game/models/PetEntity";
import { KingGuardData } from "../../../../src/data/KingGuard";
import { buildKingGuard } from "../../../../src/core/fights/kingGuards/KingGuardLibrary";
import { KingGuardIdentity } from "../../../../../Lib/src/utils/KingGuardIdentity";
import { PetConstants } from "../../../../../Lib/src/constants/PetConstants";

function buildGuardPlayer(): Player {
	return {
		keycloakId: KingGuardIdentity.toKeycloakId(1),
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

const guardData: KingGuardData = {
	id: 42,
	level: 120,
	sex: "f",
	classId: 18,
	profile: "wellEquipped",
	weapon: {
		id: 40, level: 3, enchantmentId: "pvpAttack2"
	},
	armor: {
		id: 77, level: 2, enchantmentId: null
	},
	potionId: 0,
	objectId: 3,
	pet: {
		typeId: 7, sex: "m"
	},
	initialGlory: 1500
};

describe("KingGuardFighter", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	function buildGuardFighter(pet: PetEntity | null = null): KingGuardFighter {
		return new KingGuardFighter({
			data: guardData,
			player: buildGuardPlayer(),
			guardClass: { fightActionsIds: [] } as unknown as Class,
			activeObjects,
			pet,
			playerLevel: 30
		});
	}

	it("loads its stats from the equipment of the library without touching the database", async () => {
		const guard = buildGuardFighter();

		await guard.loadStats();

		expect(guard.getEnergy()).toBe(800);
		expect(guard.metallicItemCount).toBe(2);
		expect(await guard.getMainActiveObjects()).toBe(activeObjects);
		expect(InventorySlots.getPlayerActiveObjects).not.toHaveBeenCalled();
		expect(InventorySlots.countObjectsOfPlayer).not.toHaveBeenCalled();
	});

	it("fights with its pet although its player has no pet id, and without any when it has none", async () => {
		const pet = { typeId: 7 } as PetEntity;
		const withPet = buildGuardFighter(pet);
		const withoutPet = buildGuardFighter();

		await withPet.loadStats();
		await withoutPet.loadStats();

		expect(withPet.pet).toBe(pet);
		expect(withoutPet.pet).toBeUndefined();
	});

	it("has no glory at stake and keeps its rating hidden", () => {
		expect(buildGuardFighter().getDisplayedGloryPoints()).toBeUndefined();
	});
});

describe("buildKingGuard", () => {
	const sequelize = new Sequelize({
		dialect: "mariadb", logging: false
	});
	initPlayer(sequelize);
	initPetEntity(sequelize);

	it("builds the unsaved player of a guard of the library, named by its id, with its level and class", () => {
		const guard = buildKingGuard(guardData, 90);

		expect(KingGuardIdentity.getGuardId(guard.player.keycloakId)).toBe(guardData.id);
		expect(guard.player.level).toBe(guardData.level);
		expect(guard.player.class).toBe(guardData.classId);
		expect(guard.player.isNewRecord).toBe(true);
		expect(guard.guardClass.id).toBe(guardData.classId);
		expect(guard.playerLevel).toBe(90);
		expect(guard.data).toBe(guardData);
	});

	it("equips the items of the library with their upgrade level and enchantment", () => {
		const guard = buildKingGuard(guardData, 90);

		expect(guard.activeObjects.weapon.item.id).toBe(guardData.weapon.id);
		expect(guard.activeObjects.weapon.itemLevel).toBe(guardData.weapon.level);
		expect(guard.activeObjects.weapon.itemEnchantmentId).toBe(guardData.weapon.enchantmentId);
		expect(guard.activeObjects.armor.item.id).toBe(guardData.armor.id);
		expect(guard.activeObjects.armor.itemLevel).toBe(guardData.armor.level);
		expect(guard.activeObjects.potion.item.id).toBe(guardData.potionId);
		expect(guard.activeObjects.object.item.id).toBe(guardData.objectId);
	});

	it("gives the guard its pet of the library, or none", () => {
		const withPet = buildKingGuard(guardData, 90);
		const withoutPet = buildKingGuard({
			...guardData, pet: null
		}, 90);

		expect(withPet.pet?.typeId).toBe(guardData.pet!.typeId);
		expect(withPet.pet?.sex).toBe(guardData.pet!.sex);
		expect(withPet.pet?.lovePoints).toBe(PetConstants.BASE_LOVE);
		expect(withoutPet.pet).toBeNull();
	});
});
