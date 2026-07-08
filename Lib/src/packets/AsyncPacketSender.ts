import {
	CrowniclesPacket, PacketContext, PacketLike
} from "./CrowniclesPacket";
import { GuildLevelUpPacket } from "./events/GuildLevelUpPacket";
import { ItemAcceptPacket } from "./events/ItemAcceptPacket";
import { ItemFoundPacket } from "./events/ItemFoundPacket";
import { ItemRefusePacket } from "./events/ItemRefusePacket";
import { MissionsCompletedPacket } from "./events/MissionsCompletedPacket";
import { MissionsExpiredPacket } from "./events/MissionsExpiredPacket";
import { PlayerDeathPacket } from "./events/PlayerDeathPacket";
import { PlayerLeavePveIslandPacket } from "./events/PlayerLeavePveIslandPacket";
import { PlayerLevelUpPacket } from "./events/PlayerLevelUpPacket";
import { PlayerReceivePetPacket } from "./events/PlayerReceivePetPacket";

type AsyncPacketSenderCallback = (context: PacketContext, packetName: string, packet: CrowniclesPacket) => Promise<void> | void;

/**
 * How long a request callback stays registered before being evicted. This is a
 * safety net: every request is normally fulfilled by its response, but if the
 * backend never answers (crash, dropped message…) the entry would otherwise
 * leak forever in {@link AsyncPacketSender.waitingPackets}.
 */
const WAITING_PACKET_TTL_MS = 5 * 60 * 1000;

interface WaitingPacket {
	callback: AsyncPacketSenderCallback;

	/** Timer that evicts this entry if no response ever arrives. */
	evictionTimer: ReturnType<typeof setTimeout>;

	/**
	 * When set, only packets whose class name is in this set may fulfil the
	 * request; any other packet is left for its own listener (see
	 * {@link AsyncPacketSender.handleResponse}).
	 */
	expectedResponseNames?: ReadonlySet<string>;
}

/**
 * Event/broadcast packets: they are pushed into a response batch as *side
 * effects* (mission completion/expiry, level-ups, item grants, pet rewards,
 * death…) rather than as the answer to the request that triggered them. Each
 * has its own dedicated front-end listener and is never awaited as a request
 * response, so a pending {@link AsyncPacketSender} request callback must never
 * consume one — otherwise a side-effect packet landing before the real response
 * in the batch would fulfil (and often mis-handle, as a "failure") the request,
 * and the real response would then fall through to the listener lookup and
 * error out.
 *
 * This set must list *every* packet under `Lib/src/packets/events` — a
 * completeness test enforces it (`tests/packets/AsyncPacketSender.test.ts`) so a
 * newly added broadcast can never silently reopen the ordering-bug class.
 *
 * Regression origin: issue #4380 (food-shop buy showed a false "cannot buy"
 * error + a mission error because a MissionsCompletedPacket was consumed by the
 * buy callback).
 */
export const NOTIFICATION_PACKET_NAMES: ReadonlySet<string> = new Set([
	GuildLevelUpPacket.name,
	ItemAcceptPacket.name,
	ItemFoundPacket.name,
	ItemRefusePacket.name,
	MissionsCompletedPacket.name,
	MissionsExpiredPacket.name,
	PlayerDeathPacket.name,
	PlayerLeavePveIslandPacket.name,
	PlayerLevelUpPacket.name,
	PlayerReceivePetPacket.name
]);

export abstract class AsyncPacketSender {
	private waitingPackets: Map<string, WaitingPacket> = new Map();

	protected abstract sendPacket(context: PacketContext, packet: CrowniclesPacket): Promise<void>;

	/**
	 * Send a request packet and register a callback to handle its response.
	 * @param context request context (a fresh packetId is assigned)
	 * @param packet the request packet
	 * @param callback invoked with the response packet
	 * @param expectedResponses optional list of packet classes that are valid
	 * responses to this request. When provided, any packet whose class is not
	 * listed is left untouched for its own listener instead of being consumed
	 * by `callback`. Notification packets are always skipped regardless of this
	 * list.
	 */
	public sendPacketAndHandleResponse(
		context: PacketContext,
		packet: CrowniclesPacket,
		callback: AsyncPacketSenderCallback,
		expectedResponses?: PacketLike<CrowniclesPacket>[]
	): Promise<void> {
		const packetId = crypto.randomUUID();
		context.packetId = packetId;
		const evictionTimer = setTimeout(() => this.waitingPackets.delete(packetId), WAITING_PACKET_TTL_MS);
		evictionTimer.unref?.();
		this.waitingPackets.set(packetId, {
			callback,
			evictionTimer,
			...expectedResponses ? { expectedResponseNames: new Set(expectedResponses.map(packetClass => packetClass.name)) } : {}
		});
		return this.sendPacket(context, packet);
	}

	public async handleResponse(context: PacketContext, packetName: string, packet: CrowniclesPacket): Promise<boolean> {
		if (!context.packetId) {
			return false;
		}
		const waiting = this.waitingPackets.get(context.packetId);
		if (!waiting) {
			return false;
		}

		/*
		 * Side-effect broadcasts (missions, level-ups, item grants, pet rewards,
		 * death…) are never a request's answer: let them reach their own
		 * listener and keep waiting for the real response.
		 */
		if (NOTIFICATION_PACKET_NAMES.has(packetName)) {
			return false;
		}

		/*
		 * If the caller declared which responses it expects, ignore anything
		 * else so it is routed to its dedicated listener instead of being
		 * mis-consumed.
		 */
		if (waiting.expectedResponseNames && !waiting.expectedResponseNames.has(packetName)) {
			return false;
		}

		clearTimeout(waiting.evictionTimer);
		this.waitingPackets.delete(context.packetId);
		await waiting.callback(context, packetName, packet);
		return true;
	}
}
