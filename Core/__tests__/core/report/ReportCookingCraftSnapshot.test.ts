import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";
import { handleCookingCraft, handleCookingMenu, handleCookingIgnite, handleCookingWoodConfirm, handleCookingRevive } from "../../../src/core/report/ReportCookingService";
import {
	CommandReportCookingCraftReq, CookingCraftErrors, CookingSlotData, CommandReportCookingUnavailableRes
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import type { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CookingOutputType, RecipeType
} from "../../../../Lib/src/constants/CookingConstants";
import {
	CookingRecipeData, CookingRecipeDataController
} from "../../../src/data/CookingRecipeData";
import { CookingService } from "../../../src/core/cooking/CookingService";
import {
	Player, Players
} from "../../../src/core/database/game/models/Player";
import {
	Home, Homes
} from "../../../src/core/database/game/models/Home";
import {MaterialRarity} from "../../../../Lib/src/types/MaterialRarity";

const player = {
	id: 42,
	keycloakId: "cooking-player",
	cookingLevel: 0,
	guildId: null,
	pinnedCookingRecipeId: null
} as Player;

const home = {
	id: 24,
	getLevel: () => ({
		features: { cookingSlots: 4 }
	})
} as Home;

const currentRecipeId = "potion_health_1";
const displayedRecipeId = "material_iron_1";

const currentSlot: CookingSlotData = {
	slotIndex: 3,
	recipe: {
		id: currentRecipeId,
		level: 1,
		isSecret: false,
		outputDescription: "",
		outputType: CookingOutputType.POTION,
		recipeType: RecipeType.POTION_HEALTH,
		ingredients: { plants: [], materials: [] },
		canCraft: true
	}
};

const currentRecipe = {
	id: currentRecipeId,
	outputType: CookingOutputType.POTION
} as CookingRecipeData;

describe("handleCookingCraft snapshot guard", () => {
	beforeEach(() => {
		vi.spyOn(Players, "getByKeycloakId").mockResolvedValue(player);
		vi.spyOn(Homes, "getOfPlayer").mockResolvedValue(home);
		vi.spyOn(CookingService, "getSlotRecipes").mockResolvedValue([currentSlot]);
		vi.spyOn(CookingRecipeDataController.instance, "getById").mockReturnValue(currentRecipe);
		vi.spyOn(CookingService, "executeCraft").mockResolvedValue({} as never);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("does not craft a recipe that replaced the one shown in the clicked slot", async () => {
		const packet = new CommandReportCookingCraftReq();
		packet.slotIndex = currentSlot.slotIndex;
		packet.recipeId = displayedRecipeId;

		const response = await handleCookingCraft(player.keycloakId, packet, {} as PacketContext);

		expect(CookingService.executeCraft).not.toHaveBeenCalled();
		expect(response).toHaveLength(1);
		expect(response[0]).toMatchObject({
			success: false,
			error: CookingCraftErrors.CRAFT_UNAVAILABLE,
			recipeId: currentRecipeId,
			menu: {
				currentSlots: [currentSlot],
				isIgnited: true
			}
		});
	});

	it("answers unavailable when no cooking-capable home exists", async () => {
		vi.mocked(Homes.getOfPlayer).mockResolvedValue(null);
		for (const response of [
			await handleCookingMenu(player.keycloakId, {}),
			await handleCookingIgnite(player.keycloakId, {}),
			await handleCookingCraft(player.keycloakId, {recipeId: currentRecipeId, slotIndex: 3}, {} as PacketContext)
		]) {
			expect(response).toHaveLength(1);
			expect(response[0]).toBeInstanceOf(CommandReportCookingUnavailableRes);
		}
	});

	it("does not consume wood when confirmation has expired or is refused", async () => {
		const pendingMissing = await handleCookingWoodConfirm(player.keycloakId, {accepted: true});
		expect(pendingMissing[0]).toBeInstanceOf(CommandReportCookingUnavailableRes);
		const declined = await handleCookingWoodConfirm(player.keycloakId, {accepted: false});
		expect(declined[0]).toMatchObject({menu: {isIgnited: false, currentSlots: []}});
		expect(CookingService.executeCraft).not.toHaveBeenCalled();
	});

	it("keeps the lit menu when a rare-wood revival is declined", async () => {
		vi.spyOn(CookingService, "getWoodToConsume").mockResolvedValue({materialId: 9, rarity: MaterialRarity.UNCOMMON, needsConfirmation: true});
		await handleCookingRevive(player.keycloakId, {});
		const response = await handleCookingWoodConfirm(player.keycloakId, {accepted: false});
		expect(response[0]).toMatchObject({menu: {isIgnited: true, currentSlots: [currentSlot]}});
	});
});
