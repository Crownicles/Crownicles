import {
	CrowniclesPacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { ExpeditionRewardData } from "../../../../Lib/src/packets/commands/CommandPetExpeditionPacket";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import Player from "../database/game/models/Player";
import {
	giveItemToPlayer, getItemByIdAndCategory
} from "../utils/ItemUtils";

/**
 * Apply a currency reward to the player if amount is positive
 */
async function applyMoneyReward(player: Player, response: CrowniclesPacket[], amount: number): Promise<void> {
	if (amount > 0) {
		await player.addMoney({
			amount, response, reason: NumberChangeReason.SMALL_EVENT
		});
	}
}

/**
 * Apply experience reward to the player if amount is positive
 */
async function applyExperienceReward(player: Player, response: CrowniclesPacket[], amount: number): Promise<void> {
	if (amount > 0) {
		await player.addExperience({
			amount, response, reason: NumberChangeReason.SMALL_EVENT
		});
	}
}

/**
 * Apply score reward to the player if amount is positive
 */
async function applyScoreReward(player: Player, response: CrowniclesPacket[], amount: number): Promise<void> {
	if (amount > 0) {
		await player.addScore({
			amount, response, reason: NumberChangeReason.SMALL_EVENT
		});
	}
}

/**
 * Apply item reward to the player if item is present
 */
async function applyItemReward(
	player: Player,
	response: CrowniclesPacket[],
	context: PacketContext,
	itemId: number | undefined,
	itemCategory: number | undefined
): Promise<void> {
	if (itemId !== undefined && itemCategory !== undefined) {
		const item = getItemByIdAndCategory(itemId, itemCategory);
		if (item) {
			await giveItemToPlayer(response, context, player, item);
		}
	}
}

/**
 * Apply expedition rewards to player
 */
export async function applyExpeditionRewards(
	rewards: ExpeditionRewardData,
	player: Player,
	response: CrowniclesPacket[],
	context: PacketContext
): Promise<void> {
	await applyMoneyReward(player, response, rewards.money);
	await applyExperienceReward(player, response, rewards.experience);
	await applyScoreReward(player, response, rewards.points);
	await applyItemReward(player, response, context, rewards.itemId, rewards.itemCategory);

	if (rewards.cloneTalismanFound) {
		player.hasCloneTalisman = true;
	}
}
