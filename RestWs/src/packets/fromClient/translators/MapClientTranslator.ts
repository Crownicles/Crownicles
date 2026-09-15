import { fromClientTranslator } from "../FromClientTranslator";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandMapPacketReq } from "../../../../../Lib/src/packets/commands/CommandMapPacket";
import { LANGUAGE } from "../../../../../Lib/src/Language";
import { MapReq } from "../../../../../WsPackets/src/fromClient/MapReq";
import { InvalidClientPacketError } from "../InvalidClientPacketError";

export default class MapClientTranslator {
	@fromClientTranslator(MapReq)
	public static map(_context: PacketContext, packet: MapReq): Promise<CommandMapPacketReq> {
		const language = LANGUAGE.LANGUAGES.find(value => value === packet.language);
		if (!language) {
			throw new InvalidClientPacketError("Invalid map language");
		}
		return asyncMakePacket(CommandMapPacketReq, { language });
	}
}
