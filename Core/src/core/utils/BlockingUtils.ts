import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { BlockedPacket } from "../../../../Lib/src/packets/commands/BlockedPacket";
import {
	BlockingConstants, BlockingReason
} from "../../../../Lib/src/constants/BlockingConstants";
import { ChangeBlockingReasonPacket } from "../../../../Lib/src/packets/utils/ChangeBlockingReasonPacket";

type BlockingInfo = {
	reason: BlockingReason;
	limitTimestamp: number;
	startTimestamp: number;
};

/**
 * Functions to call when you want to manage the blocking of a player
 */
export class BlockingUtils {
	private static blockedPlayers: Map<string, BlockingInfo[]> = new Map();

	/**
	 * Block a player with a given reason and time
	 * @param keycloakId
	 * @param reason
	 * @param maxTime
	 */
	static blockPlayer(keycloakId: string, reason: BlockingReason, maxTime = 0): void {
		if (!BlockingUtils.blockedPlayers.get(keycloakId)) {
			BlockingUtils.blockedPlayers.set(keycloakId, []);
		}
		BlockingUtils.blockedPlayers.get(keycloakId)!.push({
			reason,
			limitTimestamp: maxTime !== 0 ? Date.now() + maxTime : 0,
			startTimestamp: Date.now()
		});
	}

	/**
	 * Block a player with a given reason and at an end time
	 * @param keycloakId
	 * @param reason
	 * @param endTimestamp
	 */
	static blockPlayerUntil(keycloakId: string, reason: BlockingReason, endTimestamp: number): void {
		if (!BlockingUtils.blockedPlayers.get(keycloakId)) {
			BlockingUtils.blockedPlayers.set(keycloakId, []);
		}
		BlockingUtils.blockedPlayers.get(keycloakId)!.push({
			reason,
			limitTimestamp: endTimestamp,
			startTimestamp: Date.now()
		});
	}

	/**
	 * Unblock a player for a given reason
	 * @param keycloakId
	 * @param reason
	 */
	static unblockPlayer(keycloakId: string, reason: BlockingReason): void {
		const blockedPlayer = BlockingUtils.blockedPlayers.get(keycloakId);
		if (blockedPlayer) {
			const filtered = blockedPlayer.filter(v => v.reason !== reason);
			BlockingUtils.blockedPlayers.set(keycloakId, filtered);
			if (filtered.length === 0) {
				BlockingUtils.blockedPlayers.delete(keycloakId);
			}
		}
	}

	/**
	 * Gets why this player is blocked (empty list means it isn't blocked)
	 * @param keycloakId
	 */
	static getPlayerBlockingReason(keycloakId: string): BlockingReason[] {
		const blockedPlayer = BlockingUtils.blockedPlayers.get(keycloakId);
		const response: BlockingReason[] = [];
		if (blockedPlayer) {
			for (const block of blockedPlayer) {
				if (block.limitTimestamp !== 0 && block.limitTimestamp < Date.now()) {
					BlockingUtils.unblockPlayer(keycloakId, block.reason);
				}
				else {
					response.push(block.reason);
				}
			}
		}
		return response;
	}

	/**
	 * Append BlockedPackets if the player is blocked, and return true
	 * @param keycloakId
	 * @param packets
	 */
	static appendBlockedPacket(keycloakId: string, packets: CrowniclesPacket[]): boolean {
		const blockingReason = BlockingUtils.getPlayerBlockingReason(keycloakId);
		if (blockingReason.length !== 0) {
			packets.push(makePacket(BlockedPacket, {
				keycloakId, reasons: blockingReason
			}));
			return true;
		}

		return false;
	}

	static changeBlockingReason(keycloakId: string, packet: ChangeBlockingReasonPacket): void {
		if (this.getPlayerBlockingReason(keycloakId).includes(packet.oldReason)) {
			if (packet.newReason !== BlockingConstants.REASONS.NONE) {
				this.blockPlayer(keycloakId, packet.newReason);
			}
			this.unblockPlayer(keycloakId, packet.oldReason);
		}
	}

	static isPlayerBlockedWithReason(keycloakId: string, reason: BlockingReason): boolean {
		return BlockingUtils.getPlayerBlockingReason(keycloakId).includes(reason);
	}

	static isPlayerBlocked(keycloakId: string): boolean {
		return BlockingUtils.getPlayerBlockingReason(keycloakId).length !== 0;
	}

	static getBlockedPlayersCount(): number {
		let count = 0;
		for (const blockedPlayer of BlockingUtils.blockedPlayers.values()) {
			for (const block of blockedPlayer) {
				if (block.limitTimestamp === 0 || block.limitTimestamp > Date.now()) {
					count++;
				}
			}
		}
		return count;
	}

	static getBlockedPlayers(): Map<string, BlockingInfo[]> {
		const blockedPlayers = new Map<string, BlockingInfo[]>();
		for (const [keycloakId, blockingInfos] of BlockingUtils.blockedPlayers.entries()) {
			blockedPlayers.set(keycloakId, blockingInfos.filter(blockingInfo => blockingInfo.limitTimestamp === 0 || blockingInfo.limitTimestamp > Date.now()));
		}
		return blockedPlayers;
	}
}
