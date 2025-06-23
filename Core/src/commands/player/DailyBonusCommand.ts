import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { Player } from "../../core/database/game/models/Player";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	CommandDailyBonusInCooldown,
	CommandDailyBonusNoActiveObject,
	CommandDailyBonusObjectDoNothing,
	CommandDailyBonusObjectIsActiveDuringFights,
	CommandDailyBonusPacketReq,
	CommandDailyBonusPacketRes
} from "../../../../Lib/src/packets/commands/CommandDailyBonusPacket";
import { InventorySlots } from "../../core/database/game/models/InventorySlot";
import { crowniclesInstance } from "../../index";
import { ObjectItem } from "../../data/ObjectItem";
import { ItemNature } from "../../../../Lib/src/constants/ItemConstants";
import { InventoryConstants } from "../../../../Lib/src/constants/InventoryConstants";
import { InventoryInfos } from "../../core/database/game/models/InventoryInfo";
import { millisecondsToHours } from "../../../../Lib/src/utils/TimeUtils";
import { DailyConstants } from "../../../../Lib/src/constants/DailyConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { TravelTime } from "../../core/maps/TravelTime";
import { WhereAllowed } from "../../../../Lib/src/types/WhereAllowed";

/**
 * Check if the active object is wrong for the daily bonus
 * @param activeObject
 * @param response
 */
function isWrongObjectForDaily(activeObject: ObjectItem, response: CrowniclesPacket[]): boolean {
	if (activeObject.nature === ItemNature.NONE) {
		response.push(makePacket(activeObject.id === InventoryConstants.OBJECT_DEFAULT_ID ? CommandDailyBonusNoActiveObject : CommandDailyBonusObjectDoNothing, {}));
		return true;
	}
	if ([
		ItemNature.SPEED,
		ItemNature.DEFENSE,
		ItemNature.ATTACK
	].includes(activeObject.nature)) {
		response.push(makePacket(CommandDailyBonusObjectIsActiveDuringFights, {}));
		return true;
	}
	return false;
}

/**
 * Check if the player is ready to get his daily bonus
 * @param player
 * @param response
 */
async function dailyNotReady(player: Player, response: CrowniclesPacket[]): Promise<boolean> {
	const inventoryInfo = await InventoryInfos.getOfPlayer(player.id);
	const lastDailyTimestamp = inventoryInfo.getLastDailyAtTimestamp();
	if (millisecondsToHours(Date.now() - inventoryInfo.getLastDailyAtTimestamp()) < DailyConstants.TIME_BETWEEN_DAILIES) {
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
	 */
	@commandRequires(CommandDailyBonusPacketReq, {
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		notBlocked: true,
		whereAllowed: [WhereAllowed.CONTINENT]
	})
	async execute(response: CrowniclesPacket[], player: Player): Promise<void> {
		const activeObjectSlot = await InventorySlots.getMainObjectSlot(player.id);
		if (!activeObjectSlot) {
			response.push(makePacket(CommandDailyBonusNoActiveObject, {}));
			return;
		}

		const activeObject: ObjectItem = activeObjectSlot.getItem() as ObjectItem;

		if (isWrongObjectForDaily(activeObject, response) || await dailyNotReady(player, response)) {
			return;
		}

		await activateDailyItem(player, activeObject, response);
		crowniclesInstance.logsDatabase.logPlayerDaily(player.keycloakId, activeObject)
			.then();
	}
}

