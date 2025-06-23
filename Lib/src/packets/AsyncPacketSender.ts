import {
	CrowniclesPacket, PacketContext
} from "./CrowniclesPacket";

type AsyncPacketSenderCallback = (context: PacketContext, packetName: string, packet: CrowniclesPacket) => Promise<void> | void;

export abstract class AsyncPacketSender {
	private waitingPackets: Map<string, AsyncPacketSenderCallback> = new Map();

	protected abstract sendPacket(context: PacketContext, packet: CrowniclesPacket): Promise<void>;

	public sendPacketAndHandleResponse(context: PacketContext, packet: CrowniclesPacket, callback: AsyncPacketSenderCallback): Promise<void> {
		context.packetId = crypto.randomUUID();
		this.waitingPackets.set(context.packetId, callback);
		return this.sendPacket(context, packet);
	}

	public async handleResponse(context: PacketContext, packetName: string, packet: CrowniclesPacket): Promise<boolean> {
		if (context.packetId) {
			const callback = this.waitingPackets.get(context.packetId);
			if (callback) {
				this.waitingPackets.delete(context.packetId);
				await callback(context, packetName, packet);
				return true;
			}
		}

		return false;
	}
}
