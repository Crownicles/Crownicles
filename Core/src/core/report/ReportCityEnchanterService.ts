import InventorySlot from "../database/game/models/InventorySlot";
import { Player } from "../database/game/models/Player";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	ReactionCollectorCityData,
	ReactionCollectorEnchanterDisenchantReaction,
	ReactionCollectorEnchantReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import {
	CommandReportEnchanterDisenchantRes,
	CommandReportEnchantNotEnoughCurrenciesRes,
	CommandReportEquipmentChangedRes,
	CommandReportItemCannotBeEnchantedRes,
	CommandReportItemEnchantedRes
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import {
	EnchantmentCost, ItemEnchantment
} from "../../../../Lib/src/types/ItemEnchantment";
import PlayerMissionsInfo, { PlayerMissionsInfos } from "../database/game/models/PlayerMissionsInfo";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import {
	Locked, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";
import { crowniclesInstance } from "../../app";
import { MissionsController } from "../missions/MissionsController";
import { DailyMissions } from "../database/game/models/DailyMission";
import { DisenchantableItem } from "../../../../Lib/src/types/DisenchantableItem";
import {
	getListedInventorySlotUnderLock, removeListedEnchantmentUnderLock
} from "./ReportListedEquipment";

type EnchanterData = NonNullable<ReactionCollectorCityData["enchanter"]>;

type EnchantableItem = EnchanterData["enchantableItems"][number];

/**
 * The enchantment and its price, as displayed by the enchanter menu
 */
type EnchanterOffer = {
	enchantment: ItemEnchantment;
	price: EnchantmentCost;
};

/**
 * Locked rows and request data shared by the steps of a paid enchantment
 */
type LockedEnchantContext = EnchanterOffer & {
	lockedPlayer: Locked<Player>;
	lockedMissionsInfo: Locked<PlayerMissionsInfo>;
	response: CrowniclesPacket[];
};

/**
 * The offer the menu displayed. It is honoured even if the enchantment of the day rotated while the menu was open:
 * the player gets exactly what was shown at the price that was shown, which they could have had a moment earlier.
 */
function getDisplayedOffer(enchanter: EnchanterData): EnchanterOffer | null {
	const enchantment = ItemEnchantment.getById(enchanter.enchantmentId);
	if (!enchantment) {
		CrowniclesLogger.error(`The enchanter menu displayed the unknown enchantment ${enchanter.enchantmentId}.`);
		return null;
	}
	return {
		enchantment,
		price: enchanter.enchantmentCost
	};
}

function findListedEnchantableItem(
	reaction: ReactionCollectorEnchantReaction,
	enchanter: EnchanterData | undefined
): EnchantableItem | undefined {
	return enchanter?.enchantableItems.find(listed => listed.slot === reaction.slot && listed.category === reaction.itemCategory);
}

/**
 * The listed equipment, read from the locked inventory, provided it can still receive the enchantment of the day.
 * Pushes the matching response and returns null otherwise.
 */
async function getEnchantableSlotUnderLock(
	context: LockedEnchantContext,
	reaction: ReactionCollectorEnchantReaction,
	listedItem: EnchantableItem
): Promise<InventorySlot | null> {
	const inventorySlot = await getListedInventorySlotUnderLock(context.lockedPlayer, reaction, listedItem.details, context.response);
	if (!inventorySlot) {
		return null;
	}

	if (!inventorySlot.canReceiveEnchantment(context.enchantment)) {
		CrowniclesLogger.error(`Player ${context.lockedPlayer.keycloakId} tried to enchant an item that cannot receive the enchantment of the day.`);
		context.response.push(makePacket(CommandReportItemCannotBeEnchantedRes, {}));
		return null;
	}

	return inventorySlot;
}

/**
 * Whether the locked rows cover the price. Pushes the missing-currencies response otherwise.
 */
function hasEnoughCurrenciesUnderLock(context: LockedEnchantContext): boolean {
	const {
		lockedPlayer, lockedMissionsInfo, price, response
	} = context;
	if (lockedPlayer.money >= price.money && lockedMissionsInfo.gems >= price.gems) {
		return true;
	}
	response.push(makePacket(CommandReportEnchantNotEnoughCurrenciesRes, {
		missingMoney: Math.max(price.money - lockedPlayer.money, 0),
		missingGems: Math.max(price.gems - lockedMissionsInfo.gems, 0)
	}));
	return false;
}

/**
 * Spend the currencies, enchant the locked slot, persist every row and push the success packet
 */
async function executeEnchantUnderLock(
	context: LockedEnchantContext,
	itemToEnchant: InventorySlot
): Promise<void> {
	const {
		lockedPlayer, lockedMissionsInfo, enchantment, price, response
	} = context;

	itemToEnchant.itemEnchantmentId = enchantment.id;
	if (price.money > 0) {
		await lockedPlayer.spendMoney({
			response,
			amount: price.money,
			reason: NumberChangeReason.ENCHANT_ITEM
		});
	}
	if (price.gems > 0) {
		await lockedMissionsInfo.spendGems(price.gems, response, NumberChangeReason.ENCHANT_ITEM);
	}

	await Promise.all([
		itemToEnchant.save(),
		lockedPlayer.save(),
		lockedMissionsInfo.save()
	]);

	response.push(makePacket(CommandReportItemEnchantedRes, {
		enchantmentId: enchantment.id,
		enchantmentType: enchantment.kind.type.id
	}));

	await MissionsController.update(lockedPlayer, response, { missionId: "enchantItem" });

	const cityId = lockedPlayer.getCurrentCityId();
	if (cityId) {
		crowniclesInstance?.logsDatabase.logEnchanterUse({
			keycloakId: lockedPlayer.keycloakId,
			cityId,
			itemCategory: itemToEnchant.itemCategory,
			slot: itemToEnchant.slot,
			enchantmentId: enchantment.id,
			enchantmentType: enchantment.kind.type.id,
			moneyPrice: price.money,
			gemsPrice: price.gems
		}).then();
	}
}

/**
 * Locked body of the paid enchantment: the listed equipment is checked against the locked inventory
 * before anything is spent, so a chest action finishing in the meantime cannot get its item enchanted.
 */
async function enchantListedItemUnderLock(
	context: LockedEnchantContext,
	reaction: ReactionCollectorEnchantReaction,
	listedItem: EnchantableItem
): Promise<void> {
	const itemToEnchant = await getEnchantableSlotUnderLock(context, reaction, listedItem);
	if (!itemToEnchant) {
		return;
	}

	if (!hasEnoughCurrenciesUnderLock(context)) {
		return;
	}

	await executeEnchantUnderLock(context, itemToEnchant);
}

/**
 * Handle enchant reaction — player enchants an item at the enchanter
 *
 * Concurrency: locks the Player (wallet and inventory) and the PlayerMissionsInfo (gems) rows,
 * and every check runs against those locked rows.
 */
export async function handleEnchantReaction(
	player: Player,
	reaction: ReactionCollectorEnchantReaction,
	data: ReactionCollectorCityData,
	response: CrowniclesPacket[]
): Promise<void> {
	const listedItem = findListedEnchantableItem(reaction, data.enchanter);
	if (!data.enchanter || !listedItem) {
		response.push(makePacket(CommandReportEquipmentChangedRes, {}));
		return;
	}

	const offer = getDisplayedOffer(data.enchanter);
	if (!offer) {
		return;
	}

	// Resolve the daily mission rollover and create the missions info row before locking it
	await DailyMissions.getOrGenerate();
	await PlayerMissionsInfos.getOfPlayer(player.id);
	await withLockedEntities([Player.lockKey(player.id), PlayerMissionsInfo.lockKey(player.id)] as const, async ([lockedPlayer, lockedMissionsInfo]) => {
		await enchantListedItemUnderLock({
			lockedPlayer,
			lockedMissionsInfo,
			...offer,
			response
		}, reaction, listedItem);
	});
}

function getListedDisenchantableItem(
	player: Player,
	reaction: ReactionCollectorEnchanterDisenchantReaction,
	data: ReactionCollectorCityData
): DisenchantableItem | null {
	const listedItem = data.enchanter?.disenchantableItems.find(item => item.slot === reaction.slot && item.category === reaction.itemCategory);
	if (!listedItem) {
		CrowniclesLogger.error(`Player ${player.keycloakId} tried to disenchant an item that the enchanter did not list.`);
		return null;
	}
	return listedItem;
}

/**
 * Handle enchanter disenchant reaction — the enchanter removes an enchantment for free
 */
export async function handleEnchanterDisenchantReaction(
	player: Player,
	reaction: ReactionCollectorEnchanterDisenchantReaction,
	data: ReactionCollectorCityData,
	response: CrowniclesPacket[]
): Promise<void> {
	const listedItem = getListedDisenchantableItem(player, reaction, data);
	if (!listedItem) {
		return;
	}

	await withLockedEntities([Player.lockKey(player.id)] as const, async ([lockedPlayer]) => {
		if (!await removeListedEnchantmentUnderLock(lockedPlayer, reaction, listedItem.details, response)) {
			return;
		}

		response.push(makePacket(CommandReportEnchanterDisenchantRes, {
			enchantmentId: listedItem.enchantmentId,
			enchantmentType: listedItem.enchantmentType
		}));

		const cityId = lockedPlayer.getCurrentCityId();
		if (cityId) {
			crowniclesInstance?.logsDatabase.logEnchanterDisenchant({
				keycloakId: lockedPlayer.keycloakId,
				cityId,
				itemCategory: reaction.itemCategory,
				slot: reaction.slot,
				enchantmentId: listedItem.enchantmentId
			}).then();
		}
	});
}
