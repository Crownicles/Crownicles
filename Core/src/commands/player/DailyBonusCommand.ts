import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { Player } from "../../core/database/game/models/Player";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	CommandDailyBonusCancelPacket,
	CommandDailyBonusInCooldown,
	CommandDailyBonusNoAvailableObject,
	CommandDailyBonusPacketReq,
	CommandDailyBonusPacketRes
} from "../../../../Lib/src/packets/commands/CommandDailyBonusPacket";
import { InventorySlots } from "../../core/database/game/models/InventorySlot";
import { crowniclesInstance } from "../../index";
import { ObjectItem } from "../../data/ObjectItem";
import { ItemNature } from "../../../../Lib/src/constants/ItemConstants";
import {
	InventoryInfo, InventoryInfos
} from "../../core/database/game/models/InventoryInfo";
import { millisecondsToHours } from "../../../../Lib/src/utils/TimeUtils";
import { DailyConstants } from "../../../../Lib/src/constants/DailyConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { TravelTime } from "../../core/maps/TravelTime";
import { WhereAllowed } from "../../../../Lib/src/types/WhereAllowed";
import { toItemWithDetails } from "../../core/utils/ItemUtils";
import {
	EndCallback, ReactionCollectorInstance
} from "../../core/utils/ReactionsCollector";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import {
	ReactionCollectorDailyBonus,
	ReactionCollectorDailyBonusReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorDailyBonus";
import { ReactionCollectorRefuseReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { BlockingUtils } from "../../core/utils/BlockingUtils";

/**
 * Check if the active object is wrong for the daily bonus
 * @param activeObject
 */
function isWrongObjectForDaily(activeObject: ObjectItem): boolean {
	if (activeObject.nature === ItemNature.NONE) {
		return true;
	}

	return [
		ItemNature.SPEED,
		ItemNature.DEFENSE,
		ItemNature.ATTACK
	].includes(activeObject.nature);
}

/**
 * Check if the player is ready to get his daily bonus
 * @param inventoryInfo
 * @param response
 */
function dailyNotReady(inventoryInfo: InventoryInfo, response: CrowniclesPacket[]): boolean {
	const lastDailyTimestamp = inventoryInfo.getLastDailyAtTimestamp();
	if (millisecondsToHours(Date.now() - lastDailyTimestamp) < DailyConstants.TIME_BETWEEN_DAILIES) {
		response.push(makePacket(CommandDailyBonusInCooldown, {
			timeBetweenDailies: DailyConstants.TIME_BETWEEN_DAILIES,
			lastDailyTimestamp
		}));
		return true;
	}
	return false;
}

/**
 * Activate the daily item
 * @param player
 * @param activeObject
 * @param inventoryInfo
 * @param response
 */
async function activateDailyItem(player: Player, activeObject: ObjectItem, inventoryInfo: InventoryInfo, response: CrowniclesPacket[]): Promise<void> {
	const packet = makePacket(CommandDailyBonusPacketRes, {
		value: activeObject.power,
		itemNature: activeObject.nature
	});
	response.push(packet);
	switch (packet.itemNature) {
		case ItemNature.ENERGY:
			player.addEnergy(activeObject.power, NumberChangeReason.DAILY);
			break;
		case ItemNature.HEALTH:
			await player.addHealth(activeObject.power, response, NumberChangeReason.DAILY);
			break;
		case ItemNature.TIME_SPEEDUP:
			await TravelTime.timeTravel(player, activeObject.power, NumberChangeReason.DAILY);
			break;
		default:
			await player.addMoney({
				amount: activeObject.power,
				response,
				reason: NumberChangeReason.DAILY
			});
			break;
	}
	inventoryInfo.updateLastDailyAt();
	await Promise.all([
		inventoryInfo.save(),
		player.save()
	]);
}

export default class DailyBonusCommand {
	/**
	 * Handle the daily bonus command
	 * @param response
	 * @param player
	 * @param _packet
	 * @param context
	 */
	@commandRequires(CommandDailyBonusPacketReq, {
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		notBlocked: true,
		whereAllowed: [WhereAllowed.CONTINENT]
	})
	async execute(response: CrowniclesPacket[], player: Player, _packet: CrowniclesPacket, context: PacketContext): Promise<void> {
		// Block player immediately to prevent concurrent executions
		BlockingUtils.blockPlayer(player.keycloakId, BlockingConstants.REASONS.DAILY_BONUS);

		// Get inventory info once and pass it to functions that need it
		const inventoryInfo = await InventoryInfos.getOfPlayer(player.id);

		if (dailyNotReady(inventoryInfo, response)) {
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.DAILY_BONUS);
			return;
		}

		const usableObjects = (await InventorySlots.getOfPlayer(player.id)).filter(item => item.itemId !== 0 && item.isObject() && !isWrongObjectForDaily(item.getItem() as ObjectItem));

		if (usableObjects.length === 0) {
			response.push(makePacket(CommandDailyBonusNoAvailableObject, {}));
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.DAILY_BONUS);
			return;
		}

		const equippedUsableObject = usableObjects.find(uo => uo.isEquipped());
		if (equippedUsableObject) {
			const item = equippedUsableObject.getItem() as ObjectItem;
			await activateDailyItem(player, item, inventoryInfo, response);
			crowniclesInstance.logsDatabase.logPlayerDaily(player.keycloakId, item)
				.then();
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.DAILY_BONUS);
			return;
		}

		const collector = new ReactionCollectorDailyBonus(usableObjects.map(i => toItemWithDetails(i.getItem()!)));

		const endCallback: EndCallback = async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): Promise<void> => {
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.DAILY_BONUS);

			const reaction = collector.getFirstReaction();
			if (!reaction || reaction.reaction.type === ReactionCollectorRefuseReaction.name) {
				response.push(makePacket(CommandDailyBonusCancelPacket, {}));
				return;
			}

			const objectDetails = (reaction.reaction.data as ReactionCollectorDailyBonusReaction).object;
			const usableObject = usableObjects.find(uo => uo.itemId === objectDetails.id && uo.itemCategory === objectDetails.category);
			if (!usableObject) {
				return;
			}
			const objectItem = usableObject.getItem() as ObjectItem;

			// Reload inventoryInfo as it may have changed during reaction collection
			const freshInventoryInfo = await InventoryInfos.getOfPlayer(player.id);
			await activateDailyItem(
				await player.reload(),
				objectItem,
				freshInventoryInfo,
				response
			);
			crowniclesInstance.logsDatabase.logPlayerDaily(player.keycloakId, objectItem)
				.then();
		};

		const collectorPacket = new ReactionCollectorInstance(
			collector,
			context,
			{
				allowedPlayerKeycloakIds: [player.keycloakId],
				reactionLimit: 1
			},
			endCallback
		)
			.build();

		response.push(collectorPacket);
	}
}

