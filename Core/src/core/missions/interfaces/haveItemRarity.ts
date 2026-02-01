import { IMission } from "../IMission";
import { haveRarityOrMore } from "../../utils/ItemUtils";
import { InventorySlots } from "../../database/game/models/InventorySlot";

export const missionInterface: IMission = {
	generateRandomVariant: () => 0,

	areParamsMatchingVariantAndBlob: (variant, params) => (params.rarity as number) >= variant,

	initialNumberDone: async (player, variant) => haveRarityOrMore(await InventorySlots.getOfPlayer(player.id), variant) ? 1 : 0,

	updateSaveBlob: () => null
};
