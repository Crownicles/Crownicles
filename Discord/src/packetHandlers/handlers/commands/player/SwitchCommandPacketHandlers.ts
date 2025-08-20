import { packetHandler } from "../../../PacketHandler";
import {
	CommandSwitchCancelled, CommandSwitchErrorNoItemToSwitch,
	CommandSwitchSuccess
} from "../../../../../../Lib/src/packets/commands/CommandSwitchPacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { handleItemSwitch } from "../../../../commands/player/SwitchCommand";
import { handleClassicError } from "../../../../utils/ErrorUtils";

export default class SwitchCommandPacketHandlers {
	@packetHandler(CommandSwitchSuccess)
	async switchSuccess(context: PacketContext, packet: CommandSwitchSuccess): Promise<void> {
		await handleItemSwitch(packet, context);
	}

	@packetHandler(CommandSwitchCancelled)
	async switchCancelled(context: PacketContext, _packet: CommandSwitchCancelled): Promise<void> {
		await handleClassicError(context, "commands:switch.cancelled");
	}

	@packetHandler(CommandSwitchErrorNoItemToSwitch)
	async switchErrorNoItemToSwitch(context: PacketContext, _packet: CommandSwitchErrorNoItemToSwitch): Promise<void> {
		await handleClassicError(context, "commands:switch.noItemToSwitch");
	}
}
