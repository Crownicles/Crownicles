import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { Player } from "../../core/database/game/models/Player";
import PlayerMissionsInfo, { PlayerMissionsInfos } from "../../core/database/game/models/PlayerMissionsInfo";
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
import {
	InventorySlot, InventorySlots
} from "../../core/database/game/models/InventorySlot";
import { crowniclesInstance } from "../../app";
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
import { withLockedEntitiesSafe } from "../../core/utils/withLockedEntitiesSafe";

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
 * Check if the daily bonus is still on cooldown given the last claim timestamp.
 * Centralised so the pre-lock fast path and the in-lock re-validation cannot
 * drift apart (#3760).
 */
function isDailyOnCooldown(lastDailyTimestamp: number): boolean {
	return millisecondsToHours(msDiff(nowMs(), asMilliseconds(lastDailyTimestamp))) < DailyConstants.TIME_BETWEEN_DAILIES;
}

/**
 * Check if the player is ready to get his daily bonus
 * @param inventoryInfo
 * @param response
 */
function dailyNotReady(inventoryInfo: InventoryInfo, response: CrowniclesPacket[]): boolean {
	const lastDailyTimestamp = inventoryInfo.getLastDailyAtTimestamp();
	if (isDailyOnCooldown(lastDailyTimestamp)) {
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
// Exported for race tests; the inner `withLockedEntitiesSafe` block is the unit under test.
export async function activateDailyItem(player: Player, activeObject: ObjectItem, inventoryInfo: InventoryInfo, response: CrowniclesPacket[]): Promise<void> {
	const packet = makePacket(CommandDailyBonusPacketRes, {
		value: activeObject.power,
		itemNature: activeObject.nature
	});

	/*
	 * Lock the player and the inventory info together so the cooldown
	 * read/write and the player-side mutation (energy / health / money /
	 * time-travel) are atomic. Without this lock, two concurrent daily
	 * bonus claims on the same account could both pass the `dailyNotReady`
	 * check, double-apply the bonus, and only refresh `lastDailyAt` once —
	 * a duplication exploit (#3760).
	 */
	let claimSucceeded = false;
	await PlayerMissionsInfos.getOfPlayer(player.id);
	await withLockedEntitiesSafe(
		[
			Player.lockKey(player.id),
			InventoryInfo.lockKey(player.id),
			PlayerMissionsInfo.lockKey(player.id)
		] as const,
		`activateDailyItem(player=${player.id})`,
		async ([lockedPlayer, lockedInventoryInfo]) => {
			// Re-validate the cooldown under the lock — a concurrent claim may have just consumed it
			const lastDailyTimestamp = lockedInventoryInfo.getLastDailyAtTimestamp();
			if (isDailyOnCooldown(lastDailyTimestamp)) {
				response.push(makePacket(CommandDailyBonusInCooldown, {
					timeBetweenDailies: DailyConstants.TIME_BETWEEN_DAILIES,
					lastDailyTimestamp
				}));
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
			claimSucceeded = true;
		}
	);

	// Push the success packet only after the bonus was durably applied (#3760).
	if (claimSucceeded) {
		response.push(packet);
	}
}

/**
 * Build the end callback that resolves the object picked by the player and applies the daily bonus.
 */
function buildDailyBonusEndCallback(player: Player, usableObjects: InventorySlot[]): EndCallback {
	return async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): Promise<void> => {
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

		const endCallback = buildDailyBonusEndCallback(player, usableObjects);

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

