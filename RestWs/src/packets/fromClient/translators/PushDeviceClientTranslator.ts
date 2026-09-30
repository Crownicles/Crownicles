import { fromClientTranslator } from "../FromClientTranslator";
import { InvalidClientPacketError } from "../InvalidClientPacketError";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandPushDeviceRegisterReq, CommandPushDeviceUnregisterReq
} from "../../../../../Lib/src/packets/commands/CommandPushDevicePacket";
import {
	isPushPlatform, isPushToken
} from "../../../../../Lib/src/types/PushDevices";
import { isLanguage } from "../../../../../Lib/src/Language";
import {
	PushDeviceRegisterReq, PushDeviceUnregisterReq
} from "../../../../../WsPackets/src/fromClient/PushDeviceReq";

export default class PushDeviceClientTranslator {
	@fromClientTranslator(PushDeviceRegisterReq)
	public static register(_context: PacketContext, packet: PushDeviceRegisterReq): Promise<CommandPushDeviceRegisterReq> {
		if (!isPushToken(packet.token) || !isPushPlatform(packet.platform) || typeof packet.sandbox !== "boolean" || !isLanguage(packet.language)) {
			throw new InvalidClientPacketError("Invalid push device");
		}
		return asyncMakePacket(CommandPushDeviceRegisterReq, {
			token: packet.token,
			platform: packet.platform,
			sandbox: packet.sandbox,
			language: packet.language
		});
	}

	@fromClientTranslator(PushDeviceUnregisterReq)
	public static unregister(_context: PacketContext, packet: PushDeviceUnregisterReq): Promise<CommandPushDeviceUnregisterReq> {
		if (!isPushToken(packet.token)) {
			throw new InvalidClientPacketError("Invalid push device");
		}
		return asyncMakePacket(CommandPushDeviceUnregisterReq, { token: packet.token });
	}
}
