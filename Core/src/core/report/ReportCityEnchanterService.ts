import InventorySlot, { InventorySlots } from "../database/game/models/InventorySlot";
import { Player } from "../database/game/models/Player";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	ReactionCollectorEnchantReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import {
	CommandReportEnchantNotEnoughCurrenciesRes,
	CommandReportItemCannotBeEnchantedRes,
	CommandReportItemEnchantedRes
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { ItemEnchantment } from "../../../../Lib/src/types/ItemEnchantment";
import { ClassConstants } from "../../../../Lib/src/constants/ClassConstants";
import { Settings } from "../database/game/models/Setting";
import PlayerMissionsInfo, { PlayerMissionsInfos } from "../database/game/models/PlayerMissionsInfo";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";

/**
 * Parameters for the enchantItem function
 */
interface EnchantItemParams {
	player: Player;
	enchantment: ItemEnchantment;
	price: {
		money: number; gems: number;
	};
	playerMissionsInfo: PlayerMissionsInfo | null;
	itemToEnchant: InventorySlot;
	response: CrowniclesPacket[];
}

/**
 * Check if the enchantment conditions are met (enough currencies, valid item)
 */
async function checkEnchantmentConditions(
	player: Player,
	reaction: ReactionCollectorEnchantReaction,
	response: CrowniclesPacket[]
): Promise<{
	enchantment: ItemEnchantment;
	price: {
		money: number; gems: number;
	};
	playerMissionsInfo: PlayerMissionsInfo | null;
	itemToEnchant: InventorySlot;
} | null> {
	const enchantment = ItemEnchantment.getById(await Settings.ENCHANTER_ENCHANTMENT_ID.getValue());
	if (!enchantment) {
		CrowniclesLogger.error("No enchantment found for enchanter. Check ENCHANTER_ENCHANTMENT_ID setting.");
		return null;
	}
	const isPlayerMage = player.class === ClassConstants.CLASSES_ID.MYSTIC_MAGE;
	const price = enchantment.getEnchantmentCost(isPlayerMage);

	const hasEnoughMoney = player.money >= price.money;
	const playerMissionsInfo = price.gems !== 0 ? await PlayerMissionsInfos.getOfPlayer(player.id) : null;
	const hasEnoughGems = playerMissionsInfo ? playerMissionsInfo.gems >= price.gems : true;

	if (!hasEnoughMoney || !hasEnoughGems) {
		response.push(makePacket(CommandReportEnchantNotEnoughCurrenciesRes, {
			missingMoney: hasEnoughMoney ? 0 : price.money - player.money,
			missingGems: hasEnoughGems ? 0 : price.gems - (playerMissionsInfo?.gems ?? 0)
		}));
		return null;
	}

	const itemToEnchant = await InventorySlots.getItem(player.id, reaction.slot, reaction.itemCategory);
	if (!itemToEnchant || !itemToEnchant.isWeaponOrArmor() || itemToEnchant.itemEnchantmentId) {
		CrowniclesLogger.error("Player tried to enchant an item that doesn't exist or cannot be enchanted. It shouldn't happen because the player must not be able to switch items while in the collector.");
		response.push(makePacket(CommandReportItemCannotBeEnchantedRes, {}));
		return null;
	}

	return {
		enchantment, price, playerMissionsInfo, itemToEnchant
	};
}

/**
 * Apply the enchantment to the item and spend currencies
 */
async function enchantItem(params: EnchantItemParams): Promise<void> {
	const {
		player, enchantment, price, playerMissionsInfo, itemToEnchant, response
	} = params;
	await player.reload();

	itemToEnchant.itemEnchantmentId = enchantment.id;
	if (price.money > 0) {
		await player.spendMoney({
			response,
			amount: price.money,
			reason: NumberChangeReason.ENCHANT_ITEM
		});
	}
	if (price.gems > 0 && playerMissionsInfo) {
		await playerMissionsInfo.spendGems(price.gems, response, NumberChangeReason.ENCHANT_ITEM);
	}

	await Promise.all([
		itemToEnchant.save(),
		player.save(),
		playerMissionsInfo ? playerMissionsInfo.save() : Promise.resolve()
	]);

	response.push(makePacket(CommandReportItemEnchantedRes, {
		enchantmentId: enchantment.id,
		enchantmentType: enchantment.kind.type.id
	}));
}

/**
 * Handle enchant reaction — player enchants an item at the enchanter
 */
export async function handleEnchantReaction(player: Player, reaction: ReactionCollectorEnchantReaction, response: CrowniclesPacket[]): Promise<void> {
	const conditions = await checkEnchantmentConditions(player, reaction, response);
	if (!conditions) {
		return;
	}

	await enchantItem({
		player,
		enchantment: conditions.enchantment,
		price: conditions.price,
		playerMissionsInfo: conditions.playerMissionsInfo,
		itemToEnchant: conditions.itemToEnchant,
		response
	});
}
