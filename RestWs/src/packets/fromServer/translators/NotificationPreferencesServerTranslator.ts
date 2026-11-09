import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandNotificationPreferencesRes } from "../../../../../Lib/src/packets/commands/CommandNotificationPreferencesPacket";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import { NotificationPreferencesRes } from "../../../../../WsPackets/src/fromServer/settings/NotificationPreferencesRes";
import { fromServerTranslator } from "../FromServerTranslator";

export default class NotificationPreferencesServerTranslator {
	@fromServerTranslator(CommandNotificationPreferencesRes, NotificationPreferencesRes)
	public static preferences(_context: PacketContext, packet: CommandNotificationPreferencesRes): Promise<NotificationPreferencesRes> {
		return asyncMakeFromServerPacket(NotificationPreferencesRes, { preferences: packet.preferences });
	}
}
