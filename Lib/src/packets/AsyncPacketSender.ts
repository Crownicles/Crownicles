import {
	CrowniclesPacket, PacketContext, PacketLike
} from "./CrowniclesPacket";
import { MissionsCompletedPacket } from "./events/MissionsCompletedPacket";
import { MissionsExpiredPacket } from "./events/MissionsExpiredPacket";
import { PlayerReceivePetPacket } from "./events/PlayerReceivePetPacket";

type AsyncPacketSenderCallback = (context: PacketContext, packetName: string, packet: CrowniclesPacket) => Promise<void> | void;

interface WaitingPacket {
	callback: AsyncPacketSenderCallback;

	/**
	 * When set, only packets whose class name is in this set may fulfil the
	 * request; any other packet is left for its own listener (see
	 * {@link AsyncPacketSender.handleResponse}).
	 */
	expectedResponseNames?: ReadonlySet<string>;
}

/**
 * Packets that are pushed into a response batch as *side effects* (mission
 * completion, mission expiry, campaign pet rewards) rather than as the answer
 * to the request that triggered them. They are broadcasts routed to their own
 * dedicated listeners, so a pending {@link AsyncPacketSender} request callback
 * must never consume one — otherwise the first side-effect packet in the batch
 * would fulfil (and often mis-handle, as a "failure") the request, and the real
 * response would then fall through to the listener lookup and error out.
 *
 * Regression origin: issue #4380 (food-shop buy showed a false "cannot buy"
 * error + a mission error because a MissionsCompletedPacket was consumed by the
 * buy callback). Centralising the skip here makes the whole class of ordering
 * bugs impossible regardless of the order handlers push packets.
 */
const NOTIFICATION_PACKET_NAMES: ReadonlySet<string> = new Set([
	MissionsCompletedPacket.name,
	MissionsExpiredPacket.name,
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
		context.packetId = crypto.randomUUID();
		this.waitingPackets.set(context.packetId, {
			callback,
			...expectedResponses ? { expectedResponseNames: new Set(expectedResponses.map(response => response.name)) } : {}
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
		 * Side-effect broadcasts (mission completion/expiry, pet rewards) are
		 * never a request's answer: let them reach their own listener and keep
		 * waiting for the real response.
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

		this.waitingPackets.delete(context.packetId);
		await waiting.callback(context, packetName, packet);
		return true;
	}
}
