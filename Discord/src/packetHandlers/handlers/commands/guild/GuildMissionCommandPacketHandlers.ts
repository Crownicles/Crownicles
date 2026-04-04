import { packetHandler } from "../../../PacketHandler";
import {
	CommandGuildMissionNoMission,
	CommandGuildMissionPacketRes
} from "../../../../../../Lib/src/packets/commands/CommandGuildMissionPacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	handleGuildMissionNoMission, handleGuildMissionView
} from "../../../../commands/guild/GuildMissionCommand";

export default class GuildMissionCommandPacketHandlers {
	@packetHandler(CommandGuildMissionPacketRes)
	async guildMissionView(context: PacketContext, packet: CommandGuildMissionPacketRes): Promise<void> {
		await handleGuildMissionView(packet, context);
	}

	@packetHandler(CommandGuildMissionNoMission)
	async guildMissionNoMission(context: PacketContext, _packet: CommandGuildMissionNoMission): Promise<void> {
		await handleGuildMissionNoMission(context);
	}
}
