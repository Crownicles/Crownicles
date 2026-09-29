import type {FromServerPacket} from "ws-packets/src/fromServer/FromServerPacket";

/** How a pushed packet reached the app: on its own, or also as the answer to a request a screen is awaiting. */
export type PacketDelivery = {answersRequest: boolean};

export type PushedPacketHandler<Packet extends FromServerPacket = FromServerPacket> = (packet: Packet, delivery: PacketDelivery) => void;

type RegisteredHandler = PushedPacketHandler<FromServerPacket>;

export class PushedPacketRegistry {
	private readonly handlers = new Map<string, Set<RegisteredHandler>>();

	private readonly reportedUnhandledPackets = new Set<string>();

	public register<Packet extends FromServerPacket>(packetName: string, handler: PushedPacketHandler<Packet>): () => void {
		const packetHandlers = this.handlers.get(packetName) ?? new Set<RegisteredHandler>();
		packetHandlers.add(handler as RegisteredHandler);
		this.handlers.set(packetName, packetHandlers);

		return (): void => {
			packetHandlers.delete(handler as RegisteredHandler);
			if (packetHandlers.size === 0) {
				this.handlers.delete(packetName);
			}
		};
	}

	public dispatch(packetName: string, packet: FromServerPacket, delivery: PacketDelivery = {answersRequest: false}): boolean {
		const packetHandlers = this.handlers.get(packetName);
		if (!packetHandlers || packetHandlers.size === 0) {
			return false;
		}

		for (const handler of packetHandlers) {
			handler(packet, delivery);
		}
		return true;
	}

	public reportUnhandled(packetName: string): void {
		if (this.reportedUnhandledPackets.has(packetName)) {
			return;
		}

		this.reportedUnhandledPackets.add(packetName);
		console.warn(`No pushed packet handler registered for ${packetName}`);
	}
}