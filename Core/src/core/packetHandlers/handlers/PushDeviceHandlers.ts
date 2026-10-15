import { packetHandler } from "../PacketHandler";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandPushDeviceRegisterReq,
	CommandPushDeviceRes,
	CommandPushDeviceUnregisterReq
} from "../../../../../Lib/src/packets/commands/CommandPushDevicePacket";
import {
	isPushPlatform, isPushToken
} from "../../../../../Lib/src/types/PushDevices";
import { isLanguage } from "../../../../../Lib/src/Language";
import { AppPushDevices } from "../../database/game/models/AppPushDevice";
import { AppNotificationPreferences } from "../../database/game/models/AppNotificationPreference";
import { PacketUtils } from "../../utils/PacketUtils";

export default class PushDeviceHandlers {
	/** The app's settings decide what is pushed: they are created here if the player never opened them. */
	@packetHandler(CommandPushDeviceRegisterReq)
	async register(response: CrowniclesPacket[], context: PacketContext, packet: CommandPushDeviceRegisterReq): Promise<void> {
		const validDevice = isPushToken(packet.token) && isPushPlatform(packet.platform) && typeof packet.sandbox === "boolean";
		if (!validDevice || !isLanguage(packet.language)) {
			PacketUtils.pushInternalError(response, "Invalid push device");
			return;
		}
		await AppPushDevices.register(context.keycloakId!, {
			token: packet.token,
			platform: packet.platform,
			sandbox: packet.sandbox,
			language: packet.language
		});
		const { created } = await AppNotificationPreferences.getOrCreate(context.keycloakId!);
		if (created) {
			PacketUtils.requestDiscordNotificationPreferences({ keycloakId: context.keycloakId! });
		}
		response.push(makePacket(CommandPushDeviceRes, {}));
	}

	/** Nothing is answered: the app sends it while logging out, and RestWs when the push service refused the token. */
	@packetHandler(CommandPushDeviceUnregisterReq)
	async unregister(_response: CrowniclesPacket[], context: PacketContext, packet: CommandPushDeviceUnregisterReq): Promise<void> {
		if (isPushToken(packet.token)) {
			await AppPushDevices.unregister(context.keycloakId!, packet.token);
		}
	}
}
