import {
	CrowniclesPacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { ExpeditionRewardDataWithItem } from "./ExpeditionRewardCalculator";
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
 * Apply token reward to the player if amount is positive
 */
async function applyTokensReward(player: Player, response: CrowniclesPacket[], amount: number): Promise<void> {
	if (amount > 0) {
		await player.addTokens({
			amount, response, reason: NumberChangeReason.SMALL_EVENT
		});
	}
}

/**
 * Item reward parameters
 */
interface ItemRewardParams {
	player: Player;
	response: CrowniclesPacket[];
	context: PacketContext;
	itemId: number;
	itemCategory: number;
}

/**
 * Apply item reward to the player
 */
async function applyItemReward(params: ItemRewardParams): Promise<void> {
	const {
		player, response, context, itemId, itemCategory
	} = params;

	const item = getItemByIdAndCategory(itemId, itemCategory);
	if (!item) {
		return;
	}

	await giveItemToPlayer(response, context, player, item);
}

/**
 * Apply expedition rewards to player
 */
export async function applyExpeditionRewards(
	rewards: ExpeditionRewardDataWithItem,
	player: Player,
	response: CrowniclesPacket[],
	context: PacketContext
): Promise<void> {
	await applyMoneyReward(player, response, rewards.money);
	await applyExperienceReward(player, response, rewards.experience);
	await applyScoreReward(player, response, rewards.points);
	await applyTokensReward(player, response, rewards.tokens ?? 0);
	await applyItemReward({
		player,
		response,
		context,
		itemId: rewards.itemId,
		itemCategory: rewards.itemCategory
	});

	if (rewards.cloneTalismanFound) {
		player.hasCloneTalisman = true;
	}
}
