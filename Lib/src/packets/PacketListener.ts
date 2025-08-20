import {
	CrowniclesPacket, PacketContext, PacketLike
} from "./CrowniclesPacket";
import { CrowniclesLogger } from "../logs/CrowniclesLogger";

export class PacketListenerServer {
	private packetCallbacks: Map<string, PacketListenerCallbackServer<CrowniclesPacket>> = new Map<string, PacketListenerCallbackServer<CrowniclesPacket>>();

	public addPacketListener<T extends CrowniclesPacket>(PacketInstance: PacketLike<T>, callback: PacketListenerCallbackServer<T>): void {
		const instance = new PacketInstance();

		// TODO, when going to strict mode in Core, replace ts-ignore by ts-expect-error
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore Even if its always instanciated with subtypes, we don't depend on specifics of subtypes, so its okay
		this.packetCallbacks.set(instance.constructor.name, async (response, context, packet: T): Promise<void> => {
			try {
				await callback(response, context, packet);
			}
			catch (e) {
				CrowniclesLogger.errorWithObj(`${PacketListenerServer.name} : Error while handling packet ${instance.constructor.name}`, e);
				throw e;
			}
		});
	}

	public getListener(packet: string): PacketListenerCallbackServer<CrowniclesPacket> {
		return this.packetCallbacks.get(packet)!;
	}
}

export type PacketListenerCallbackServer<T extends CrowniclesPacket> = (response: CrowniclesPacket[], context: PacketContext, packet: T) => void | Promise<void>;

export class PacketListenerClient {
	private packetCallbacks: Map<string, PacketListenerCallbackClient<CrowniclesPacket>> = new Map<string, PacketListenerCallbackClient<CrowniclesPacket>>();

	public addPacketListener<T extends CrowniclesPacket>(PacketInstance: PacketLike<T>, callback: PacketListenerCallbackClient<T>): void {
		const instance = new PacketInstance();

		// TODO, when going to strict mode in Core, replace ts-ignore by ts-expect-error
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore Even if its always instanciated with subtypes, we don't depend on specifics of subtypes, so its okay
		this.packetCallbacks.set(instance.constructor.name, async (context: PacketContext, packet: T) => {
			try {
				await callback(context, packet);
			}
			catch (e) {
				CrowniclesLogger.errorWithObj(`${PacketListenerClient.name} : Error while handling packet ${instance.constructor.name}`, e);
				throw e;
			}
		});
	}

	public getListener(packet: string): PacketListenerCallbackClient<CrowniclesPacket> | undefined {
		return this.packetCallbacks.get(packet);
	}
}

export type PacketListenerCallbackClient<T extends CrowniclesPacket> = (context: PacketContext, packet: T) => Promise<void>;
