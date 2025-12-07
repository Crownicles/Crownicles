import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { CommandShopPacketReq } from "../../../../Lib/src/packets/commands/CommandShopPacket";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import {
	Player, Players
} from "../../core/database/game/models/Player";
import { LogsReadRequests } from "../../core/database/logs/LogsReadRequests";
import { ShopUtils } from "../../core/utils/ShopUtils";
import {
	CommandShopAlreadyHaveBadge,
	CommandShopBadgeBought,
	CommandShopBoughtTooMuchDailyPotions,
	CommandShopBoughtTooMuchTokens,
	CommandShopCannotHealOccupied,
	CommandShopClosed,
	CommandShopEnergyHeal,
	CommandShopFullRegen,
	CommandShopHealAlterationDone,
	CommandShopNoAlterationToHeal,
	CommandShopNoEnergyToHeal,
	CommandShopTokensBought,
	CommandShopTokensFull,
	CommandShopTooManyEnergyBought,
	ShopCategory,
	ShopItem
} from "../../../../Lib/src/packets/interaction/ReactionCollectorShop";
import { ShopConstants } from "../../../../Lib/src/constants/ShopConstants";
import {
	getItemValue, giveItemToPlayer, giveRandomItem, toItemWithDetails
} from "../../core/utils/ItemUtils";
import { crowniclesInstance } from "../../index";
import {
	NumberChangeReason, ShopItemType
} from "../../../../Lib/src/constants/LogsConstants";
import {
	calculateHealAlterationPrice,
	canHealAlteration,
	healAlterationAndAdvance
} from "../../core/utils/HealAlterationUtils";
import { MissionsController } from "../../core/missions/MissionsController";
import { EntityConstants } from "../../../../Lib/src/constants/EntityConstants";
import {
	Potion, PotionDataController
} from "../../data/Potion";
import { Settings } from "../../core/database/game/models/Setting";
import { InventoryInfos } from "../../core/database/game/models/InventoryInfo";
import { ItemConstants } from "../../../../Lib/src/constants/ItemConstants";
import {
	EndCallback, ReactionCollectorInstance
} from "../../core/utils/ReactionsCollector";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import {
	ReactionCollectorBuyCategorySlot,
	ReactionCollectorBuyCategorySlotBuySuccess,
	ReactionCollectorBuyCategorySlotCancelReaction,
	ReactionCollectorBuyCategorySlotReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorBuyCategorySlot";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { WhereAllowed } from "../../../../Lib/src/types/WhereAllowed";
import { Badge } from "../../../../Lib/src/types/Badge";
import { TokensConstants } from "../../../../Lib/src/constants/TokensConstants";

/**
 * Get the shop item for getting a random item
 */
function getRandomItemShopItem(): ShopItem {
	return {
		id: ShopItemType.RANDOM_ITEM,
		price: ShopConstants.RANDOM_ITEM_PRICE,
		amounts: [1],
		buyCallback: async (response, playerId, context): Promise<boolean> => {
			const player = await Players.getById(playerId);
			await giveRandomItem(context, response, player);
			return true;
		}
	};
}

/**
 * Get the shop item for healing from an alteration
 * @param player
 */
function getHealAlterationShopItem(player: Player): ShopItem {
	const price = calculateHealAlterationPrice(player);
	return {
		id: ShopItemType.ALTERATION_HEAL,
		price,
		amounts: [1],
		buyCallback: async (response, playerId): Promise<boolean> => {
			const player = await Players.getById(playerId);
			const currentDate = new Date();

			// Check if player can be healed
			const healCheck = canHealAlteration(player, currentDate);
			if (!healCheck.canHeal) {
				if (healCheck.reason === "no_alteration") {
					response.push(makePacket(CommandShopNoAlterationToHeal, {}));
				}
				else if (healCheck.reason === "occupied") {
					response.push(makePacket(CommandShopCannotHealOccupied, {}));
				}
				return false;
			}

			// Heal and advance the player
			await healAlterationAndAdvance(player, currentDate, NumberChangeReason.SHOP, response);

			response.push(makePacket(CommandShopHealAlterationDone, {}));
			return true;
		}
	};
}

/**
 * Get the shop item for recovering energy
 * @param healEnergyAlreadyPurchased
 */
function getHealEnergyShopItem(healEnergyAlreadyPurchased: number): ShopItem {
	return {
		id: ShopItemType.ENERGY_HEAL,
		price: EntityConstants.HEAL_ENERGY_PRICE[healEnergyAlreadyPurchased > EntityConstants.HEAL_ENERGY_PRICE.length - 1 ? EntityConstants.HEAL_ENERGY_PRICE.length - 1 : healEnergyAlreadyPurchased],
		amounts: [1],
		buyCallback: async (response, playerId): Promise<boolean> => {
			const player = await Players.getById(playerId);
			if (healEnergyAlreadyPurchased > EntityConstants.HEAL_ENERGY_PRICE.length - 1) {
				response.push(makePacket(CommandShopTooManyEnergyBought, {}));
				return false;
			}
			if (player.fightPointsLost === 0) {
				response.push(makePacket(CommandShopNoEnergyToHeal, {}));
				return false;
			}
			player.setEnergyLost(0, NumberChangeReason.SHOP);
			await player.save();
			response.push(makePacket(CommandShopEnergyHeal, {}));
			return true;
		}
	};
}

/**
 * Get the shop item for regenerating to full life
 */
function getRegenShopItem(): ShopItem {
	return {
		id: ShopItemType.FULL_REGEN,
		price: ShopConstants.FULL_REGEN_PRICE,
		amounts: [1],
		buyCallback: async (response, playerId): Promise<boolean> => {
			const player = await Players.getById(playerId);
			await player.addHealth(player.getMaxHealth() - player.health, response, NumberChangeReason.SHOP, {
				shouldPokeMission: true,
				overHealCountsForMission: false
			});
			await player.save();
			response.push(makePacket(CommandShopFullRegen, {}));
			return true;
		}
	};
}


/**
 * Get the shop item for the money mouth badge
 */
function getBadgeShopItem(): ShopItem {
	return {
		id: ShopItemType.MONEY_MOUTH_BADGE,
		price: ShopConstants.MONEY_MOUTH_BADGE_PRICE,
		amounts: [1],
		buyCallback: async (response, playerId): Promise<boolean> => {
			const player = await Players.getById(playerId);
			if (player.hasBadge(Badge.RICH)) {
				response.push(makePacket(CommandShopAlreadyHaveBadge, {}));
				return false;
			}
			player.addBadge(Badge.RICH);
			await player.save();
			response.push(makePacket(CommandShopBadgeBought, {}));
			return true;
		}
	};
}

/**
 * Get the shop item for buying tokens
 * @param tokensAlreadyPurchased - Number of tokens already purchased today
 */
function getTokenShopItem(tokensAlreadyPurchased: number): ShopItem {
	return {
		id: ShopItemType.TOKEN,
		price: ShopConstants.TOKEN_PRICE,
		amounts: [1],
		buyCallback: async (response, playerId): Promise<boolean> => {
			const player = await Players.getById(playerId);

			// Check if the player has already bought the maximum amount of tokens today
			if (tokensAlreadyPurchased >= ShopConstants.MAX_DAILY_TOKEN_BUYOUTS) {
				response.push(makePacket(CommandShopBoughtTooMuchTokens, {}));
				return false;
			}

			// Check if player already has max tokens
			if (player.tokens >= TokensConstants.MAX) {
				response.push(makePacket(CommandShopTokensFull, {}));
				return false;
			}

			// Add token to player
			await player.addTokens({
				amount: 1,
				response,
				reason: NumberChangeReason.SHOP
			});
			await player.save();

			response.push(makePacket(CommandShopTokensBought, { amount: 1 }));
			return true;
		}
	};
}

/**
 * Get the shop item for getting the daily potion
 * @param potion
 */
function getDailyPotionShopItem(potion: Potion): ShopItem {
	return {
		id: ShopItemType.DAILY_POTION,
		price: Math.round(getItemValue(potion) * ShopConstants.DAILY_POTION_DISCOUNT_MULTIPLIER),
		amounts: [1],
		buyCallback: async (response, playerId, context): Promise<boolean> => {
			const player = await Players.getById(playerId);
			const potionAlreadyPurchased = await LogsReadRequests.getAmountOfDailyPotionsBoughtByPlayer(player.keycloakId);
			if (potionAlreadyPurchased >= ShopConstants.MAX_DAILY_POTION_BUYOUTS) {
				response.push(makePacket(CommandShopBoughtTooMuchDailyPotions, {}));
				return false;
			}
			await giveItemToPlayer(response, context, player, potion);
			if (potionAlreadyPurchased === ShopConstants.MAX_DAILY_POTION_BUYOUTS - 1) {
				await MissionsController.update(player, response, { missionId: "dailyPotionsStock" });
			}
			return true;
		}
	};
}

function getBuySlotExtensionShopItemCallback(playerId: number, price: number): EndCallback {
	return async (collector, response): Promise<void> => {
		const player = await Players.getById(playerId);
		const reaction = collector.getFirstReaction();
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.SLOT_EXTENSION);
		if (!reaction || reaction.reaction.type === ReactionCollectorBuyCategorySlotCancelReaction.name) {
			response.push(makePacket(CommandShopClosed, {}));
			return;
		}

		const invInfo = await InventoryInfos.getOfPlayer(player.id);
		const category = (reaction.reaction.data as ReactionCollectorBuyCategorySlotReaction).categoryId;

		await player.spendMoney({
			amount: price,
			response,
			reason: NumberChangeReason.SHOP
		});
		crowniclesInstance.logsDatabase.logClassicalShopBuyout(player.keycloakId, ShopItemType.SLOT_EXTENSION)
			.then();
		invInfo.addSlotForCategory(category);
		await Promise.all([player.save(), invInfo.save()]);
		response.push(makePacket(ReactionCollectorBuyCategorySlotBuySuccess, {}));
	};
}

/**
 * Get the shop item for extending your inventory
 * @param player
 */
async function getSlotExtensionShopItem(player: Player): Promise<ShopItem | null> {
	const invInfo = await InventoryInfos.getOfPlayer(player.id);
	const availableCategories = [
		0,
		1,
		2,
		3
	]
		.map(itemCategory => ItemConstants.SLOTS.LIMITS[itemCategory] - invInfo.slotLimitForCategory(itemCategory));
	if (availableCategories.every(availableCategory => availableCategory <= 0)) {
		return null;
	}
	const totalSlots = invInfo.weaponSlots + invInfo.armorSlots
		+ invInfo.potionSlots + invInfo.objectSlots;
	const price = ItemConstants.SLOTS.PRICES[totalSlots - 4];
	if (!price) {
		return null;
	}
	return {
		id: ShopItemType.SLOT_EXTENSION,
		price,
		amounts: [1],
		buyCallback: (response, _playerId, context): boolean => {
			const collector = new ReactionCollectorBuyCategorySlot(availableCategories);

			const packet = new ReactionCollectorInstance(
				collector,
				context,
				{
					allowedPlayerKeycloakIds: [player.keycloakId]
				},
				getBuySlotExtensionShopItemCallback(player.id, price)
			)
				.block(player.keycloakId, BlockingConstants.REASONS.SLOT_EXTENSION)
				.build();

			response.push(packet);

			return false; // For this specific callback, we don't want to directly consider the purchase as successful as we need the player to choose a slot category
		}
	};
}

export default class ShopCommand {
	@commandRequires(CommandShopPacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD_OR_JAILED,
		whereAllowed: [WhereAllowed.CONTINENT]
	})
	static async execute(
		response: CrowniclesPacket[],
		player: Player,
		_packet: CommandShopPacketReq,
		context: PacketContext
	): Promise<void> {
		const healEnergyAlreadyPurchased = await LogsReadRequests.getAmountOfHealEnergyBoughtByPlayerThisWeek(player.keycloakId);
		const tokensAlreadyPurchased = await LogsReadRequests.getAmountOfTokensBoughtByPlayerToday(player.keycloakId);
		const potion = PotionDataController.instance.getById(await Settings.SHOP_POTION.getValue());

		const shopCategories: ShopCategory[] = [
			{
				id: "permanentItem",
				items: [
					getRandomItemShopItem(),
					getHealAlterationShopItem(player),
					getHealEnergyShopItem(healEnergyAlreadyPurchased),
					getRegenShopItem(),
					getBadgeShopItem()
				]
			},
			{
				id: "dailyPotion",
				items: [getDailyPotionShopItem(potion)]
			}
		];

		// Only show token category if player has unlocked tokens
		if (player.level >= TokensConstants.LEVEL_TO_UNLOCK) {
			shopCategories.push({
				id: "token",
				items: [getTokenShopItem(tokensAlreadyPurchased)]
			});
		}

		const slotExtensionItem = await getSlotExtensionShopItem(player);
		if (slotExtensionItem) {
			shopCategories.push({
				id: "slotExtension",
				items: [slotExtensionItem]
			});
		}

		await ShopUtils.createAndSendShopCollector(context, response, {
			shopCategories,
			player,
			additionalShopData: {
				remainingPotions: ShopConstants.MAX_DAILY_POTION_BUYOUTS - await LogsReadRequests.getAmountOfDailyPotionsBoughtByPlayer(player.keycloakId),
				dailyPotion: toItemWithDetails(potion),
				remainingTokens: ShopConstants.MAX_DAILY_TOKEN_BUYOUTS - tokensAlreadyPurchased
			},
			logger: crowniclesInstance.logsDatabase.logClassicalShopBuyout
		});
	}
}
