import {
	afterEach, describe, expect, it, vi
} from "vitest";
import {
	CrowniclesPacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { ItemFoundPacket } from "../../../../Lib/src/packets/events/ItemFoundPacket";
import {
	ItemNature, ItemRarity
} from "../../../../Lib/src/constants/ItemConstants";
import { ItemWithDetails } from "../../../../Lib/src/types/ItemWithDetails";
import { CookingRecipeData } from "../../../src/data/CookingRecipeData";
import {
	Potion, PotionDataController
} from "../../../src/data/Potion";
import { Player } from "../../../src/core/database/game/models/Player";
import * as ItemUtils from "../../../src/core/utils/ItemUtils";
import { handlePotionOutput } from "../../../src/core/report/ReportCookingService";

describe("handlePotionOutput", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("uses the standard item flow so a cooked potion emits ItemFoundPacket", async () => {
		const potion = { id: 42 } as Potion;
		const player = { giveItem: vi.fn() } as unknown as Player;
		const context = { frontEndOrigin: "discord" } as PacketContext;
		const recipe = {
			potionNature: ItemNature.HEALTH,
			potionRarity: ItemRarity.RARE
		} as CookingRecipeData;
		const itemFoundPacket = {
			type: ItemFoundPacket.name,
			data: { itemWithDetails: {} as ItemWithDetails }
		} as CrowniclesPacket;

		vi.spyOn(PotionDataController.instance, "hasItemWithNatureAndRarity").mockReturnValue(true);
		vi.spyOn(PotionDataController.instance, "randomItem").mockReturnValue(potion);
		vi.spyOn(ItemUtils, "giveItemToPlayer").mockImplementation(async response => {
			response.push(itemFoundPacket);
		});

		const result = await handlePotionOutput({
			player, recipe, context, bonus: false
		});

		expect(ItemUtils.giveItemToPlayer).toHaveBeenCalledWith(expect.any(Array), context, player, potion);
		expect(player.giveItem).not.toHaveBeenCalled();
		expect(result.inventorySwapPackets).toEqual([itemFoundPacket]);
	});
});