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
import {
	asMilliseconds, millisecondsToHours, msDiff, nowMs
} from "../../../../Lib/src/utils/TimeUtils";
import { DailyConstants } from "../../../../Lib/src/constants/DailyConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { TravelTime } from "../../core/maps/TravelTime";
import { BlessingManager } from "../../core/blessings/BlessingManager";
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
import {
	LockedRowNotFoundError, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";

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
	if (millisecondsToHours(msDiff(nowMs(), asMilliseconds(lastDailyTimestamp))) < DailyConstants.TIME_BETWEEN_DAILIES) {
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

	/*
	 * Lock the player and the inventory info together so the cooldown
	 * read/write and the player-side mutation (energy / health / money /
	 * time-travel) are atomic. Without this lock, two concurrent daily
	 * bonus claims on the same account could both pass the `dailyNotReady`
	 * check, double-apply the bonus, and only refresh `lastDailyAt` once —
	 * a duplication exploit (#3760).
	 */
	try {
		await withLockedEntities(
			[
				Player.lockKey(player.id),
				InventoryInfo.lockKey(player.id)
			] as const,
			async ([lockedPlayer, lockedInventoryInfo]) => {
				// Re-validate the cooldown under the lock — a concurrent claim may have just consumed it
				const lastDailyTimestamp = lockedInventoryInfo.getLastDailyAtTimestamp();
				if (millisecondsToHours(msDiff(nowMs(), asMilliseconds(lastDailyTimestamp))) < DailyConstants.TIME_BETWEEN_DAILIES) {
					response.push(makePacket(CommandDailyBonusInCooldown, {
						timeBetweenDailies: DailyConstants.TIME_BETWEEN_DAILIES,
						lastDailyTimestamp
					}));

					// Strip the success packet we pre-pushed since the claim was rejected
					const idx = response.indexOf(packet);
					if (idx !== -1) {
						response.splice(idx, 1);
					}
					return;
				}

				const playerActiveObjects = await InventorySlots.getPlayerActiveObjects(lockedPlayer.id);
				switch (packet.itemNature) {
					case ItemNature.ENERGY:
						lockedPlayer.addEnergy(activeObject.power, NumberChangeReason.DAILY, playerActiveObjects);
						break;
					case ItemNature.HEALTH:
						await lockedPlayer.addHealth({
							amount: activeObject.power,
							response,
							reason: NumberChangeReason.DAILY
						});
						break;
					case ItemNature.TIME_SPEEDUP:
						await TravelTime.timeTravel(lockedPlayer, activeObject.power, NumberChangeReason.DAILY);
						break;
					default:
						await lockedPlayer.addMoney({
							amount: activeObject.power,
							response,
							reason: NumberChangeReason.DAILY
						});
						packet.value = BlessingManager.getInstance().applyMoneyBlessing(activeObject.power);
						break;
				}
				lockedInventoryInfo.updateLastDailyAt();
				await Promise.all([
					lockedInventoryInfo.save(),
					lockedPlayer.save()
				]);

				// Sync the caller-supplied instances for response building
				inventoryInfo.lastDailyAt = lockedInventoryInfo.lastDailyAt;
			}
		);
	}
	catch (e) {
		if (e instanceof LockedRowNotFoundError) {
			CrowniclesLogger.warn(
				`activateDailyItem: locked row vanished for player ${player.id} — skipping daily bonus`
			);
			const idx = response.indexOf(packet);
			if (idx !== -1) {
				response.splice(idx, 1);
			}
			return;
		}
		throw e;
	}
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
			crowniclesInstance?.logsDatabase.logPlayerDaily(player.keycloakId, item)
				.then();
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.DAILY_BONUS);
			return;
		}

		const collector = new ReactionCollectorDailyBonus(usableObjects.map(i => toItemWithDetails(player, i.getItem()!, i.itemLevel, i.itemEnchantmentId)));

		const endCallback: EndCallback = async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): Promise<void> => {
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.DAILY_BONUS);

			const reaction = collector.getFirstReaction();
			if (!reaction || reaction.reaction.type === ReactionCollectorRefuseReaction.name) {
				response.push(makePacket(CommandDailyBonusCancelPacket, {}));
				return;
			}

			const objectDetails = (reaction.reaction.data as ReactionCollectorDailyBonusReaction).object;
			const usableObject = usableObjects.find(uo => uo.itemId === objectDetails.id && uo.itemCategory === objectDetails.itemCategory);
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
			crowniclesInstance?.logsDatabase.logPlayerDaily(player.keycloakId, objectItem)
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

