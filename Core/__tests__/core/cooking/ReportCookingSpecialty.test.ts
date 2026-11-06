import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";
import {
	Player, Players
} from "../../../src/core/database/game/models/Player";
import {
	Home, Homes
} from "../../../src/core/database/game/models/Home";
import { CookingService } from "../../../src/core/cooking/CookingService";
import { handleCookingSetSpecialty } from "../../../src/core/report/ReportCookingService";
import {
	CookingOutputType, CookingSpecialtyConstants, RecipeType, SLOT_CONFIGS
} from "../../../../Lib/src/constants/CookingConstants";
import {
	CookingSlotData, CookingSpecialtyErrors
} from "../../../../Lib/src/types/CookingTypes";

const MATERIAL_ONLY_SLOT = SLOT_CONFIGS.findIndex(config => !config.eligibleTypes.includes(RecipeType.POTION_HEALTH));
const HEALTH_POTION_SLOT = SLOT_CONFIGS.findIndex(config => config.eligibleTypes.includes(RecipeType.POTION_HEALTH) && config.minLevel <= 1);

function healthPotionOnSlot(slotIndex: number): CookingSlotData {
	return {
		slotIndex,
		recipe: {
			id: "potion_health_1",
			level: 1,
			isSecret: false,
			outputDescription: "potion_health_1",
			outputType: CookingOutputType.POTION,
			recipeType: RecipeType.POTION_HEALTH,
			ingredients: {
				plants: [],
				materials: []
			},
			canCraft: true
		}
	};
}

describe("handleCookingSetSpecialty", () => {
	let withLockedSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		const masterChef = {
			id: 1,
			cookingLevel: CookingSpecialtyConstants.UNLOCK_COOKING_LEVEL,
			guildId: null,
			pinnedCookingRecipeId: null
		} as Player;
		vi.spyOn(Players, "getByKeycloakId").mockResolvedValue(masterChef);
		vi.spyOn(Homes, "getOfPlayer").mockResolvedValue({
			id: 1,
			getLevel: () => ({ features: { cookingSlots: SLOT_CONFIGS.length } })
		} as unknown as Home);
		vi.spyOn(CookingService, "getSpecialtiesInfo").mockResolvedValue([]);
		withLockedSpy = vi.spyOn(Player, "withLocked").mockResolvedValue(null);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should refuse a recipe swapped onto a station that can't offer it, since it would never come back there", async () => {
		// A kept recipe anchored elsewhere can push a health potion onto a station reserved to other recipes
		vi.spyOn(CookingService, "getSlotRecipes").mockResolvedValue([healthPotionOnSlot(MATERIAL_ONLY_SLOT)]);

		const [response] = await handleCookingSetSpecialty("master-chef", {
			slotIndex: MATERIAL_ONLY_SLOT,
			recipeId: "potion_health_1"
		});

		expect(response).toMatchObject({ error: CookingSpecialtyErrors.UNAVAILABLE });
		expect(withLockedSpy).not.toHaveBeenCalled();
	});

	it("should store a recipe offered on a station that can offer it", async () => {
		vi.spyOn(CookingService, "getSlotRecipes").mockResolvedValue([healthPotionOnSlot(HEALTH_POTION_SLOT)]);

		const [response] = await handleCookingSetSpecialty("master-chef", {
			slotIndex: HEALTH_POTION_SLOT,
			recipeId: "potion_health_1"
		});

		expect(response).toMatchObject({ error: undefined });
		expect(withLockedSpy).toHaveBeenCalledOnce();
	});
});
