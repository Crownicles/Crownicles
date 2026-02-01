import { readdirSync } from "fs";
import { PacketListenerCallbackServer } from "../../../../Lib/src/packets/PacketListener";
import {
	CrowniclesPacket, PacketLike
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { crowniclesInstance } from "../../index";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";

export const packetHandler = <T extends CrowniclesPacket>(val: PacketLike<T>) =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Decorator needs flexible signature to accept methods with varying parameter counts
	(target: { constructor: { name: string } }, prop: string, descriptor: TypedPropertyDescriptor<any>): void => {
		crowniclesInstance.packetListener.addPacketListener<T>(val, descriptor.value as PacketListenerCallbackServer<T>);
		CrowniclesLogger.info(`[${val.name}] Registered packet handler (function '${prop}' in class '${target.constructor.name}')`);
	};

export async function registerAllPacketHandlers(): Promise<void> {
	for (const file of readdirSync("dist/Core/src/core/packetHandlers/handlers")) {
		if (file.endsWith(".js")) {
			await import(`./handlers/${file.substring(0, file.length - 3)}`);
		}
	}

	for (const file of readdirSync("dist/Core/src/commands/", {
		recursive: true,
		withFileTypes: true
	})) {
		if (file.isFile() && file.name.endsWith(".js")) {
			await import(`../../../../../${file.parentPath}/${file.name.substring(0, file.name.length - 3)}`);
		}
	}
}
