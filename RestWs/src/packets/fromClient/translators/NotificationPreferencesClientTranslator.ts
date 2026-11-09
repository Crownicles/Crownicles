import { fromClientTranslator } from "../FromClientTranslator";
import { InvalidClientPacketError } from "../InvalidClientPacketError";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandNotificationPreferenceSetReq, CommandNotificationPreferencesReq
} from "../../../../../Lib/src/packets/commands/CommandNotificationPreferencesPacket";
import { isNotificationType } from "../../../../../Lib/src/types/NotificationPreferences";
import {
	NotificationPreferenceSetReq, NotificationPreferencesReq
} from "../../../../../WsPackets/src/fromClient/NotificationPreferencesReq";

export default class NotificationPreferencesClientTranslator {
	@fromClientTranslator(NotificationPreferencesReq)
	public static read(_context: PacketContext, _packet: NotificationPreferencesReq): Promise<CommandNotificationPreferencesReq> {
		return asyncMakePacket(CommandNotificationPreferencesReq, {});
	}

	@fromClientTranslator(NotificationPreferenceSetReq)
	public static set(_context: PacketContext, packet: NotificationPreferenceSetReq): Promise<CommandNotificationPreferenceSetReq> {
		if (!isNotificationType(packet.type) || typeof packet.enabled !== "boolean") {
			throw new InvalidClientPacketError("Invalid notification preference");
		}
		return asyncMakePacket(CommandNotificationPreferenceSetReq, {
			type: packet.type,
			enabled: packet.enabled
		});
	}
}
