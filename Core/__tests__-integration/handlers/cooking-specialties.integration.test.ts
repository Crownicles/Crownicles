import {
	afterAll, beforeAll, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, createNoopLogsDatabase, loadProductionModule, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { Home as HomeType } from "../../src/core/database/game/models/Home";
import type { PlayerCookingSpecialty as PlayerCookingSpecialtyType } from "../../src/core/database/game/models/PlayerCookingSpecialty";
import type { PlayerCookingRecipe as PlayerCookingRecipeType } from "../../src/core/database/game/models/PlayerCookingRecipe";
import type { LogsDatabase } from "../../src/core/database/logs/LogsDatabase";
import type { CookingUseLogParams } from "../../src/core/database/logs/LogsCityLogger";
import type {
	CookingSlotData, RecipeSlotData
} from "../../../Lib/src/types/CookingTypes";
import type { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import {
	CookingCraftErrors, CookingSpecialtyErrors
} from "../../../Lib/src/types/CookingTypes";
import {
	CookingSpecialtyConstants, TIME_POTION_WEEKLY_CRAFT_LIMIT
} from "../../../Lib/src/constants/CookingConstants";

type ReportCookingServiceModule = typeof import("../../src/core/report/ReportCookingService");
type CookingServiceModule = typeof import("../../src/core/cooking/CookingService");
type MaterialModule = typeof import("../../src/core/database/game/models/Material");
type HomePlantStorageModule = typeof import("../../src/core/database/game/models/HomePlantStorage");

const HOME_LEVEL_WITH_FIVE_COOKING_SLOTS = 8;
const TIME_POTION_RECIPE_ID = "potion_time_speedup_3";

describe("cooking specialties and time potion weekly limit", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let Home: ModelStatic<HomeType>;
	let PlayerCookingSpecialty: ModelStatic<PlayerCookingSpecialtyType>;
	let PlayerCookingRecipe: ModelStatic<PlayerCookingRecipeType>;
	let reportCooking: ReportCookingServiceModule;
	let cooking: CookingServiceModule["CookingService"];
	let materials: MaterialModule["Materials"];
	let plantStorages: HomePlantStorageModule["HomePlantStorages"];

	beforeAll(async () => {
		env = await setupCoreForTests("cookingspecialties");
		const models = env.crownicles.gameDatabase.sequelize.models;
		Player = models.Player as ModelStatic<PlayerType>;
		Home = models.Home as ModelStatic<HomeType>;
		PlayerCookingSpecialty = models.PlayerCookingSpecialty as ModelStatic<PlayerCookingSpecialtyType>;
		PlayerCookingRecipe = models.PlayerCookingRecipe as ModelStatic<PlayerCookingRecipeType>;
		reportCooking = loadProductionModule<ReportCookingServiceModule>("core/report/ReportCookingService");
		cooking = loadProductionModule<CookingServiceModule>("core/cooking/CookingService").CookingService;
		materials = loadProductionModule<MaterialModule>("core/database/game/models/Material").Materials;
		plantStorages = loadProductionModule<HomePlantStorageModule>("core/database/game/models/HomePlantStorage").HomePlantStorages;
	});

	afterAll(async () => {
		await env?.teardown();
	});

	type Cook = {
		player: PlayerType;
		home: HomeType;
		keycloakId: string;
	};

	async function createCook(keycloakId: string, cookingLevel: number): Promise<Cook> {
		const player = await Player.create({
			keycloakId,
			level: 50,
			cookingLevel
		});
		await env.crownicles.gameDatabase.sequelize.models.PlayerMissionsInfo.create({ playerId: player.id });
		const home = await Home.create({
			ownerId: player.id,
			cityId: "cooking-test-city",
			level: HOME_LEVEL_WITH_FIVE_COOKING_SLOTS
		});
		return {
			player, home, keycloakId
		};
	}

	async function getSlots({
		player, home
	}: Cook): Promise<CookingSlotData[]> {
		await player.reload();
		return await cooking.getSlotRecipes({
			player, homeId: home.id, cookingSlots: home.getLevel()!.features.cookingSlots
		});
	}

	function visibleSlots(slots: CookingSlotData[]): Array<CookingSlotData & { recipe: RecipeSlotData }> {
		return slots.filter((slot): slot is CookingSlotData & { recipe: RecipeSlotData } => slot.recipe !== null && !slot.recipe.isSecret);
	}

	async function giveIngredients({
		player, home
	}: Cook, recipe: RecipeSlotData): Promise<void> {
		for (const plant of recipe.ingredients.plants) {
			await plantStorages.addPlant(home.id, plant.plantId as never, plant.quantity, 999);
		}
		for (const material of recipe.ingredients.materials) {
			await materials.giveMaterial(player.id, material.materialId, material.quantity);
		}
	}

	function packetContext(keycloakId: string): PacketContext {
		return {
			frontEndOrigin: "discord",
			frontEndSubOrigin: "guild",
			keycloakId,
			discord: {
				user: keycloakId,
				interaction: "interaction",
				channel: "channel",
				language: "fr",
				shardId: 0
			}
		} as PacketContext;
	}

	/**
	 * Answer the given weekly count of successful time potion crafts, every other log call being a no-op
	 */
	function useTimePotionsCookedThisWeek(count: number): void {
		const noop = createNoopLogsDatabase();
		env.crownicles.setLogsDatabaseForTests(new Proxy(noop, {
			get: (target, prop): unknown => (prop === "countSuccessfulCookingCraftsThisWeek"
				? (): Promise<number> => Promise.resolve(count)
				: Reflect.get(target, prop))
		}) as LogsDatabase);
	}

	/**
	 * Like the logs database, count the successful time potion crafts logged on top of the given ones
	 */
	function useLoggedTimePotions(alreadyCooked: number): void {
		let cooked = alreadyCooked;
		const noop = createNoopLogsDatabase();
		env.crownicles.setLogsDatabaseForTests(new Proxy(noop, {
			get: (target, prop): unknown => {
				if (prop === "countSuccessfulCookingCraftsThisWeek") {
					return (): Promise<number> => Promise.resolve(cooked);
				}
				if (prop === "logCookingUse") {
					return (params: CookingUseLogParams): Promise<void> => {
						if (params.success && params.recipeId.startsWith("potion_time_speedup")) {
							cooked++;
						}
						return Promise.resolve();
					};
				}
				return Reflect.get(target, prop);
			}
		}) as LogsDatabase);
	}

	it("keeps a specialty on its station at every furnace ignition, even once cooked", async () => {
		useTimePotionsCookedThisWeek(0);
		const cook = await createCook("specialty-keeper", CookingSpecialtyConstants.UNLOCK_COOKING_LEVEL);
		const chosen = visibleSlots(await getSlots(cook))[0];

		const [setResponse] = await reportCooking.handleCookingSetSpecialty(cook.keycloakId, {
			slotIndex: chosen.slotIndex,
			recipeId: chosen.recipe.id
		});
		expect(setResponse).toMatchObject({ error: undefined });
		expect((setResponse as { menu: { specialties: unknown[] } }).menu.specialties).toEqual([
			expect.objectContaining({
				slotIndex: chosen.slotIndex,
				recipeId: chosen.recipe.id
			})
		]);

		// Furnace re-rolls change the whole rotation, but never the specialty station
		for (let furnacePosition = 1; furnacePosition <= 6; furnacePosition++) {
			await Player.update({ furnacePosition }, { where: { id: cook.player.id } });
			const slots = await getSlots(cook);
			const specialtySlot = slots.find(slot => slot.slotIndex === chosen.slotIndex)!;
			expect(specialtySlot.recipe).toMatchObject({
				id: chosen.recipe.id,
				isSecret: false
			});
			expect(slots.filter(slot => slot.recipe?.id === chosen.recipe.id)).toHaveLength(1);
		}

		// Cooking the specialty does not consume it, unlike a pinned recipe
		await giveIngredients(cook, chosen.recipe);
		const [craftResponse] = await reportCooking.handleCookingCraft(cook.keycloakId, {
			slotIndex: chosen.slotIndex,
			recipeId: chosen.recipe.id
		}, packetContext(cook.keycloakId));
		expect(craftResponse).toMatchObject({ error: undefined });
		expect(await PlayerCookingSpecialty.findAll({ where: { playerId: cook.player.id } })).toEqual([
			expect.objectContaining({
				slotIndex: chosen.slotIndex,
				recipeId: chosen.recipe.id
			})
		]);
	});

	it("refuses a specialty beyond the limit and frees a station once a specialty is removed", async () => {
		useTimePotionsCookedThisWeek(0);
		const cook = await createCook("specialty-limit", CookingSpecialtyConstants.UNLOCK_COOKING_LEVEL);
		const candidates = visibleSlots(await getSlots(cook));
		expect(candidates.length).toBeGreaterThan(CookingSpecialtyConstants.MAX_SPECIALTIES);

		for (const candidate of candidates.slice(0, CookingSpecialtyConstants.MAX_SPECIALTIES)) {
			const [response] = await reportCooking.handleCookingSetSpecialty(cook.keycloakId, {
				slotIndex: candidate.slotIndex,
				recipeId: candidate.recipe.id
			});
			expect(response).toMatchObject({ error: undefined });
		}
		const extra = candidates[CookingSpecialtyConstants.MAX_SPECIALTIES];
		const [refused] = await reportCooking.handleCookingSetSpecialty(cook.keycloakId, {
			slotIndex: extra.slotIndex,
			recipeId: extra.recipe.id
		});
		expect(refused).toMatchObject({ error: CookingSpecialtyErrors.LIMIT_REACHED });
		expect(await PlayerCookingSpecialty.count({ where: { playerId: cook.player.id } })).toBe(CookingSpecialtyConstants.MAX_SPECIALTIES);

		const [removed] = await reportCooking.handleCookingRemoveSpecialty(cook.keycloakId, {
			slotIndex: candidates[0].slotIndex,
			recipeId: candidates[0].recipe.id,
			fromIgnitedView: false
		});
		expect(removed).toMatchObject({
			menu: {
				isIgnited: false,
				currentSlots: []
			}
		});
		expect((removed as { menu: { specialties: unknown[] } }).menu.specialties).toHaveLength(CookingSpecialtyConstants.MAX_SPECIALTIES - 1);

		const [accepted] = await reportCooking.handleCookingSetSpecialty(cook.keycloakId, {
			slotIndex: extra.slotIndex,
			recipeId: extra.recipe.id
		});
		expect(accepted).toMatchObject({ error: undefined });
		expect(await PlayerCookingSpecialty.count({ where: { playerId: cook.player.id } })).toBe(CookingSpecialtyConstants.MAX_SPECIALTIES);
	});

	it("refuses a specialty below the master chef level or for a recipe the station no longer offers", async () => {
		useTimePotionsCookedThisWeek(0);
		const apprentice = await createCook("specialty-apprentice", CookingSpecialtyConstants.UNLOCK_COOKING_LEVEL - 1);
		const apprenticeSlot = visibleSlots(await getSlots(apprentice))[0];
		const [apprenticeResponse] = await reportCooking.handleCookingSetSpecialty(apprentice.keycloakId, {
			slotIndex: apprenticeSlot.slotIndex,
			recipeId: apprenticeSlot.recipe.id
		});
		expect(apprenticeResponse).toMatchObject({ error: CookingSpecialtyErrors.UNAVAILABLE });
		expect((apprenticeResponse as { menu: { specialties?: unknown[] } }).menu.specialties).toBeUndefined();

		const master = await createCook("specialty-stale", CookingSpecialtyConstants.UNLOCK_COOKING_LEVEL);
		const [first, second] = visibleSlots(await getSlots(master));
		const [staleResponse] = await reportCooking.handleCookingSetSpecialty(master.keycloakId, {
			slotIndex: first.slotIndex,
			recipeId: second.recipe.id
		});
		expect(staleResponse).toMatchObject({ error: CookingSpecialtyErrors.UNAVAILABLE });

		expect(await PlayerCookingSpecialty.count({ where: { playerId: [apprentice.player.id, master.player.id] } })).toBe(0);
	});

	it("blocks the time potions once the weekly limit is reached, without consuming the ingredients", async () => {
		const cook = await createCook("time-potion-limit", CookingSpecialtyConstants.UNLOCK_COOKING_LEVEL);
		await PlayerCookingRecipe.create({
			playerId: cook.player.id,
			recipeId: TIME_POTION_RECIPE_ID
		});
		await Player.update({ pinnedCookingRecipeId: TIME_POTION_RECIPE_ID }, { where: { id: cook.player.id } });
		const findTimePotionSlot = async (): Promise<CookingSlotData & { recipe: RecipeSlotData }> =>
			visibleSlots(await getSlots(cook)).find(slot => slot.recipe.id === TIME_POTION_RECIPE_ID)!;

		useTimePotionsCookedThisWeek(TIME_POTION_WEEKLY_CRAFT_LIMIT - 1);
		const lastTimePotionSlot = await findTimePotionSlot();
		await giveIngredients(cook, lastTimePotionSlot.recipe);
		expect((await findTimePotionSlot()).recipe).toMatchObject({
			timePotionsLeftThisWeek: 1,
			canCraft: true
		});

		useTimePotionsCookedThisWeek(TIME_POTION_WEEKLY_CRAFT_LIMIT);
		const blockedSlot = await findTimePotionSlot();
		expect(blockedSlot.recipe).toMatchObject({
			timePotionsLeftThisWeek: 0,
			canCraft: false
		});
		const materialsBefore = await materials.getPlayerMaterials(cook.player.id);

		const [craftResponse] = await reportCooking.handleCookingCraft(cook.keycloakId, {
			slotIndex: blockedSlot.slotIndex,
			recipeId: TIME_POTION_RECIPE_ID
		}, packetContext(cook.keycloakId));

		expect(craftResponse).toMatchObject({
			success: false,
			error: CookingCraftErrors.TIME_POTION_WEEKLY_LIMIT,
			cookingXpGained: 0
		});
		expect(await materials.getPlayerMaterials(cook.player.id)).toEqual(materialsBefore);
		expect((await findTimePotionSlot()).recipe.ingredients).toEqual(blockedSlot.recipe.ingredients);
	});

	it("counts the time potion just cooked in the menu shown after the craft", async () => {
		const cook = await createCook("time-potion-specialty", CookingSpecialtyConstants.UNLOCK_COOKING_LEVEL);
		await PlayerCookingRecipe.create({
			playerId: cook.player.id,
			recipeId: TIME_POTION_RECIPE_ID
		});

		// The pin brings the time potion on a station, where the master chef makes it a specialty
		await Player.update({ pinnedCookingRecipeId: TIME_POTION_RECIPE_ID }, { where: { id: cook.player.id } });
		useLoggedTimePotions(TIME_POTION_WEEKLY_CRAFT_LIMIT - 1);
		const pinnedSlot = visibleSlots(await getSlots(cook)).find(slot => slot.recipe.id === TIME_POTION_RECIPE_ID)!;
		const [setResponse] = await reportCooking.handleCookingSetSpecialty(cook.keycloakId, {
			slotIndex: pinnedSlot.slotIndex,
			recipeId: TIME_POTION_RECIPE_ID
		});
		expect(setResponse).toMatchObject({ error: undefined });
		expect((await Player.findByPk(cook.player.id))!.pinnedCookingRecipeId).toBeNull();

		await giveIngredients(cook, pinnedSlot.recipe);
		const [craftResponse] = await reportCooking.handleCookingCraft(cook.keycloakId, {
			slotIndex: pinnedSlot.slotIndex,
			recipeId: TIME_POTION_RECIPE_ID
		}, packetContext(cook.keycloakId));

		// The craft may fail: only a successful one bends time
		const craft = craftResponse as {
			success: boolean;
			error?: string;
			menu: { currentSlots: CookingSlotData[] };
		};
		expect(craft.error).toBeUndefined();
		expect(craft.menu.currentSlots.find(slot => slot.slotIndex === pinnedSlot.slotIndex)!.recipe).toMatchObject({
			id: TIME_POTION_RECIPE_ID,
			timePotionsLeftThisWeek: craft.success ? 0 : 1
		});
	});
});
