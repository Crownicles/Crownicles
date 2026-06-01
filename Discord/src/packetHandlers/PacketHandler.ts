import {
	CrowniclesPacket, PacketLike
} from "../../../Lib/src/packets/CrowniclesPacket";
import { PacketListenerCallbackClient } from "../../../Lib/src/packets/PacketListener";
import { readdirSync } from "fs";
import { DiscordMQTT } from "../bot/DiscordMQTT";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";

export const packetHandler = <T extends CrowniclesPacket>(val: PacketLike<T>) =>
	<V>(target: V, prop: string, descriptor: TypedPropertyDescriptor<PacketListenerCallbackClient<T>>): void => {
		/*
		 * The decorated method is the raw, unbound prototype function. The handler class is never
		 * instantiated, so calling the method later leaves `this === undefined`. Any `this.<x>`
		 * inside the body would silently fail (or crash with a confusing TypeError). To make the
		 * pitfall loud, we re-bind `this` to a Proxy whose only purpose is to throw a clear error
		 * if the handler ever tries to access a property on `this`. The lint rule
		 * `crownicles/no-this-in-packet-handler` catches this statically; the proxy is a defense
		 * in depth.
		 */
		const rawCallback = descriptor.value! as unknown as PacketListenerCallbackClient<T>;
		const forbiddenThis = new Proxy({}, {
			get(_t, key): never {
				throw new Error(
					`[${val.name}] @packetHandler method '${prop}' tried to read 'this.${String(key)}': the decorator does not bind 'this'. Use a static method or a module-level function instead. See eslint rule crownicles/no-this-in-packet-handler.`
				);
			}
		});
		const boundCallback = rawCallback.bind(forbiddenThis) as PacketListenerCallbackClient<T>;
		DiscordMQTT.packetListener.addPacketListener<T>(val, boundCallback);
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
