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
import { InventoryInfos } from "../../core/database/game/models/InventoryInfo";
import { millisecondsToHours } from "../../../../Lib/src/utils/TimeUtils";
import { DailyConstants } from "../../../../Lib/src/constants/DailyConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { TravelTime } from "../../core/maps/TravelTime";
import { WhereAllowed } from "../../../../Lib/src/types/WhereAllowed";
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
 * @param player
 * @param response
 */
async function dailyNotReady(player: Player, response: CrowniclesPacket[]): Promise<boolean> {
	const inventoryInfo = await InventoryInfos.getOfPlayer(player.id);
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
 * @param response
 */
async function activateDailyItem(player: Player, activeObject: ObjectItem, response: CrowniclesPacket[]): Promise<void> {
	const packet = makePacket(CommandDailyBonusPacketRes, {
		value: activeObject.power,
		itemNature: activeObject.nature
	});
	response.push(packet);
	switch (packet.itemNature) {
		case ItemNature.ENERGY:
			player.addEnergy(activeObject.power, NumberChangeReason.DAILY, await InventorySlots.getPlayerActiveObjects(player.id));
			break;
		case ItemNature.HEALTH:
			await player.addHealth(activeObject.power, response, NumberChangeReason.DAILY, await InventorySlots.getPlayerActiveObjects(player.id));
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
	const inventoryInfo = await InventoryInfos.getOfPlayer(player.id);
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
		if (await dailyNotReady(player, response)) {
			return;
		}

		const usableObjects = (await InventorySlots.getOfPlayer(player.id)).filter(item => item.itemId !== 0 && item.isObject() && !isWrongObjectForDaily(item.getItem() as ObjectItem));

		if (usableObjects.length === 0) {
			response.push(makePacket(CommandDailyBonusNoAvailableObject, {}));
			return;
		}

		const equippedUsableObject = usableObjects.find(uo => uo.isEquipped());
		if (equippedUsableObject) {
			const item = equippedUsableObject.getItem() as ObjectItem;
			await activateDailyItem(player, item, response);
			crowniclesInstance.logsDatabase.logPlayerDaily(player.keycloakId, item)
				.then();
			return;
		}

		const collector = new ReactionCollectorDailyBonus(usableObjects.map(i => i.itemWithDetails(player)));

		const endCallback: EndCallback = async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): Promise<void> => {
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.DAILY_BONUS);

			const reaction = collector.getFirstReaction();
			if (!reaction || reaction.reaction.type === ReactionCollectorRefuseReaction.name) {
				response.push(makePacket(CommandDailyBonusCancelPacket, {}));
				return;
			}

			const objectDetails = (reaction.reaction.data as ReactionCollectorDailyBonusReaction).object;
			const objectItem = usableObjects.find(uo => uo.itemId === objectDetails.id && uo.itemCategory === objectDetails.itemCategory).getItem() as ObjectItem;
			await activateDailyItem(
				await player.reload(),
				objectItem,
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
			.block(player.keycloakId, BlockingConstants.REASONS.DAILY_BONUS)
			.build();

		response.push(collectorPacket);
	}
}

