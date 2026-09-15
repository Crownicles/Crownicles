import type {FromServerPacket} from "ws-packets/src/fromServer/FromServerPacket";

export type PushedPacketHandler<Packet extends FromServerPacket = FromServerPacket> = (packet: Packet) => void;

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

	public dispatch(packetName: string, packet: FromServerPacket): boolean {
		const packetHandlers = this.handlers.get(packetName);
		if (!packetHandlers || packetHandlers.size === 0) {
			return false;
		}

		for (const handler of packetHandlers) {
			handler(packet);
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