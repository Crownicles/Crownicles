import {
	CrowniclesPacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { readdirSync } from "fs";
import { FromServerPacket } from "../../../../WsPackets/src/fromServer/FromServerPacket";

/**
 * Properties saved for each server translator
 */
type ServerTranslatorProperties = {
	translatorFunc: ServerTranslatorFunction<CrowniclesPacket, FromServerPacket>;
	protoName: string;
};

/**
 * Map of all server translators
 */
const serverTranslators = new Map<string, ServerTranslatorProperties>();

/**
 * Class type of packet coming from the server
 */
interface FromServerPacketLike<Packet extends FromServerPacket> {
	new(): Packet;
}

/**
 * Function type of server translator
 */
type ServerTranslatorFunction<T extends CrowniclesPacket, U extends FromServerPacket> = (context: PacketContext, packet: T) => Promise<U>;

/**
 * Decorator to register a server translator
 * @param packet The packet type to translate from
 * @param proto The protobuf type to translate to
 */
export const fromServerTranslator = <T extends CrowniclesPacket, U extends FromServerPacket>(packet: FromServerPacketLike<T>, proto: FromServerPacketLike<U>) =>
	<V>(_target: V, _prop: string, descriptor: TypedPropertyDescriptor<ServerTranslatorFunction<T, U>>): void => {
		serverTranslators.set(packet.name, {
			translatorFunc: descriptor.value! as unknown as ServerTranslatorFunction<CrowniclesPacket, FromServerPacket>,
			protoName: proto.name
		});
		CrowniclesLogger.info(`[ServerTranslator] Registered ${packet.name}`);
	};

/**
 * Register all server translators
 * It will import all files in the translators directory and register the translators
 * decorated with @fromServerTranslator
 */
export async function registerAllServerTranslators(): Promise<void> {
	for (const file of readdirSync("dist/RestWs/src/protobuf/fromServer/translators", {
		recursive: true
	})) {
		if (file.toString().endsWith(".js")) {
			await import(`./translators/${file.toString().substring(0, file.length - 3)}`);
		}
	}
}

/**
 * Get a server translator by name
 * @param packetName Server packet name
 */
export function getServerTranslator(packetName: string): ServerTranslatorProperties | undefined {
	return serverTranslators.get(packetName);
}
