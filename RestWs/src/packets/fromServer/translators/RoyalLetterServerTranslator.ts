import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { RoyalLetterPacket } from "../../../../../Lib/src/packets/events/RoyalLetterPacket";
import { RoyalLetterRes } from "../../../../../WsPackets/src/fromServer/onboarding/RoyalLetterRes";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";

export default class RoyalLetterServerTranslator {
	@fromServerTranslator(RoyalLetterPacket, RoyalLetterRes)
	public static translate(_context: PacketContext, packet: RoyalLetterPacket): Promise<RoyalLetterRes> {
		return asyncMakeFromServerPacket<RoyalLetterRes>(RoyalLetterRes, {
			letter: packet.letter,
			letters: packet.letters,
			tokens: packet.tokens,
			money: packet.money,
			gems: packet.gems,
			...packet.rank === undefined || packet.rankedPlayers === undefined
				? {}
				: {
					rank: packet.rank, rankedPlayers: packet.rankedPlayers
				}
		});
	}
}
