import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	Player, Players
} from "../../core/database/game/models/Player";
import {
	CommandUnlockAcceptPacketRes,
	CommandUnlockHimself,
	CommandUnlockNoPlayerFound,
	CommandUnlockNotEnoughMoney,
	CommandUnlockNotInJail,
	CommandUnlockPacketReq,
	CommandUnlockRefusePacketRes
} from "../../../../Lib/src/packets/commands/CommandUnlockPacket";
import {
	EndCallback, ReactionCollectorInstance
} from "../../core/utils/ReactionsCollector";
import { ReactionCollectorAcceptReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { ReactionCollectorUnlock } from "../../../../Lib/src/packets/interaction/ReactionCollectorUnlock";
import { crowniclesInstance } from "../../app";
import { UnlockConstants } from "../../../../Lib/src/constants/UnlockConstants";
import { TravelTime } from "../../core/maps/TravelTime";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { Effect } from "../../../../Lib/src/types/Effect";
import { WhereAllowed } from "../../../../Lib/src/types/WhereAllowed";
import { MissionsController } from "../../core/missions/MissionsController";
import { PlayerFreedFromJailNotificationPacket } from "../../../../Lib/src/packets/notifications/PlayerFreedFromJailNotificationPacket";
import { PacketUtils } from "../../core/utils/PacketUtils";
import {
	LockedRowNotFoundError, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";

/**
 * Accept the unlocking of a player
 * @param player
 * @param freedPlayer
 * @param response
 */
async function acceptUnlock(player: Player, freedPlayer: Player, response: CrowniclesPacket[]): Promise<void> {
	/*
	 * Lock both players atomically. Without this lock two concurrent
	 * unlock attempts on the same jailed player could both pass the
	 * `unlockCannotBeDone` check, double-charge the freeing players,
	 * and the second `removeEffect` would silently no-op on stale
	 * in-memory state (#3760).
	 */
	let unlocked = false;
	try {
		await withLockedEntities(
			[
				Player.lockKey(player.id),
				Player.lockKey(freedPlayer.id)
			] as const,
			async ([lockedPlayer, lockedFreedPlayer]) => {
				// Re-validate using the freshly-locked rows
				if (unlockCannotBeDone(lockedPlayer, lockedFreedPlayer, response)) {
					return;
				}

				await TravelTime.removeEffect(lockedFreedPlayer, NumberChangeReason.UNLOCK);
				await lockedPlayer.spendMoney({
					amount: UnlockConstants.PRICE_FOR_UNLOCK,
					response,
					reason: NumberChangeReason.UNLOCK
				});

				await Promise.all([
					lockedPlayer.save(),
					lockedFreedPlayer.save()
				]);
				unlocked = true;
			}
		);
	}
	catch (e) {
		if (e instanceof LockedRowNotFoundError) {
			CrowniclesLogger.warn(
				`acceptUnlock: locked row vanished for player ${player.id} or freed ${freedPlayer.id} — aborting unlock`
			);
			return;
		}
		throw e;
	}

	if (!unlocked) {
		return;
	}

	crowniclesInstance?.logsDatabase.logUnlock(player.keycloakId, freedPlayer.keycloakId).then();

	response.push(makePacket(CommandUnlockAcceptPacketRes, {
		unlockedKeycloakId: freedPlayer.keycloakId
	}));

	PacketUtils.sendNotifications([
		makePacket(PlayerFreedFromJailNotificationPacket, {
			keycloakId: freedPlayer.keycloakId,
			freedByPlayerKeycloakId: player.keycloakId
		})
	]);

	await MissionsController.update(player, response, { missionId: "unlock" });
}

/**
 * Check if the player can unlock another player
 * @param player The player who wants to kick a member
 * @param freedPlayer The player who will be freed from the prison
 * @param response The response to send
 */
function unlockCannotBeDone(player: Player, freedPlayer: Player | null, response: CrowniclesPacket[]): boolean {
	if (freedPlayer === null || !freedPlayer.hasStartedToPlay()) {
		response.push(makePacket(CommandUnlockNoPlayerFound, {}));
		return true;
	}
	if (player.money < UnlockConstants.PRICE_FOR_UNLOCK) {
		response.push(makePacket(CommandUnlockNotEnoughMoney, {
			money: player.money
		}));
		return true;
	}
	if (player.id === freedPlayer.id) {
		response.push(makePacket(CommandUnlockHimself, {}));
		return true;
	}
	if (freedPlayer.effectId !== Effect.JAILED.id) {
		response.push(makePacket(CommandUnlockNotInJail, {}));
		return true;
	}
	return false;
}

export default class UnlockCommand {
	@commandRequires(CommandUnlockPacketReq, {
		notBlocked: true,
		allowedEffects: CommandUtils.ALLOWED_EFFECTS.NO_EFFECT,
		whereAllowed: [WhereAllowed.CONTINENT]
	})
	async execute(response: CrowniclesPacket[], player: Player, packet: CommandUnlockPacketReq, context: PacketContext): Promise<void> {
		const freedPlayer = await Players.getAskedPlayer(packet.askedPlayer, player);

		if (unlockCannotBeDone(player, freedPlayer, response) || !freedPlayer) {
			return;
		}

		// Send collector
		const collector = new ReactionCollectorUnlock(
			freedPlayer.keycloakId
		);

		const endCallback: EndCallback = async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): Promise<void> => {
			const reaction = collector.getFirstReaction();
			if (reaction && reaction.reaction.type === ReactionCollectorAcceptReaction.name) {
				await acceptUnlock(player, freedPlayer!, response);
			}
			else {
				response.push(makePacket(CommandUnlockRefusePacketRes, {}));
			}
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.UNLOCK);
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
			.block(player.keycloakId, BlockingConstants.REASONS.UNLOCK)
			.build();

		response.push(collectorPacket);
	}
}
