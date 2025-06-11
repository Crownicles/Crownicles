import { packetHandler } from "../../../PacketHandler";
import {
	CommandGuildLeaveNotInAGuildPacketRes
} from "../../../../../../Lib/src/packets/commands/CommandGuildLeavePacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { handleClassicError } from "../../../../utils/ErrorUtils";
import {
	CommandGuildShelterNoPetErrorPacket,
	CommandGuildShelterPacketRes
} from "../../../../../../Lib/src/packets/commands/CommandGuildShelterPacket";
import { handleCommandGuildShelterRes } from "../../../../commands/guild/GuildShelterCommand";

export default class GuildShelterCommandPacketHandlers {
	@packetHandler(CommandGuildShelterNoPetErrorPacket)
	async noPetError(context: PacketContext, _packet: CommandGuildLeaveNotInAGuildPacketRes): Promise<void> {
		await handleClassicError(context, "commands:guildShelter.noPetMessage");
	}

	@packetHandler(CommandGuildShelterPacketRes)
	async guildShelterRes(context: PacketContext, packet: CommandGuildShelterPacketRes): Promise<void> {
		await handleCommandGuildShelterRes(packet, context);
	}
}
