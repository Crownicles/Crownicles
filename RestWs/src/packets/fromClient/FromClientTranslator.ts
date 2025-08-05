import {
	CrowniclesPacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { readdirSync } from "fs";
import { FromClientPacket } from "../../../../WsPackets/src/fromClient/FromClientPacket";

/**
 * Map of all client translators
 */
const clientTranslators = new Map<string, ClientTranslatorFunction<FromClientPacket, CrowniclesPacket>>();

/**
 * Class type of packet coming from the client
 */
interface FromClientPacketLike<Packet extends FromClientPacket> {
	new(): Packet;
}

/**
 * Function type of client translator
 */
type ClientTranslatorFunction<T extends FromClientPacket, U extends CrowniclesPacket> = (context: PacketContext, packet: T) => Promise<U>;

/**
 * Decorator to register a client translator
 * @param packet The packet type to translate from
 */
export const fromClientTranslator = <T extends FromClientPacket, U extends CrowniclesPacket>(packet: FromClientPacketLike<T>) =>
	<V>(_target: V, _prop: string, descriptor: TypedPropertyDescriptor<ClientTranslatorFunction<T, U>>): void => {
		clientTranslators.set(packet.name, descriptor.value! as unknown as ClientTranslatorFunction<FromClientPacket, CrowniclesPacket>);
		CrowniclesLogger.info(`[ClientTranslator] Registered ${packet.name}`);
	};

/**
 * Register all client translators
 * It will import all files in the translators directory and register the translators
 * decorated with @fromClientTranslator
 */
export async function registerAllClientTranslators(): Promise<void> {
	for (const file of readdirSync("dist/RestWs/src/protobuf/fromClient/translators", {
		recursive: true
	})) {
		if (file.toString().endsWith(".js")) {
			await import(`./translators/${file.toString().substring(0, file.length - 3)}`);
		}
	}
}

/**
 * Get a client translator by name
 * @param protoName The name of the protobuf type
 */
export function getClientTranslator(protoName: string): ClientTranslatorFunction<FromClientPacket, CrowniclesPacket> | undefined {
	return clientTranslators.get(protoName);
}
