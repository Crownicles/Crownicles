import { packetHandler } from "../../../PacketHandler";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandFriendlyFightErrorPacketRes } from "../../../../../../Lib/src/packets/commands/CommandFriendlyFightPacket";
import { handleCommandFriendlyFightError } from "../../../../commands/player/FriendlyFightCommand";

export default class FriendlyFightCommandPacketHandlers {
	@packetHandler(CommandFriendlyFightErrorPacketRes)
	async friendlyFightError(context: PacketContext, packet: CommandFriendlyFightErrorPacketRes): Promise<void> {
		await handleCommandFriendlyFightError(context, packet);
	}
}
