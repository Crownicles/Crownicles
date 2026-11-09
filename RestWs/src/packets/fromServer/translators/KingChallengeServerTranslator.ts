import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { KingChallengeTierReachedPacket } from "../../../../../Lib/src/packets/events/KingChallengeTierReachedPacket";
import { KingChallengeTierReachedRes } from "../../../../../WsPackets/src/fromServer/missions/KingChallengeTierReachedRes";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";

export default class KingChallengeServerTranslator {
	@fromServerTranslator(KingChallengeTierReachedPacket, KingChallengeTierReachedRes)
	public static tierReached(context: PacketContext, packet: KingChallengeTierReachedPacket): Promise<KingChallengeTierReachedRes> {
		return asyncMakeFromServerPacket(KingChallengeTierReachedRes, {
			self: packet.keycloakId === context.keycloakId,
			tier: packet.tier,
			crossedTiers: packet.crossedTiers,
			reward: {
				money: packet.reward.money,
				tokens: packet.reward.tokens,
				gems: packet.reward.gems
			},
			ownedTokens: packet.ownedTokens
		});
	}
}
