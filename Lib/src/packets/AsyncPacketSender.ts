import {
	CrowniclesPacket, PacketContext
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

type AsyncPacketSenderOptions = {
	timeoutMs?: number;
	onTimeout?: () => void;
};

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
	 * Notification/broadcast packets ({@link NOTIFICATION_PACKET_NAMES}) are
	 * never routed to `callback`; they reach their own listener instead.
	 * @param context request context (a fresh packetId is assigned)
	 * @param packet the request packet
	 * @param callback invoked with the response packet
	 */
	public sendPacketAndHandleResponse(
		context: PacketContext,
		packet: CrowniclesPacket,
		callback: AsyncPacketSenderCallback,
		options: AsyncPacketSenderOptions = {}
	): Promise<void> {
		const packetId = crypto.randomUUID();
		context.packetId = packetId;
		const evictionTimer = setTimeout(() => {
			this.waitingPackets.delete(packetId);
			options.onTimeout?.();
		}, options.timeoutMs ?? WAITING_PACKET_TTL_MS);
		evictionTimer.unref?.();
		this.waitingPackets.set(packetId, {
			callback,
			evictionTimer
		});
		return Promise.resolve()
			.then(() => this.sendPacket(context, packet))
			.catch(error => {
				clearTimeout(evictionTimer);
				this.waitingPackets.delete(packetId);
				throw error;
			});
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

		clearTimeout(waiting.evictionTimer);
		this.waitingPackets.delete(context.packetId);
		await waiting.callback(context, packetName, packet);
		return true;
	}
}
