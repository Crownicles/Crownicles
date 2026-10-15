import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { PlayerLevelUpPacket } from "../../../../../Lib/src/packets/events/PlayerLevelUpPacket";
import { PlayerLevelUpRes } from "../../../../../WsPackets/src/fromServer/character/PlayerLevelUpRes";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";

export default class PlayerLevelUpServerTranslator {
	@fromServerTranslator(PlayerLevelUpPacket, PlayerLevelUpRes)
	public static translate(context: PacketContext, packet: PlayerLevelUpPacket): Promise<PlayerLevelUpRes> {
		return asyncMakeFromServerPacket<PlayerLevelUpRes>(PlayerLevelUpRes, {
			self: packet.keycloakId === context.keycloakId,
			level: packet.level,
			healthRestored: packet.healthRestored,
			statsIncreased: packet.statsIncreased,
			missionSlotUnlocked: packet.missionSlotUnlocked
		});
	}
}
