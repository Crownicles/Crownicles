import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandGuildShopEmpty,
	CommandGuildShopGiveXp,
	CommandGuildShopNoFoodStorageSpace,
	CommandGuildShopPacketReq
} from "../../../../Lib/src/packets/commands/CommandGuildShopPacket";
import {
	Player, Players
} from "../../core/database/game/models/Player";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	ShopCategory, ShopItem
} from "../../../../Lib/src/packets/interaction/ReactionCollectorShop";
import { GuildShopConstants } from "../../../../Lib/src/constants/GuildShopConstants";
import { Guilds } from "../../core/database/game/models/Guild";
import { GuildUtils } from "../../core/utils/GuildUtils";
import {
	NumberChangeReason, ShopItemType
} from "../../../../Lib/src/constants/LogsConstants";
import { crowniclesInstance } from "../../index";
import {
	getFoodIndexOf, giveFoodToGuild
} from "../../core/utils/FoodUtils";
import { MissionsController } from "../../core/missions/MissionsController";
import { GuildConstants } from "../../../../Lib/src/constants/GuildConstants";
import { ShopUtils } from "../../core/utils/ShopUtils";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { shopItemTypeFromId } from "../../../../Lib/src/utils/ShopUtils";
import { WhereAllowed } from "../../../../Lib/src/types/WhereAllowed";
import { LockManager } from "../../../../Lib/src/locks/LockManager";

const giveXpLockManager = new LockManager();

async function giveGuildXp(response: CrowniclesPacket[], playerId: number, price: number): Promise<boolean> {
	const player = (await Players.getById(playerId))!;

	const lock = giveXpLockManager.getLock(player.guildId!);
	const release = await lock.acquire();
	try {
		const guild = (await Guilds.getById(player.guildId))!;

		const xpToAdd = GuildUtils.calculateAmountOfXPToAdd(price);
		await guild.addExperience({
			amount: xpToAdd, response, reason: NumberChangeReason.SHOP
		});
		await guild.save();

		response.push(makePacket(CommandGuildShopGiveXp, { xp: xpToAdd }));
	}
	finally {
		release();
	}

	return true;
}

/**
 * Get the shop item for winning xp
 */
function getGuildXPShopItem(): ShopItem {
	return {
		id: ShopItemType.SMALL_GUILD_XP,
		price: GuildShopConstants.PRICES.SMALL_XP,
		amounts: [1],
		buyCallback: async (response: CrowniclesPacket[], playerId: number): Promise<boolean> => await giveGuildXp(response, playerId, GuildShopConstants.PRICES.SMALL_XP)
	};
}

/**
 * Get the shop item for winning xp
 */
function getBigGuildXPShopItem(): ShopItem {
	return {
		id: ShopItemType.BIG_GUILD_XP,
		price: GuildShopConstants.PRICES.BIG_XP,
		amounts: [1],
		buyCallback: async (response: CrowniclesPacket[], playerId: number): Promise<boolean> => await giveGuildXp(response, playerId, GuildShopConstants.PRICES.BIG_XP)
	};
}

/**
 * Get the shop item for buying a given amount of a given food
 * @param name
 * @param amounts
 */
function getFoodShopItem(name: string, amounts: number[]): ShopItem {
	const indexFood = getFoodIndexOf(name);
	return {
		id: shopItemTypeFromId(name),
		price: GuildShopConstants.PRICES.FOOD[indexFood],
		amounts,
		buyCallback: async (response: CrowniclesPacket[], playerId: number, _context: PacketContext, amount: number): Promise<boolean> => {
			const player = (await Players.getById(playerId))!;
			const guild = (await Guilds.getById(player.guildId))!;

			if (guild.isStorageFullFor(name, amount)) {
				response.push(makePacket(CommandGuildShopNoFoodStorageSpace, {}));
				return false;
			}

			await giveFoodToGuild(response, player, name, amount, NumberChangeReason.SHOP);

			if (name === PetConstants.PET_FOOD.ULTIMATE_FOOD) {
				await MissionsController.update(player, response, {
					missionId: "buyUltimateSoups",
					count: amount
				});
			}
			return true;
		}
	};
}


export default class GuildShopCommand {
	@commandRequires(CommandGuildShopPacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD_OR_JAILED,
		guildNeeded: true,
		whereAllowed: [WhereAllowed.CONTINENT]
	})
	static async execute(
		response: CrowniclesPacket[],
		player: Player,
		_packet: CommandGuildShopPacketReq,
		context: PacketContext
	): Promise<void> {
		const shopCategories: ShopCategory[] = [];

		const guild = (await Guilds.getById(player.guildId))!;
		const commonFoodRemainingSlots = GuildConstants.MAX_COMMON_PET_FOOD - guild.commonFood;
		const herbivorousFoodRemainingSlots = GuildConstants.MAX_HERBIVOROUS_PET_FOOD - guild.herbivorousFood;
		const carnivorousFoodRemainingSlots = GuildConstants.MAX_CARNIVOROUS_PET_FOOD - guild.carnivorousFood;
		const ultimateFoodRemainingSlots = GuildConstants.MAX_ULTIMATE_PET_FOOD - guild.ultimateFood;

		if (!guild.isAtMaxLevel()) {
			shopCategories.push({
				id: "guildXp",
				items: [getGuildXPShopItem(), getBigGuildXPShopItem()]
			});
		}

		const foodItems: ShopItem[] = [];

		if (commonFoodRemainingSlots > 0) {
			const amounts: number[] = [
				1,
				Math.min(5, commonFoodRemainingSlots),
				Math.min(10, commonFoodRemainingSlots),
				Math.min(25, commonFoodRemainingSlots)
			];
			foodItems.push(getFoodShopItem(PetConstants.PET_FOOD.COMMON_FOOD, [...new Set(amounts)])); // Remove duplicates
		}

		if (herbivorousFoodRemainingSlots > 0) {
			const amounts: number[] = [
				1,
				Math.min(5, herbivorousFoodRemainingSlots),
				Math.min(10, herbivorousFoodRemainingSlots),
				Math.min(15, herbivorousFoodRemainingSlots)
			];
			foodItems.push(getFoodShopItem(PetConstants.PET_FOOD.HERBIVOROUS_FOOD, [...new Set(amounts)])); // Remove duplicates
		}

		if (carnivorousFoodRemainingSlots > 0) {
			const amounts: number[] = [
				1,
				Math.min(5, carnivorousFoodRemainingSlots),
				Math.min(10, carnivorousFoodRemainingSlots),
				Math.min(15, carnivorousFoodRemainingSlots)
			];
			foodItems.push(getFoodShopItem(PetConstants.PET_FOOD.CARNIVOROUS_FOOD, [...new Set(amounts)])); // Remove duplicates
		}

		if (ultimateFoodRemainingSlots > 0) {
			const amounts: number[] = [
				1,
				Math.min(5, ultimateFoodRemainingSlots),
				Math.min(10, ultimateFoodRemainingSlots)
			];
			foodItems.push(getFoodShopItem(PetConstants.PET_FOOD.ULTIMATE_FOOD, [...new Set(amounts)])); // Remove duplicates
		}

		if (foodItems.length > 0) {
			shopCategories.push({
				id: "food",
				items: foodItems
			});
		}

		if (shopCategories.length === 0) {
			response.push(makePacket(CommandGuildShopEmpty, {}));
			return;
		}

		await ShopUtils.createAndSendShopCollector(context, response, {
			shopCategories,
			player,
			logger: (keycloakId, shopItemName, amount) => crowniclesInstance?.logsDatabase.logGuildShopBuyout(keycloakId, shopItemName, amount ?? 1)
		});
	}
}
