import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { RoyalLetterPacket } from "../../../../../Lib/src/packets/events/RoyalLetterPacket";
import { RoyalLetterRes } from "../../../../../WsPackets/src/fromServer/onboarding/RoyalLetterRes";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";

export default class RoyalLetterServerTranslator {
	@fromServerTranslator(RoyalLetterPacket, RoyalLetterRes)
	public static translate(_context: PacketContext, { keycloakId: _keycloakId, ...letter }: RoyalLetterPacket): Promise<RoyalLetterRes> {
		return asyncMakeFromServerPacket(RoyalLetterRes, letter);
	}
}
