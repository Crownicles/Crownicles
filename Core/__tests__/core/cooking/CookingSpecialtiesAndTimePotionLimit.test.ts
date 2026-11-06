import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";
import { CookingService } from "../../../src/core/cooking/CookingService";
import { setCrowniclesInstanceForTests } from "../../../src/app";
import { Crownicles } from "../../../src/core/bot/Crownicles";
import Player from "../../../src/core/database/game/models/Player";
import { PlayerCookingSpecialty } from "../../../src/core/database/game/models/PlayerCookingSpecialty";
import { CookingRecipeDataController } from "../../../src/data/CookingRecipeData";
import {
	CookingSpecialtyConstants, RecipeType, TIME_POTION_WEEKLY_CRAFT_LIMIT
} from "../../../../Lib/src/constants/CookingConstants";
import { CookingRecipe } from "../../../../Lib/src/types/CookingRecipe";

// Cooking level unlocking every specialty, and the one before the first specialty
const ALL_SPECIALTIES_LEVEL = CookingSpecialtyConstants.UNLOCK_COOKING_LEVELS[CookingSpecialtyConstants.MAX_SPECIALTIES - 1];
const BEFORE_SPECIALTIES_LEVEL = CookingSpecialtyConstants.UNLOCK_COOKING_LEVELS[0] - 1;

const recipe = (id: string): CookingRecipe => CookingRecipeDataController.instance.getById(id)!;

describe("CookingService - time potion weekly limit", () => {
	const countSuccessfulCookingCraftsThisWeek = vi.fn<(keycloakId: string, recipeIds: string[]) => Promise<number>>();
	const player = { keycloakId: "time-cook" } as Player;

	beforeEach(() => {
		countSuccessfulCookingCraftsThisWeek.mockReset();
		setCrowniclesInstanceForTests({
			logsDatabase: { countSuccessfulCookingCraftsThisWeek }
		} as unknown as Crownicles);
	});

	afterEach(() => {
		setCrowniclesInstanceForTests(null);
	});

	it("should count the successful crafts of every time potion recipe this week", async () => {
		countSuccessfulCookingCraftsThisWeek.mockResolvedValue(3);

		const left = await CookingService.getTimePotionsLeftThisWeek(player, [recipe("potion_health_1"), recipe("potion_time_speedup_3")]);

		expect(left).toBe(TIME_POTION_WEEKLY_CRAFT_LIMIT - 3);
		const [keycloakId, recipeIds] = countSuccessfulCookingCraftsThisWeek.mock.calls[0];
		expect(keycloakId).toBe("time-cook");
		expect([...recipeIds].sort()).toEqual(CookingRecipeDataController.instance
			.getByType(RecipeType.POTION_TIME_SPEEDUP)
			.map(timeRecipe => timeRecipe.id)
			.sort());
	});

	it("should never go below zero once the limit is reached", async () => {
		countSuccessfulCookingCraftsThisWeek.mockResolvedValue(TIME_POTION_WEEKLY_CRAFT_LIMIT + 2);

		expect(await CookingService.getTimePotionsLeftThisWeek(player, [recipe("potion_time_speedup_3")])).toBe(0);
	});

	it("should not query the logs when no time potion recipe is offered", async () => {
		expect(await CookingService.getTimePotionsLeftThisWeek(player, [recipe("potion_health_1"), null])).toBeUndefined();
		expect(countSuccessfulCookingCraftsThisWeek).not.toHaveBeenCalled();
	});
});

describe("CookingService - getSpecialties", () => {
	const masterChef = {
		id: 7,
		cookingLevel: ALL_SPECIALTIES_LEVEL
	} as Player;

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should ignore the specialties while they are not unlocked", async () => {
		const getOfPlayerSpy = vi.spyOn(PlayerCookingSpecialty, "getOfPlayer");

		const specialties = await CookingService.getSpecialties({
			...masterChef,
			cookingLevel: BEFORE_SPECIALTIES_LEVEL
		} as Player, []);

		expect(specialties).toEqual([]);
		expect(getOfPlayerSpy).not.toHaveBeenCalled();
	});

	it("should only offer as many specialties as the cooking level allows", async () => {
		vi.spyOn(PlayerCookingSpecialty, "getOfPlayer").mockResolvedValue([
			{
				playerId: 7, recipeId: "potion_health_1"
			},
			{
				playerId: 7, recipeId: "potion_energy_1"
			}
		] as PlayerCookingSpecialty[]);

		const specialties = await CookingService.getSpecialties({
			...masterChef,
			cookingLevel: CookingSpecialtyConstants.UNLOCK_COOKING_LEVELS[0]
		} as Player, []);

		expect(specialties).toHaveLength(1);
	});

	it("should delete the specialties whose recipe no longer exists or is no longer known, and sort the others by level", async () => {
		vi.spyOn(PlayerCookingSpecialty, "getOfPlayer").mockResolvedValue([
			{
				playerId: 7, recipeId: "potion_time_speedup_3"
			},
			{
				playerId: 7, recipeId: "removed_recipe"
			},
			{
				playerId: 7, recipeId: "potion_health_1"
			},
			{
				playerId: 7, recipeId: "potion_health_2"
			}
		] as PlayerCookingSpecialty[]);
		const destroySpy = vi.spyOn(PlayerCookingSpecialty, "destroy").mockResolvedValue(1);

		// potion_health_1 is known by default, potion_time_speedup_3 was discovered, potion_health_2 was not
		const specialties = await CookingService.getSpecialties(masterChef, ["potion_time_speedup_3"]);

		expect(specialties.map(specialty => specialty.id)).toEqual(["potion_health_1", "potion_time_speedup_3"]);
		expect(destroySpy.mock.calls.map(([options]) => options?.where)).toEqual([
			{
				playerId: 7, recipeId: "removed_recipe"
			},
			{
				playerId: 7, recipeId: "potion_health_2"
			}
		]);
	});
});
