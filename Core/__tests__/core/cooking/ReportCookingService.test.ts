import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";

const logCookingUse = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("../../../src/app", () => ({
	crowniclesInstance: { logsDatabase: { logCookingUse } }
}));

vi.mock("../../../src/core/missions/MissionsController", () => ({
	MissionsController: { update: vi.fn().mockResolvedValue(undefined) }
}));

vi.mock("../../../src/core/utils/MaterialLootUtils", () => ({ updateCollectMaterialsMission: vi.fn().mockResolvedValue(undefined) }));

vi.mock("../../../src/core/utils/withLockedPlayerAndMissions", () => ({ withLockedPlayerAndMissions: vi.fn() }));

vi.mock("../../../../Lib/src/locks/withLockedEntities", async importOriginal => ({
	...await importOriginal<typeof import("../../../../Lib/src/locks/withLockedEntities")>(),
	withLockedEntities: vi.fn()
}));

import {
	handleCookingCraft, handleCookingIgnite, handleCookingMenu, handleCookingPin, handleCookingRemoveSpecialty,
	handleCookingRevive, handleCookingSetSpecialty, handleCookingUnpin, handleCookingWoodConfirm
} from "../../../src/core/report/ReportCookingService";
import {
	Player, Players
} from "../../../src/core/database/game/models/Player";
import {
	Home, Homes
} from "../../../src/core/database/game/models/Home";
import {
	Guild, Guilds
} from "../../../src/core/database/game/models/Guild";
import { Materials } from "../../../src/core/database/game/models/Material";
import {
	CookingService, CraftResult
} from "../../../src/core/cooking/CookingService";
import { PlayerCookingRecipe } from "../../../src/core/database/game/models/PlayerCookingRecipe";
import { PlayerCookingSpecialty } from "../../../src/core/database/game/models/PlayerCookingSpecialty";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import { updateCollectMaterialsMission } from "../../../src/core/utils/MaterialLootUtils";
import {
	LockedRowNotFoundError, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";
import * as ItemUtils from "../../../src/core/utils/ItemUtils";
import { withLockedPlayerAndMissions } from "../../../src/core/utils/withLockedPlayerAndMissions";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { CookingRecipeDataController } from "../../../src/data/CookingRecipeData";
import { PotionDataController } from "../../../src/data/Potion";
import {
	CommandReportCookingCraftRes, CommandReportCookingIgniteRes, CommandReportCookingMenuRes, CommandReportCookingNoWoodRes,
	CommandReportCookingPinRes, CommandReportCookingReviveRes, CommandReportCookingUnpinRes, CommandReportCookingWoodConfirmReq
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import {
	CookingCraftErrors, CookingSlotData, CookingSpecialtyErrors, PinnedRecipeInfo
} from "../../../../Lib/src/types/CookingTypes";
import {
	CookingOutputType, CookingSpecialtyConstants, FAILED_CRAFT_CONSOLATION_CHANCE, getCookingGrade,
	SPECIALTY_SLOT_INDEX, TIME_POTION_WEEKLY_CRAFT_LIMIT
} from "../../../../Lib/src/constants/CookingConstants";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import {
	ItemNature, ItemRarity
} from "../../../../Lib/src/constants/ItemConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { PetEntity } from "../../../src/core/database/game/models/PetEntity";
import {
	CrowniclesPacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { asPlayer } from "../ModelStubs";

const KEYCLOAK_ID = "cook-keycloak-id";
const HOME_ID = 12;
const COOKING_SLOTS = 3;
const ALL_SPECIALTIES_LEVEL = CookingSpecialtyConstants.UNLOCK_COOKING_LEVELS[CookingSpecialtyConstants.MAX_SPECIALTIES - 1];
const context = { keycloakId: KEYCLOAK_ID } as PacketContext;

interface CookRow {
	id: number;
	keycloakId: string;
	cookingLevel: number;
	furnacePosition: number;
	pinnedCookingRecipeId: string | null;
	timePotionsCookedThisWeek: number;
	guildId: number | null;
	save: ReturnType<typeof vi.fn>;
	changed: ReturnType<typeof vi.fn>;
	giveItem: ReturnType<typeof vi.fn>;
	getCurrentCityId: () => string;
}

function cookRow(overrides: Partial<CookRow> = {}): CookRow {
	return {
		id: 3,
		keycloakId: KEYCLOAK_ID,
		cookingLevel: 0,
		furnacePosition: 4,
		pinnedCookingRecipeId: null,
		timePotionsCookedThisWeek: 0,
		guildId: null,
		save: vi.fn().mockResolvedValue(undefined),
		changed: vi.fn(),
		giveItem: vi.fn().mockResolvedValue(true),
		getCurrentCityId: (): string => "city",
		...overrides
	};
}

/**
 * The player as read by the handler, and the same row as read again under the row lock
 */
let cook: CookRow;
let lockedCook: CookRow;
let lockedGuild: Guild | null;

function setCook(overrides: Partial<CookRow> = {}): void {
	cook = cookRow(overrides);
	lockedCook = cookRow(overrides);
	vi.mocked(Players.getByKeycloakId).mockResolvedValue(asPlayer(cook));
}

function guildWithPantry(stored: number): Guild {
	return {
		id: 9,
		pantryLevel: 0,
		getDataValue: () => stored,
		addFood: vi.fn(),
		save: vi.fn().mockResolvedValue(undefined)
	} as unknown as Guild; // Only the pantry fields, the model needs a database
}

function slotFor(recipeId: string, slotIndex: number, overrides: Partial<NonNullable<CookingSlotData["recipe"]>> = {}): CookingSlotData {
	const recipe = CookingRecipeDataController.instance.getById(recipeId);
	if (!recipe) {
		throw new Error(`Missing recipe ${recipeId}`);
	}
	return {
		slotIndex,
		recipe: {
			id: recipe.id,
			level: recipe.level,
			outputType: recipe.outputType,
			recipeType: recipe.recipeType,
			isSecret: false,
			outputDescription: recipe.id,
			ingredients: {
				plants: [], materials: []
			},
			canCraft: true,
			...overrides
		}
	};
}

function craftResult(overrides: Partial<CraftResult> = {}): CraftResult {
	return {
		success: true,
		xpGained: 50,
		materialSaved: undefined,
		levelUp: false,
		masterChefBadgeEarned: false,
		discoveredRecipes: [],
		bonusOutput: false,
		...overrides
	};
}

function packetOf<T>(response: CrowniclesPacket[], PacketClass: new () => T): T {
	const packet = response.find(candidate => candidate instanceof PacketClass);
	expect(packet).toBeDefined();
	return packet as T;
}

beforeEach(() => {
	vi.spyOn(Players, "getByKeycloakId");
	setCook();
	lockedGuild = null;
	vi.spyOn(Homes, "getOfPlayer").mockResolvedValue({
		id: HOME_ID,
		getLevel: () => ({ features: { cookingSlots: COOKING_SLOTS } })
	} as unknown as Home); // Only the cooking slots of the home level are read
	vi.mocked(withLockedEntities).mockImplementation((keys, body) => body(keys.map(key => (key.model === Guild ? lockedGuild : lockedCook)) as never));
	vi.mocked(withLockedPlayerAndMissions).mockImplementation((_playerId, body) => body(asPlayer(lockedCook)));
	vi.spyOn(Guilds, "getById").mockResolvedValue(null);
	vi.spyOn(Materials, "consumeMaterial").mockResolvedValue(undefined as never);
	vi.spyOn(Materials, "giveMaterial").mockResolvedValue(undefined as never);
	vi.spyOn(CookingService, "getSlotRecipes").mockResolvedValue([]);
	vi.spyOn(CookingService, "getSpecialtiesInfo").mockResolvedValue([]);
	vi.spyOn(CookingService, "getPinnedRecipeInfo").mockResolvedValue(null);
	vi.spyOn(ItemUtils, "giveItemToPlayer").mockResolvedValue(undefined);
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.mocked(MissionsController.update).mockClear();
	vi.mocked(withLockedPlayerAndMissions).mockClear();
	vi.mocked(updateCollectMaterialsMission).mockClear();
	logCookingUse.mockClear();
});

describe("cooking access", () => {
	it("should answer nothing to an unknown player or a home without furnace", async () => {
		vi.mocked(Players.getByKeycloakId).mockResolvedValueOnce(null);
		expect(await handleCookingMenu(KEYCLOAK_ID, {})).toEqual([]);

		vi.mocked(Homes.getOfPlayer).mockResolvedValueOnce(null);
		expect(await handleCookingIgnite(KEYCLOAK_ID, {})).toEqual([]);

		vi.mocked(Homes.getOfPlayer).mockResolvedValueOnce({
			id: HOME_ID, getLevel: () => ({ features: { cookingSlots: 0 } })
		} as unknown as Home); // Only the cooking slots of the home level are read
		expect(await handleCookingCraft(KEYCLOAK_ID, {
			slotIndex: 0, recipeId: "potion_health_1"
		}, context)).toEqual([]);
		expect(CookingService.getSlotRecipes).not.toHaveBeenCalled();
	});
});

describe("cooking menu snapshot", () => {
	it("should describe a cold furnace with the cook grade, without loading the stations", async () => {
		setCook({ cookingLevel: 35 });

		const [packet] = await handleCookingMenu(KEYCLOAK_ID, {});

		expect(packet).toBeInstanceOf(CommandReportCookingMenuRes);
		expect((packet as CommandReportCookingMenuRes).menu).toEqual({
			cookingLevel: 35,
			cookingGrade: getCookingGrade(35).id,
			pinnedRecipe: undefined,
			currentSlots: [],
			isIgnited: false
		});
		expect(CookingService.getSlotRecipes).not.toHaveBeenCalled();
	});

	it("should list the specialties and the pinned recipe when there are some", async () => {
		const pinned = { recipeId: "potion_health_1" } as PinnedRecipeInfo;
		const specialties = [{
			recipeId: "potion_energy_1", level: 1, recipeType: "POTION_ENERGY", canCraft: true
		}] as Awaited<ReturnType<typeof CookingService.getSpecialtiesInfo>>;
		setCook({ pinnedCookingRecipeId: "potion_health_1" });
		vi.mocked(CookingService.getPinnedRecipeInfo).mockResolvedValue(pinned);
		vi.mocked(CookingService.getSpecialtiesInfo).mockResolvedValue(specialties);

		const [packet] = await handleCookingMenu(KEYCLOAK_ID, {});

		expect((packet as CommandReportCookingMenuRes).menu).toMatchObject({
			pinnedRecipe: pinned, specialties
		});
		expect(lockedCook.save).not.toHaveBeenCalled();
	});

	it("should unpin a recipe that can no longer be cooked", async () => {
		setCook({ pinnedCookingRecipeId: "removed_recipe" });

		const [packet] = await handleCookingMenu(KEYCLOAK_ID, {});

		expect(lockedCook.pinnedCookingRecipeId).toBeNull();
		expect(lockedCook.save).toHaveBeenCalledOnce();
		expect(cook.pinnedCookingRecipeId).toBeNull();
		expect((packet as CommandReportCookingMenuRes).menu.pinnedRecipe).toBeUndefined();
	});

	it("should keep a pin set meanwhile from another shard", async () => {
		setCook({ pinnedCookingRecipeId: "removed_recipe" });
		lockedCook.pinnedCookingRecipeId = "potion_health_1";

		await handleCookingMenu(KEYCLOAK_ID, {});

		expect(lockedCook.pinnedCookingRecipeId).toBe("potion_health_1");
		expect(lockedCook.save).not.toHaveBeenCalled();
	});
});

describe("furnace ignition", () => {
	const commonWood = {
		materialId: 58, rarity: MaterialRarity.COMMON, needsConfirmation: false
	};
	const rareWood = {
		materialId: 18, rarity: MaterialRarity.RARE, needsConfirmation: true
	};

	it("should tell the cook there is no wood to burn", async () => {
		vi.spyOn(CookingService, "getWoodToConsume").mockResolvedValue(null);

		const response = await handleCookingIgnite(KEYCLOAK_ID, {});

		expect(response).toHaveLength(1);
		expect(response[0]).toBeInstanceOf(CommandReportCookingNoWoodRes);
		expect(Materials.consumeMaterial).not.toHaveBeenCalled();
	});

	it("should burn one common wood and re-roll the stations under the player lock", async () => {
		const slots = [slotFor("potion_health_1", 0)];
		vi.spyOn(CookingService, "getWoodToConsume").mockResolvedValue(commonWood);
		vi.mocked(CookingService.getSlotRecipes).mockResolvedValue(slots);

		const response = await handleCookingIgnite(KEYCLOAK_ID, {});

		expect(Materials.consumeMaterial).toHaveBeenCalledWith(lockedCook.id, commonWood.materialId, 1);
		expect(lockedCook.furnacePosition).toBe(5);
		expect(lockedCook.save).toHaveBeenCalledOnce();
		expect(cook.furnacePosition).toBe(5);
		expect(CookingService.getSlotRecipes).toHaveBeenCalledWith({
			player: cook, homeId: HOME_ID, cookingSlots: COOKING_SLOTS
		});
		const packet = packetOf(response, CommandReportCookingIgniteRes);
		expect(packet).toMatchObject({
			woodConsumed: true, woodMaterialId: commonWood.materialId
		});
		expect(packet.menu).toMatchObject({
			isIgnited: true, currentSlots: slots
		});
		expect(CookingService.getSlotRecipes).toHaveBeenCalledOnce();
	});

	it("should answer a revive with a revive packet", async () => {
		vi.spyOn(CookingService, "getWoodToConsume").mockResolvedValue(commonWood);

		const response = await handleCookingRevive(KEYCLOAK_ID, {});

		expect(response[0]).toBeInstanceOf(CommandReportCookingReviveRes);
	});

	it("should spare the wood when the save roll of the grade is strictly below its chance", async () => {
		const grade = getCookingGrade(91);
		setCook({ cookingLevel: 91 });
		vi.spyOn(CookingService, "getWoodToConsume").mockResolvedValue(commonWood);
		const roll = vi.spyOn(RandomUtils.crowniclesRandom, "realZeroToOneInclusive").mockReturnValue(grade.woodSaveChance - 0.001);

		const saved = await handleCookingIgnite(KEYCLOAK_ID, {});
		expect(Materials.consumeMaterial).not.toHaveBeenCalled();
		expect(packetOf(saved, CommandReportCookingIgniteRes).woodConsumed).toBe(false);
		expect(lockedCook.furnacePosition).toBe(5);

		roll.mockReturnValue(grade.woodSaveChance);
		const burnt = await handleCookingIgnite(KEYCLOAK_ID, {});
		expect(Materials.consumeMaterial).toHaveBeenCalledOnce();
		expect(packetOf(burnt, CommandReportCookingIgniteRes).woodConsumed).toBe(true);
	});

	it("should never roll the wood save for a grade without it", async () => {
		vi.spyOn(CookingService, "getWoodToConsume").mockResolvedValue(commonWood);
		const roll = vi.spyOn(RandomUtils.crowniclesRandom, "realZeroToOneInclusive").mockReturnValue(0);

		await handleCookingIgnite(KEYCLOAK_ID, {});

		expect(roll).not.toHaveBeenCalled();
		expect(Materials.consumeMaterial).toHaveBeenCalledOnce();
	});

	describe("rare wood confirmation", () => {
		it("should ask before burning a rare wood, then burn exactly that wood once on confirmation", async () => {
			vi.spyOn(CookingService, "getWoodToConsume").mockResolvedValue(rareWood);

			const question = await handleCookingIgnite(KEYCLOAK_ID, {});
			expect(question).toHaveLength(1);
			expect(question[0]).toBeInstanceOf(CommandReportCookingWoodConfirmReq);
			expect(question[0]).toMatchObject({
				woodMaterialId: rareWood.materialId, woodRarity: rareWood.rarity
			});
			expect(Materials.consumeMaterial).not.toHaveBeenCalled();

			const confirmed = await handleCookingWoodConfirm(KEYCLOAK_ID, { accepted: true });
			const replayed = await handleCookingWoodConfirm(KEYCLOAK_ID, { accepted: true });

			expect(packetOf(confirmed, CommandReportCookingIgniteRes)).toMatchObject({
				woodConsumed: true, woodMaterialId: rareWood.materialId
			});
			expect(Materials.consumeMaterial).toHaveBeenCalledOnce();
			expect(Materials.consumeMaterial).toHaveBeenCalledWith(lockedCook.id, rareWood.materialId, 1);
			expect(lockedCook.furnacePosition).toBe(5);
			expect(cook.furnacePosition).toBe(5);
			expect(replayed).toEqual([]);
		});

		it("should answer a confirmed revive with a revive packet", async () => {
			vi.spyOn(CookingService, "getWoodToConsume").mockResolvedValue(rareWood);

			await handleCookingRevive(KEYCLOAK_ID, {});
			const confirmed = await handleCookingWoodConfirm(KEYCLOAK_ID, { accepted: true });

			expect(confirmed[0]).toBeInstanceOf(CommandReportCookingReviveRes);
		});

		it("should forget the pending wood when the cook declines", async () => {
			vi.spyOn(CookingService, "getWoodToConsume").mockResolvedValue(rareWood);
			await handleCookingIgnite(KEYCLOAK_ID, {});

			expect(await handleCookingWoodConfirm(KEYCLOAK_ID, { accepted: false })).toEqual([]);
			expect(await handleCookingWoodConfirm(KEYCLOAK_ID, { accepted: true })).toEqual([]);
			expect(Materials.consumeMaterial).not.toHaveBeenCalled();
		});

		it("should forget the pending wood after five minutes", async () => {
			vi.useFakeTimers();
			try {
				vi.spyOn(CookingService, "getWoodToConsume").mockResolvedValue(rareWood);
				await handleCookingIgnite(KEYCLOAK_ID, {});
				vi.advanceTimersByTime(5 * 60 * 1000 - 1);
				await handleCookingIgnite(KEYCLOAK_ID, {});
				// The second request restarts the delay
				vi.advanceTimersByTime(5 * 60 * 1000 - 1);
				expect(await handleCookingWoodConfirm(KEYCLOAK_ID, { accepted: true })).not.toEqual([]);

				await handleCookingIgnite(KEYCLOAK_ID, {});
				vi.advanceTimersByTime(5 * 60 * 1000);
				expect(await handleCookingWoodConfirm(KEYCLOAK_ID, { accepted: true })).toEqual([]);
			}
			finally {
				vi.useRealTimers();
			}
		});

		it("should not burn anything when the player is gone meanwhile", async () => {
			vi.spyOn(CookingService, "getWoodToConsume").mockResolvedValue(rareWood);
			await handleCookingIgnite(KEYCLOAK_ID, {});
			vi.mocked(Players.getByKeycloakId).mockResolvedValueOnce(null);

			expect(await handleCookingWoodConfirm(KEYCLOAK_ID, { accepted: true })).toEqual([]);
			expect(Materials.consumeMaterial).not.toHaveBeenCalled();
		});
	});
});

describe("craft validation", () => {
	let executeCraft: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		executeCraft = vi.spyOn(CookingService, "executeCraft").mockResolvedValue(craftResult());
	});

	const craftBlocked = async (slots: CookingSlotData[], recipeId = "potion_health_1"): Promise<CommandReportCookingCraftRes> => {
		vi.mocked(CookingService.getSlotRecipes).mockResolvedValue(slots);
		const response = await handleCookingCraft(KEYCLOAK_ID, {
			slotIndex: 0, recipeId
		}, context);
		expect(response).toHaveLength(1);
		expect(executeCraft).not.toHaveBeenCalled();
		return response[0] as CommandReportCookingCraftRes;
	};

	it("should refuse a station that offers nothing", async () => {
		const packet = await craftBlocked([{
			slotIndex: 0, recipe: null
		}]);

		expect(packet).toBeInstanceOf(CommandReportCookingCraftRes);
		expect(packet).toMatchObject({
			success: false,
			error: CookingCraftErrors.CRAFT_UNAVAILABLE,
			recipeId: "",
			wasSecret: false,
			outputType: CookingOutputType.POTION,
			cookingXpGained: 0,
			cookingLevelUp: false
		});
		expect(packet.menu.isIgnited).toBe(true);
	});

	it("should refuse a click on a stale menu, whose station now offers another recipe", async () => {
		const packet = await craftBlocked([slotFor("potion_energy_1", 0, { isSecret: true })]);

		expect(packet).toMatchObject({
			error: CookingCraftErrors.CRAFT_UNAVAILABLE,
			recipeId: "potion_energy_1",
			wasSecret: true
		});
	});

	it("should require a guild to cook pet food", async () => {
		const packet = await craftBlocked([slotFor("petfood_salad_1", 0)], "petfood_salad_1");

		expect(packet).toMatchObject({
			error: CookingCraftErrors.GUILD_REQUIRED,
			outputType: CookingOutputType.PET_FOOD
		});
	});

	it("should refuse a recipe whose ingredients are missing", async () => {
		const packet = await craftBlocked([slotFor("potion_health_1", 0, { canCraft: false })]);

		expect(packet.error).toBe(CookingCraftErrors.CRAFT_UNAVAILABLE);
	});

	it("should explain the weekly limit of a time potion before anything else", async () => {
		const packet = await craftBlocked([slotFor("potion_time_speedup_1", 0, {
			canCraft: false, timePotionsLeftThisWeek: 0
		})], "potion_time_speedup_1");

		expect(packet.error).toBe(CookingCraftErrors.TIME_POTION_WEEKLY_LIMIT);
	});

	it("should lock the home with the player, and the guild pantry only for pet food", async () => {
		setCook({ guildId: 9 });
		vi.mocked(CookingService.getSlotRecipes).mockResolvedValue([]);

		await handleCookingCraft(KEYCLOAK_ID, {
			slotIndex: 0, recipeId: "petfood_salad_1"
		}, context);
		await handleCookingCraft(KEYCLOAK_ID, {
			slotIndex: 0, recipeId: "potion_health_1"
		}, context);
		await handleCookingCraft(KEYCLOAK_ID, {
			slotIndex: 0, recipeId: "unknown_recipe"
		}, context);
		setCook({ guildId: null });
		await handleCookingCraft(KEYCLOAK_ID, {
			slotIndex: 0, recipeId: "petfood_salad_1"
		}, context);

		expect(vi.mocked(withLockedPlayerAndMissions).mock.calls.map(([playerId, _body, keys]) => [playerId, keys])).toEqual([
			[cook.id, [Home.lockKey(HOME_ID), Guild.lockKey(9)]],
			[cook.id, [Home.lockKey(HOME_ID)]],
			[cook.id, [Home.lockKey(HOME_ID)]],
			[cook.id, [Home.lockKey(HOME_ID)]]
		]);
	});

	it("should check the ingredients of the player read under the lock", async () => {
		await craftBlocked([slotFor("potion_health_1", 0, { canCraft: false })]);

		expect(CookingService.getSlotRecipes).toHaveBeenCalledWith({
			player: lockedCook, homeId: HOME_ID, cookingSlots: COOKING_SLOTS
		});
	});

	it("should answer nothing when the player, their home or their guild disappeared before the lock", async () => {
		vi.mocked(withLockedPlayerAndMissions).mockRejectedValue(new LockedRowNotFoundError("home", HOME_ID));

		expect(await handleCookingCraft(KEYCLOAK_ID, {
			slotIndex: 0, recipeId: "potion_health_1"
		}, context)).toEqual([]);
		expect(executeCraft).not.toHaveBeenCalled();
	});

	it("should cook nothing when the home read under the lock is no longer the locked one", async () => {
		vi.mocked(Homes.getOfPlayer)
			.mockResolvedValueOnce({
				id: HOME_ID,
				getLevel: () => ({ features: { cookingSlots: COOKING_SLOTS } })
			} as unknown as Home)
			.mockResolvedValueOnce({
				id: HOME_ID + 1,
				getLevel: () => ({ features: { cookingSlots: COOKING_SLOTS } })
			} as unknown as Home);

		expect(await handleCookingCraft(KEYCLOAK_ID, {
			slotIndex: 0, recipeId: "potion_health_1"
		}, context)).toEqual([]);
		expect(CookingService.getSlotRecipes).not.toHaveBeenCalled();
		expect(executeCraft).not.toHaveBeenCalled();
	});

	it("should not swallow an unexpected error of the critical section", async () => {
		vi.mocked(withLockedPlayerAndMissions).mockRejectedValue(new Error("database down"));

		await expect(handleCookingCraft(KEYCLOAK_ID, {
			slotIndex: 0, recipeId: "potion_health_1"
		}, context)).rejects.toThrow("database down");
	});

	it("should pick the requested recipe among several offers of the same station", async () => {
		vi.mocked(CookingService.getSlotRecipes).mockResolvedValue([
			slotFor("potion_health_1", SPECIALTY_SLOT_INDEX, { canCraft: false }),
			slotFor("potion_energy_1", SPECIALTY_SLOT_INDEX)
		]);

		const [packet] = await handleCookingCraft(KEYCLOAK_ID, {
			slotIndex: SPECIALTY_SLOT_INDEX, recipeId: "potion_energy_1"
		}, context);

		expect(packet).toMatchObject({
			success: true, recipeId: "potion_energy_1"
		});
		expect(executeCraft).toHaveBeenCalledOnce();
	});
});

describe("craft outputs", () => {
	let executeCraft: ReturnType<typeof vi.spyOn>;

	const craft = async (recipeId: string, result: CraftResult, slotOverrides: Partial<NonNullable<CookingSlotData["recipe"]>> = {}): Promise<CrowniclesPacket[]> => {
		vi.mocked(CookingService.getSlotRecipes).mockResolvedValue([slotFor(recipeId, 1, slotOverrides)]);
		executeCraft.mockResolvedValue(result);
		return await handleCookingCraft(KEYCLOAK_ID, {
			slotIndex: 1, recipeId
		}, context);
	};

	beforeEach(() => {
		executeCraft = vi.spyOn(CookingService, "executeCraft");
	});

	describe("potions", () => {
		it("should give a potion of the recipe nature and rarity, then count the craft for the missions", async () => {
			const inventorySwap = { name: "swap" } as unknown as CrowniclesPacket; // Opaque packet produced by the inventory flow
			vi.mocked(ItemUtils.giveItemToPlayer).mockImplementation(response => {
				response.push(inventorySwap);
				return Promise.resolve();
			});

			const response = await craft("potion_health_1", craftResult({
				xpGained: 77, materialSaved: 68
			}));

			expect(executeCraft).toHaveBeenCalledWith({
				player: lockedCook, recipe: CookingRecipeDataController.instance.getById("potion_health_1"), homeId: HOME_ID
			});

			const packet = response[0] as CommandReportCookingCraftRes;
			expect(packet).toBeInstanceOf(CommandReportCookingCraftRes);
			const potion = PotionDataController.instance.getById(packet.potionId ?? -1);
			expect(potion?.nature).toBe(ItemNature.HEALTH);
			expect(potion?.rarity).toBe(ItemRarity.COMMON);
			expect(packet).toMatchObject({
				success: true,
				recipeId: "potion_health_1",
				potionRarity: ItemRarity.COMMON,
				cookingXpGained: 77,
				cookingLevelUp: false,
				materialSaved: 68,
				bonusOutput: false
			});
			expect(Object.keys(packet)).not.toContain("inventorySwapPackets");
			expect(Object.keys(packet)).not.toContain("bonusHonored");
			expect(response[1]).toBe(inventorySwap);
			expect(ItemUtils.giveItemToPlayer).toHaveBeenCalledWith(expect.any(Array), context, lockedCook, potion);
			expect(MissionsController.update).toHaveBeenCalledWith(lockedCook, response, { missionId: "cookRecipes" });
			expect(MissionsController.update).toHaveBeenCalledWith(lockedCook, response, {
				missionId: "cookPotionRarity", params: { rarity: ItemRarity.COMMON }
			});
			expect(MissionsController.update).not.toHaveBeenCalledWith(lockedCook, response, expect.objectContaining({ missionId: "reachCookingLevel" }));
			expect(logCookingUse).toHaveBeenCalledWith(expect.objectContaining({
				keycloakId: KEYCLOAK_ID,
				cityId: "city",
				recipeId: "potion_health_1",
				success: true,
				bonus: false,
				xpGained: 77,
				potionId: potion?.id,
				foodType: null,
				materialOutputId: null
			}));
		});

		it("should upgrade the rarity of a bonus potion and announce the bonus", async () => {
			const response = await craft("potion_health_1", craftResult({ bonusOutput: true }));

			expect(response[0]).toMatchObject({
				potionRarity: ItemRarity.UNCOMMON, bonusOutput: true
			});
			expect(logCookingUse).toHaveBeenCalledWith(expect.objectContaining({ bonus: true }));
		});

		it("should update the cooking level mission on a level up and relay the new grade and badge", async () => {
			lockedCook.cookingLevel = 11;

			const response = await craft("potion_health_1", craftResult({
				levelUp: true, newLevel: 11, newGrade: "scullion", masterChefBadgeEarned: true
			}));

			expect(response[0]).toMatchObject({
				cookingLevelUp: true, newCookingLevel: 11, newCookingGrade: "scullion", masterChefBadgeEarned: true
			});
			expect(MissionsController.update).toHaveBeenCalledWith(lockedCook, response, {
				missionId: "reachCookingLevel", count: 11, set: true
			});
		});

		it("should not mention the master chef badge when it was not earned", async () => {
			const [packet] = await craft("potion_health_1", craftResult());

			expect((packet as CommandReportCookingCraftRes).masterChefBadgeEarned).toBeUndefined();
		});

		it("should give nothing but a possible consolation potion when the craft fails", async () => {
			vi.spyOn(RandomUtils.crowniclesRandom, "realZeroToOneInclusive").mockReturnValue(FAILED_CRAFT_CONSOLATION_CHANCE + 0.01);

			const [packet] = await craft("potion_health_1", craftResult({ success: false }));

			expect(packet).toMatchObject({
				success: false, potionId: undefined, failedPotionId: undefined
			});
			expect(lockedCook.giveItem).not.toHaveBeenCalled();
			expect(MissionsController.update).not.toHaveBeenCalledWith(lockedCook, expect.anything(), expect.objectContaining({ missionId: "cookPotionRarity" }));
		});

		it("should give a consolation potion without effect when the roll reaches the consolation chance", async () => {
			vi.spyOn(RandomUtils.crowniclesRandom, "realZeroToOneInclusive").mockReturnValue(FAILED_CRAFT_CONSOLATION_CHANCE);
			vi.spyOn(RandomUtils.crowniclesRandom, "integer").mockReturnValue(2);

			const [packet] = await craft("potion_health_1", craftResult({ success: false }));

			const consolation = PotionDataController.instance.getById((packet as CommandReportCookingCraftRes).failedPotionId ?? -1);
			expect(consolation?.nature).toBe(ItemNature.NONE);
			expect(consolation?.rarity).toBe(2);
			expect(lockedCook.giveItem).toHaveBeenCalledWith(consolation);
			expect(ItemUtils.giveItemToPlayer).not.toHaveBeenCalled();
			expect(logCookingUse).toHaveBeenCalledWith(expect.objectContaining({ potionId: consolation?.id }));
		});

		it("should go through the inventory choice when the consolation potion does not fit", async () => {
			vi.spyOn(RandomUtils.crowniclesRandom, "realZeroToOneInclusive").mockReturnValue(0);
			lockedCook.giveItem.mockResolvedValue(false);

			await craft("potion_health_1", craftResult({ success: false }));

			expect(ItemUtils.giveItemToPlayer).toHaveBeenCalledWith(expect.any(Array), context, lockedCook, expect.objectContaining({ nature: ItemNature.NONE }));
		});

		it("should not give a consolation potion for a failed material craft", async () => {
			const roll = vi.spyOn(RandomUtils.crowniclesRandom, "realZeroToOneInclusive").mockReturnValue(0);

			const [packet] = await craft("material_alloy_1", craftResult({ success: false }));

			expect(roll).not.toHaveBeenCalled();
			expect((packet as CommandReportCookingCraftRes).failedPotionId).toBeUndefined();
			expect(Materials.giveMaterial).not.toHaveBeenCalled();
		});
	});

	describe("materials", () => {
		it("should give the output material, one more for a bonus, and count it for the material missions", async () => {
			const recipe = CookingRecipeDataController.instance.getById("material_alloy_1");

			const response = await craft("material_alloy_1", craftResult({ bonusOutput: true }));

			const quantity = (recipe?.outputMaterialQuantity ?? 0) + 1;
			expect(Materials.giveMaterial).toHaveBeenCalledWith(lockedCook.id, recipe?.outputMaterialId, quantity);
			expect(response[0]).toMatchObject({
				material: {
					materialId: recipe?.outputMaterialId, quantity
				},
				bonusOutput: true
			});
			expect(updateCollectMaterialsMission).toHaveBeenCalledWith(lockedCook, response, [{
				materialId: recipe?.outputMaterialId, quantity
			}]);
			expect(logCookingUse).toHaveBeenCalledWith(expect.objectContaining({ materialOutputId: recipe?.outputMaterialId }));
		});
	});

	describe("pet food", () => {
		const salad = (): NonNullable<ReturnType<typeof CookingRecipeDataController.instance.getById>> => {
			const recipe = CookingRecipeDataController.instance.getById("petfood_salad_1");
			if (!recipe?.petFood) {
				throw new Error("petfood_salad_1 should be a pet food recipe");
			}
			return recipe;
		};
		const saladCap = (): number => CookingService.getAvailableFoodSpace(guildWithPantry(0), PetConstants.PET_FOOD.HERBIVOROUS_FOOD);

		beforeEach(() => {
			setCook({ guildId: 9 });
			vi.mocked(Guilds.getById).mockResolvedValue(guildWithPantry(0));
			vi.spyOn(CookingService, "getHungryCompatiblePet").mockResolvedValue(null);
			vi.spyOn(CookingService, "feedPetFromSurplus").mockResolvedValue(undefined);
		});

		it("should store the whole batch in the pantry of the guild, read under its lock", async () => {
			lockedGuild = guildWithPantry(0);

			const response = await craft("petfood_salad_1", craftResult());

			const quantity = salad().petFood?.quantity;
			expect(lockedGuild.addFood).toHaveBeenCalledWith(PetConstants.PET_FOOD.HERBIVOROUS_FOOD, quantity, NumberChangeReason.COOKING);
			expect(lockedGuild.save).toHaveBeenCalledOnce();
			expect(response[0]).toMatchObject({
				petFood: {
					type: PetConstants.PET_FOOD.HERBIVOROUS_FOOD, quantity, storedQuantity: quantity
				}
			});
			expect(Materials.giveMaterial).not.toHaveBeenCalled();
			expect(updateCollectMaterialsMission).toHaveBeenCalledWith(lockedCook, response, []);
		});

		it("should feed a hungry pet with the surplus and recycle the rest into the first ingredient", async () => {
			// One room left for a bonus batch of two: one to the pet... and nothing left to recycle
			lockedGuild = guildWithPantry(saladCap() - 1);
			const pet = {} as PetEntity;
			vi.mocked(CookingService.getHungryCompatiblePet).mockResolvedValue(pet);

			const [packet] = await craft("petfood_salad_1", craftResult({ bonusOutput: true }));

			expect(lockedGuild.addFood).toHaveBeenCalledWith(PetConstants.PET_FOOD.HERBIVOROUS_FOOD, 1, NumberChangeReason.COOKING);
			expect(CookingService.feedPetFromSurplus).toHaveBeenCalledWith(lockedCook, pet, PetConstants.PET_FOOD.HERBIVOROUS_FOOD);
			expect(Materials.giveMaterial).not.toHaveBeenCalled();
			expect(packet).toMatchObject({
				petFood: {
					quantity: 2, storedQuantity: 1, fedFromSurplus: true
				},
				bonusOutput: true
			});
		});

		it("should recycle the whole surplus of a full pantry when no pet is hungry, counting it as collected materials", async () => {
			lockedGuild = guildWithPantry(saladCap());

			const response = await craft("petfood_salad_1", craftResult({ bonusOutput: true }));

			const recycled = salad().materials[0].materialId;
			expect(lockedGuild.addFood).not.toHaveBeenCalled();
			expect(lockedGuild.save).not.toHaveBeenCalled();
			expect(Materials.giveMaterial).toHaveBeenCalledWith(lockedCook.id, recycled, 2);
			expect(response[0]).toMatchObject({
				petFood: {
					quantity: 2, storedQuantity: 0, surplusMaterialId: recycled, surplusMaterialQuantity: 2
				}
			});
			expect((response[0] as CommandReportCookingCraftRes).petFood?.fedFromSurplus).toBeUndefined();
			expect(updateCollectMaterialsMission).toHaveBeenCalledWith(lockedCook, response, [{
				materialId: recycled, quantity: 2
			}]);
			expect(logCookingUse).toHaveBeenCalledWith(expect.objectContaining({
				foodType: PetConstants.PET_FOOD.HERBIVOROUS_FOOD, foodStored: 0, foodSurplus: 2
			}));
		});

		it("should route the whole batch as surplus when the guild disappeared during the craft", async () => {
			vi.mocked(withLockedEntities).mockImplementation((keys, body) => {
				if (keys.some(key => key.model === Guild)) {
					return Promise.reject(new LockedRowNotFoundError("guilds", 9));
				}
				return body([lockedCook] as never);
			});

			const [packet] = await craft("petfood_salad_1", craftResult());

			expect(packet).toMatchObject({
				petFood: {
					storedQuantity: 0, surplusMaterialQuantity: 1
				}
			});
		});

		it("should not swallow an unexpected storage error", async () => {
			vi.mocked(withLockedEntities).mockRejectedValue(new Error("database down"));

			await expect(craft("petfood_salad_1", craftResult())).rejects.toThrow("database down");
		});
	});

	describe("pinned recipe", () => {
		it("should unpin the recipe once cooked, saving the locked player", async () => {
			setCook({ pinnedCookingRecipeId: "potion_health_1" });
			vi.mocked(CookingService.getPinnedRecipeInfo).mockResolvedValue({ recipeId: "potion_health_1" } as PinnedRecipeInfo);

			await craft("potion_health_1", craftResult());

			expect(lockedCook.pinnedCookingRecipeId).toBeNull();
			expect(lockedCook.save).toHaveBeenCalledOnce();
		});

		it("should not touch the pin when cooking another recipe", async () => {
			setCook({ pinnedCookingRecipeId: "potion_energy_1" });
			vi.mocked(CookingService.getPinnedRecipeInfo).mockResolvedValue({ recipeId: "potion_energy_1" } as PinnedRecipeInfo);

			await craft("potion_health_1", craftResult());

			expect(lockedCook.save).not.toHaveBeenCalled();
		});
	});

	describe("weekly time potions", () => {
		it("should take one time potion of the week for a successful craft", async () => {
			setCook({ timePotionsCookedThisWeek: 3 });

			const [packet] = await craft("potion_time_speedup_1", craftResult());

			expect(packet).toMatchObject({ success: true });
			expect(lockedCook.timePotionsCookedThisWeek).toBe(4);
		});

		it("should give the time potion back when the craft fails", async () => {
			setCook({ timePotionsCookedThisWeek: 3 });
			vi.spyOn(RandomUtils.crowniclesRandom, "realZeroToOneInclusive").mockReturnValue(1);

			await craft("potion_time_speedup_1", craftResult({ success: false }));

			expect(lockedCook.timePotionsCookedThisWeek).toBe(3);
			expect(lockedCook.save).toHaveBeenCalledTimes(2);
		});

		it("should let a craft error out of the critical section, so its transaction gives the time potion back", async () => {
			setCook({ timePotionsCookedThisWeek: 3 });
			vi.mocked(CookingService.getSlotRecipes).mockResolvedValue([slotFor("potion_time_speedup_1", 1)]);
			executeCraft.mockRejectedValue(new Error("craft failed"));

			await expect(handleCookingCraft(KEYCLOAK_ID, {
				slotIndex: 1, recipeId: "potion_time_speedup_1"
			}, context)).rejects.toThrow("craft failed");
		});

		it("should refuse without consuming anything once the weekly limit was reached meanwhile", async () => {
			setCook({ timePotionsCookedThisWeek: TIME_POTION_WEEKLY_CRAFT_LIMIT - 1 });
			lockedCook.timePotionsCookedThisWeek = TIME_POTION_WEEKLY_CRAFT_LIMIT;

			const response = await craft("potion_time_speedup_1", craftResult());

			expect(executeCraft).not.toHaveBeenCalled();
			expect(response).toHaveLength(1);
			expect(response[0]).toMatchObject({
				success: false, error: CookingCraftErrors.TIME_POTION_WEEKLY_LIMIT, recipeId: "potion_time_speedup_1"
			});
			expect(lockedCook.timePotionsCookedThisWeek).toBe(TIME_POTION_WEEKLY_CRAFT_LIMIT);
			expect(lockedCook.save).not.toHaveBeenCalled();
		});

		it("should not count other recipes against the weekly limit", async () => {
			setCook({ timePotionsCookedThisWeek: TIME_POTION_WEEKLY_CRAFT_LIMIT });

			const [packet] = await craft("potion_health_1", craftResult());

			expect(packet).toMatchObject({ success: true });
			expect(lockedCook.save).not.toHaveBeenCalled();
		});
	});
});

describe("pinning", () => {
	const pinnedInfo = { recipeId: "potion_health_1" } as PinnedRecipeInfo;

	it("should pin a known recipe and show the menu of the view the cook came from", async () => {
		vi.mocked(CookingService.getPinnedRecipeInfo).mockResolvedValue(pinnedInfo);

		const response = await handleCookingPin(KEYCLOAK_ID, {
			recipeId: "potion_health_1", fromIgnitedView: true
		});

		expect(lockedCook.pinnedCookingRecipeId).toBe("potion_health_1");
		expect(lockedCook.save).toHaveBeenCalledOnce();
		expect(cook.pinnedCookingRecipeId).toBe("potion_health_1");
		const packet = packetOf(response, CommandReportCookingPinRes);
		expect(packet.menu).toMatchObject({
			isIgnited: true, pinnedRecipe: pinnedInfo
		});
	});

	it("should refuse to pin an unknown recipe, an undiscovered one or pet food without guild", async () => {
		vi.mocked(CookingService.getPinnedRecipeInfo).mockResolvedValue(pinnedInfo);
		vi.spyOn(PlayerCookingRecipe, "getDiscoveredRecipeIds").mockResolvedValue([]);

		for (const recipeId of ["removed_recipe", "material_wood_1", "petfood_salad_1"]) {
			expect(await handleCookingPin(KEYCLOAK_ID, {
				recipeId, fromIgnitedView: false
			})).toEqual([]);
		}
		expect(lockedCook.save).not.toHaveBeenCalled();
	});

	it("should pin a discovered recipe and pet food for a guild member", async () => {
		const guild = guildWithPantry(0);
		setCook({ guildId: 9 });
		vi.mocked(Guilds.getById).mockResolvedValue(guild);
		vi.mocked(CookingService.getPinnedRecipeInfo).mockResolvedValue(pinnedInfo);
		vi.spyOn(PlayerCookingRecipe, "getDiscoveredRecipeIds").mockResolvedValue(["material_wood_1"]);

		expect(await handleCookingPin(KEYCLOAK_ID, {
			recipeId: "material_wood_1", fromIgnitedView: false
		})).toHaveLength(1);
		expect(await handleCookingPin(KEYCLOAK_ID, {
			recipeId: "petfood_salad_1", fromIgnitedView: false
		})).toHaveLength(1);
		expect(CookingService.getPinnedRecipeInfo).toHaveBeenCalledWith({
			player: cook, homeId: HOME_ID, recipeId: "petfood_salad_1", guild
		});
	});

	it("should not pin when the recipe info can't be built", async () => {
		expect(await handleCookingPin(KEYCLOAK_ID, {
			recipeId: "potion_health_1", fromIgnitedView: false
		})).toEqual([]);
		expect(lockedCook.save).not.toHaveBeenCalled();
	});

	it("should unpin while keeping the stations displayed before the unpin", async () => {
		const displayed = [slotFor("potion_health_1", 0)];
		setCook({ pinnedCookingRecipeId: "potion_health_1" });
		vi.mocked(CookingService.getSlotRecipes).mockResolvedValueOnce(displayed).mockResolvedValue([]);

		const response = await handleCookingUnpin(KEYCLOAK_ID, { fromIgnitedView: true });

		expect(lockedCook.pinnedCookingRecipeId).toBeNull();
		expect(lockedCook.save).toHaveBeenCalledOnce();
		expect(cook.pinnedCookingRecipeId).toBeNull();
		expect(packetOf(response, CommandReportCookingUnpinRes).menu).toMatchObject({
			isIgnited: true, currentSlots: displayed
		});
		expect(CookingService.getSlotRecipes).toHaveBeenCalledOnce();
	});

	it("should unpin from the cold furnace without loading the stations", async () => {
		const response = await handleCookingUnpin(KEYCLOAK_ID, { fromIgnitedView: false });

		expect(CookingService.getSlotRecipes).not.toHaveBeenCalled();
		expect(packetOf(response, CommandReportCookingUnpinRes).menu).toMatchObject({
			isIgnited: false, currentSlots: []
		});
	});
});

describe("specialties", () => {
	let create: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		setCook({ cookingLevel: ALL_SPECIALTIES_LEVEL });
		create = vi.spyOn(PlayerCookingSpecialty, "create").mockResolvedValue({} as PlayerCookingSpecialty);
		vi.spyOn(PlayerCookingSpecialty, "getOfPlayer").mockResolvedValue([]);
		vi.mocked(CookingService.getSlotRecipes).mockResolvedValue([slotFor("potion_health_1", 1)]);
	});

	const choose = async (recipeId = "potion_health_1", slotIndex = 1): Promise<CrowniclesPacket> => {
		const [packet] = await handleCookingSetSpecialty(KEYCLOAK_ID, {
			slotIndex, recipeId
		});
		return packet;
	};

	it("should refuse a cook who has not unlocked the specialties", async () => {
		setCook({ cookingLevel: CookingSpecialtyConstants.UNLOCK_COOKING_LEVELS[0] - 1 });

		expect(await choose()).toMatchObject({ error: CookingSpecialtyErrors.UNAVAILABLE });
		expect(create).not.toHaveBeenCalled();
	});

	it("should refuse a recipe not offered on the chosen station, or hidden there", async () => {
		expect(await choose("potion_energy_1")).toMatchObject({ error: CookingSpecialtyErrors.UNAVAILABLE });
		expect(await choose("potion_health_1", 0)).toMatchObject({ error: CookingSpecialtyErrors.UNAVAILABLE });
		vi.mocked(CookingService.getSlotRecipes).mockResolvedValue([slotFor("potion_health_1", 1, { isSecret: true })]);
		expect(await choose()).toMatchObject({ error: CookingSpecialtyErrors.UNAVAILABLE });
		expect(create).not.toHaveBeenCalled();
	});

	it("should check the offer with the furnace position read under the lock", async () => {
		lockedCook.furnacePosition = 99;

		await choose();

		expect(CookingService.getSlotRecipes).toHaveBeenCalledWith({
			player: lockedCook, homeId: HOME_ID, cookingSlots: COOKING_SLOTS
		});
	});

	it("should refuse a recipe that already is a specialty", async () => {
		vi.mocked(PlayerCookingSpecialty.getOfPlayer).mockResolvedValue([{ recipeId: "potion_health_1" }] as PlayerCookingSpecialty[]);

		expect(await choose()).toMatchObject({ error: CookingSpecialtyErrors.UNAVAILABLE });
		expect(create).not.toHaveBeenCalled();
	});

	it("should refuse a new specialty once the limit of the cooking level is reached", async () => {
		setCook({ cookingLevel: CookingSpecialtyConstants.UNLOCK_COOKING_LEVELS[0] });
		vi.mocked(PlayerCookingSpecialty.getOfPlayer).mockResolvedValue([{ recipeId: "potion_energy_1" }] as PlayerCookingSpecialty[]);

		expect(await choose()).toMatchObject({ error: CookingSpecialtyErrors.LIMIT_REACHED });
		expect(create).not.toHaveBeenCalled();
	});

	it("should store the specialty, unpin it and show the ignited furnace without error", async () => {
		setCook({
			cookingLevel: ALL_SPECIALTIES_LEVEL, pinnedCookingRecipeId: "potion_health_1"
		});
		vi.mocked(PlayerCookingSpecialty.getOfPlayer).mockResolvedValue([{ recipeId: "potion_energy_1" }] as PlayerCookingSpecialty[]);

		const packet = await choose();

		expect(packet).toMatchObject({
			error: undefined, menu: { isIgnited: true }
		});
		expect(create).toHaveBeenCalledWith({
			playerId: cook.id, recipeId: "potion_health_1"
		});
		expect(lockedCook.pinnedCookingRecipeId).toBeNull();
		expect(lockedCook.save).toHaveBeenCalledOnce();
		expect(cook.pinnedCookingRecipeId).toBeNull();
		expect(cook.changed).toHaveBeenCalledWith("pinnedCookingRecipeId", false);
	});

	it("should keep another pinned recipe", async () => {
		setCook({
			cookingLevel: ALL_SPECIALTIES_LEVEL, pinnedCookingRecipeId: "potion_energy_1"
		});
		vi.mocked(CookingService.getPinnedRecipeInfo).mockResolvedValue({ recipeId: "potion_energy_1" } as PinnedRecipeInfo);

		await choose();

		expect(lockedCook.save).not.toHaveBeenCalled();
		expect(cook.pinnedCookingRecipeId).toBe("potion_energy_1");
		expect(cook.changed).not.toHaveBeenCalled();
	});

	it("should answer nothing to an unknown player", async () => {
		vi.mocked(Players.getByKeycloakId).mockResolvedValue(null);

		expect(await handleCookingSetSpecialty(KEYCLOAK_ID, {
			slotIndex: 1, recipeId: "potion_health_1"
		})).toEqual([]);
		expect(await handleCookingRemoveSpecialty(KEYCLOAK_ID, {
			recipeId: "potion_health_1", fromIgnitedView: true
		})).toEqual([]);
	});

	it("should remove a specialty of this player only", async () => {
		const destroy = vi.spyOn(PlayerCookingSpecialty, "destroy").mockResolvedValue(1);

		const [packet] = await handleCookingRemoveSpecialty(KEYCLOAK_ID, {
			recipeId: "potion_health_1", fromIgnitedView: false
		});

		expect(destroy).toHaveBeenCalledWith({
			where: {
				playerId: cook.id, recipeId: "potion_health_1"
			}
		});
		expect(packet).toMatchObject({ menu: { isIgnited: false } });
	});
});
