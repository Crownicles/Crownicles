import {
	CrowniclesPacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	APP_STATE_FLAGS, AppStateFlag, PendingReveal
} from "../../../../Lib/src/types/AppState";
import { MissionsCompletedPacket } from "../../../../Lib/src/packets/events/MissionsCompletedPacket";
import { RoyalLetterPacket } from "../../../../Lib/src/packets/events/RoyalLetterPacket";
import { Players } from "../database/game/models/Player";
import {
	PlayerMissionsInfo, PlayerMissionsInfos
} from "../database/game/models/PlayerMissionsInfo";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";

/** A player who never comes back to the app still keeps a bounded list. */
const MAX_PENDING_REVEALS = 30;

type NewReveal = Omit<PendingReveal, "id">;

function bitOf(flag: AppStateFlag): number {
	return 2 ** APP_STATE_FLAGS.indexOf(flag);
}

export function seenFlags(appSeen: number): AppStateFlag[] {
	return APP_STATE_FLAGS.filter(flag => Math.floor(appSeen / bitOf(flag)) % 2 === 1);
}

export function withSeen(appSeen: number, flags: readonly AppStateFlag[]): number {
	const seen = new Set([...seenFlags(appSeen), ...flags]);
	return [...seen].reduce((mask, flag) => mask + bitOf(flag), 0);
}

export function pendingRevealsOf(info: Pick<PlayerMissionsInfo, "pendingReveals">): PendingReveal[] {
	if (!info.pendingReveals) {
		return [];
	}
	try {
		const parsed: unknown = JSON.parse(info.pendingReveals);
		return Array.isArray(parsed) ? parsed as PendingReveal[] : [];
	}
	catch {
		return [];
	}
}

export function storePendingReveals(info: Pick<PlayerMissionsInfo, "pendingReveals">, reveals: readonly PendingReveal[]): void {
	info.pendingReveals = reveals.length === 0 ? null : JSON.stringify(reveals.slice(-MAX_PENDING_REVEALS));
}

/** Numbers the new reveals after the ones already kept, so an id is never given twice. */
export function appendReveals(kept: readonly PendingReveal[], added: readonly NewReveal[]): PendingReveal[] {
	const lastId = kept.reduce((max, reveal) => Math.max(max, reveal.id), 0);
	return [
		...kept, ...added.map((reveal, index) => ({
			...reveal, id: lastId + index + 1
		}))
	];
}

function revealOf(packet: CrowniclesPacket): {
	keycloakId: string; reveal: NewReveal;
} | null {
	if (packet instanceof MissionsCompletedPacket && packet.missions.length > 0) {
		return {
			keycloakId: packet.keycloakId, reveal: { missions: packet }
		};
	}
	if (packet instanceof RoyalLetterPacket) {
		return {
			keycloakId: packet.keycloakId, reveal: { letter: packet }
		};
	}
	return null;
}

async function keepForPlayer(keycloakId: string, reveals: readonly NewReveal[]): Promise<void> {
	const player = await Players.getByKeycloakId(keycloakId);
	if (!player) {
		return;
	}
	await PlayerMissionsInfos.getOfPlayer(player.id);
	await PlayerMissionsInfo.withLocked(player.id, async info => {
		storePendingReveals(info, appendReveals(pendingRevealsOf(info), reveals));
		await info.save();
	});
}

/**
 * Keeps what a response to the app credits the player with, until the app has shown it: the app
 * holds nothing of its own, so a reward told while it was closed or on another phone is not lost.
 * Discord shows everything as it happens and keeps nothing.
 */
export async function keepPendingReveals(context: PacketContext, packets: readonly CrowniclesPacket[]): Promise<void> {
	if (!context.webSocket) {
		return;
	}
	const byPlayer = new Map<string, NewReveal[]>();
	for (const found of packets.map(revealOf)) {
		if (found) {
			byPlayer.set(found.keycloakId, [...byPlayer.get(found.keycloakId) ?? [], found.reveal]);
		}
	}
	for (const [keycloakId, reveals] of byPlayer) {
		try {
			await keepForPlayer(keycloakId, reveals);
		}
		catch (error) {
			CrowniclesLogger.errorWithObj("Could not keep the rewards to show in the app", error);
		}
	}
}
