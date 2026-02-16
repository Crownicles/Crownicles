import Player from "../database/game/models/Player";
import { GuildConstants } from "../../../../Lib/src/constants/GuildConstants";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import {
	Guild, Guilds
} from "../database/game/models/Guild";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { giveFoodToGuild } from "../utils/FoodUtils";
import {
	generateRandomItem, giveItemToPlayer
} from "../utils/ItemUtils";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventUltimateFoodMerchantPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventUltimateFoodMerchantPacket";
import { SmallEventFuncs } from "../../data/SmallEvent";
import { Maps } from "../maps/Maps";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { ErrorPacket } from "../../../../Lib/src/packets/commands/ErrorPacket";
import { BlessingManager } from "../blessings/BlessingManager";

/**
 * Return the min rarity the player can get on an item
 * @param player
 */
function minRarity(player: Player): number {
	return Math.floor(5 * Math.tanh(player.level / 125) + 1);
}

/**
 * Return the max rarity the player can get on an item
 * @param player
 */
function maxRarity(player: Player): number {
	return Math.ceil(7 * Math.tanh(player.level / 62));
}

/**
 * Return the quantity of food the player can get
 * @param player
 * @param currentFoodLevel
 * @param ultimate
 */
function foodAmount(player: Player, currentFoodLevel: number, ultimate: boolean): number {
	const food = ultimate ? SmallEventConstants.ULTIMATE_FOOD_MERCHANT.ULTIMATE_FOOD : SmallEventConstants.ULTIMATE_FOOD_MERCHANT.COMMON_FOOD;
	return Math.max(Math.min(
		Math.ceil(food.MULTIPLIER * Math.tanh(player.level / 100))
		+ RandomUtils.variationInt(food.VARIATION),
		(ultimate ? GuildConstants.MAX_ULTIMATE_PET_FOOD : GuildConstants.MAX_COMMON_PET_FOOD) - currentFoodLevel
	), 1);
}

/**
 * Return the reward for the player
 * @param player
 * @param guild
 */
function generateReward(player: Player, guild: Guild | null): string {
	if (!guild) {
		return SmallEventConstants.ULTIMATE_FOOD_MERCHANT.INTERACTIONS_NAMES.MONEY;
	}
	if (player.level >= SmallEventConstants.ULTIMATE_FOOD_MERCHANT.MINIMUM_LEVEL_GOOD_PLAYER) {
		return RandomUtils.crowniclesRandom.bool()
			? guild.ultimateFood < GuildConstants.MAX_ULTIMATE_PET_FOOD
				? SmallEventConstants.ULTIMATE_FOOD_MERCHANT.INTERACTIONS_NAMES.ULTIMATE_FOOD
				: SmallEventConstants.ULTIMATE_FOOD_MERCHANT.INTERACTIONS_NAMES.FULL_ULTIMATE_FOOD
			: SmallEventConstants.ULTIMATE_FOOD_MERCHANT.INTERACTIONS_NAMES.ITEM;
	}

	if (GuildConstants.MAX_COMMON_PET_FOOD > guild.commonFood) {
		return SmallEventConstants.ULTIMATE_FOOD_MERCHANT.INTERACTIONS_NAMES.COMMON_FOOD;
	}

	return SmallEventConstants.ULTIMATE_FOOD_MERCHANT.INTERACTIONS_NAMES.FULL_COMMON_FOOD;
}

/**
 * Give the reward to the player
 * @param packet
 * @param response
 * @param context
 * @param player
 * @param guild
 */
async function giveReward(packet: SmallEventUltimateFoodMerchantPacket, response: CrowniclesPacket[], context: PacketContext, player: Player, guild: Guild | null): Promise<void> {
	switch (packet.interactionName) {
		case SmallEventConstants.ULTIMATE_FOOD_MERCHANT.INTERACTIONS_NAMES.ULTIMATE_FOOD:
			packet.amount = foodAmount(player, guild!.ultimateFood, true);
			await giveFoodToGuild(response, player, SmallEventConstants.ULTIMATE_FOOD_MERCHANT.INTERACTIONS_NAMES.ULTIMATE_FOOD, packet.amount, NumberChangeReason.SMALL_EVENT);
			break;
		case SmallEventConstants.ULTIMATE_FOOD_MERCHANT.INTERACTIONS_NAMES.ITEM:
			await giveItemToPlayer(response, context, player, generateRandomItem({
				minRarity: minRarity(player),
				maxRarity: maxRarity(player)
			}));
			break;
		case SmallEventConstants.ULTIMATE_FOOD_MERCHANT.INTERACTIONS_NAMES.COMMON_FOOD:
			packet.amount = foodAmount(player, guild!.commonFood, false);
			await giveFoodToGuild(response, player, SmallEventConstants.ULTIMATE_FOOD_MERCHANT.INTERACTIONS_NAMES.COMMON_FOOD, packet.amount, NumberChangeReason.SMALL_EVENT);
			break;
		case SmallEventConstants.ULTIMATE_FOOD_MERCHANT.INTERACTIONS_NAMES.MONEY:
			packet.amount = SmallEventConstants.ULTIMATE_FOOD_MERCHANT.MONEY_WON_NO_GUILD + player.level;
			await player.addMoney({
				amount: packet.amount,
				response,
				reason: NumberChangeReason.SMALL_EVENT
			});
			packet.amount = BlessingManager.getInstance().applyMoneyBlessing(packet.amount);
			break;

		case SmallEventConstants.ULTIMATE_FOOD_MERCHANT.INTERACTIONS_NAMES.FULL_ULTIMATE_FOOD:
		case SmallEventConstants.ULTIMATE_FOOD_MERCHANT.INTERACTIONS_NAMES.FULL_COMMON_FOOD:
			break;
		default:
			packet.interactionName = Constants.DEFAULT_ERROR;
			break;
	}
	await player.save();
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: Maps.isOnContinent,
	executeSmallEvent: async (response, player, context): Promise<void> => {
		let guild: Guild | null;
		try {
			guild = await Guilds.getById(player.guildId);
		}
		catch {
			guild = null;
		}
		const packet: SmallEventUltimateFoodMerchantPacket = { interactionName: generateReward(player, guild) };
		await giveReward(packet, response, context, player, guild);
		if (packet.interactionName === Constants.DEFAULT_ERROR) {
			response.push(makePacket(ErrorPacket, { message: "SmallEvent Ultimate Food Merchant : cannot determine an interaction for the user" }));
			return;
		}
		response.push(makePacket(SmallEventUltimateFoodMerchantPacket, packet));
	}
};
