import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";
import { handleCookingCraft } from "../../../src/core/report/ReportCookingService";
import {
	CommandReportCookingCraftReq, CookingCraftErrors, CookingSlotData
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
});
