import {
	CrowniclesPacket, PacketLike
} from "../../../Lib/src/packets/CrowniclesPacket";
import { PacketListenerCallbackClient } from "../../../Lib/src/packets/PacketListener";
import { readdirSync } from "fs";
import { DiscordMQTT } from "../bot/DiscordMQTT";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";

export const packetHandler = <T extends CrowniclesPacket>(val: PacketLike<T>) =>
	<V>(target: V, prop: string, descriptor: TypedPropertyDescriptor<PacketListenerCallbackClient<T>>): void => {
		DiscordMQTT.packetListener.addPacketListener<T>(val, descriptor.value! as unknown as PacketListenerCallbackClient<T>);
		CrowniclesLogger.info(`[${val.name}] Registered packet handler (function '${prop}' in class '${target!.constructor.name}')`);
	};

export async function registerAllPacketHandlers(): Promise<void> {
	for (const file of readdirSync("dist/Discord/src/packetHandlers/handlers", {
		recursive: true
	})) {
		if (file.toString().endsWith(".js")) {
			await import(`./handlers/${file.toString().substring(0, file.length - 3)}`);
		}
	}
}
