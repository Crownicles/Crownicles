import { packetHandler } from "../../../PacketHandler";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { handleClassicError } from "../../../../utils/ErrorUtils";
import {
	CommandClassesCancelErrorPacket, CommandClassesChangeSuccessPacket,
	CommandClassesCooldownErrorPacket
} from "../../../../../../Lib/src/packets/commands/CommandClassesPacket";
import { dateDisplay } from "../../../../../../Lib/src/utils/TimeUtils";
import { handleCommandClassesChangeSuccessPacket } from "../../../../commands/player/ClassesCommand";

export default class ClassesCommandPacketHandlers {
	@packetHandler(CommandClassesCooldownErrorPacket)
	async classesCooldownError(context: PacketContext, packet: CommandClassesCooldownErrorPacket): Promise<void> {
		await handleClassicError(context, "commands:classes.error.changeClassTooEarly", {
			time: dateDisplay(new Date(packet.timestamp))
		});
	}

	@packetHandler(CommandClassesCancelErrorPacket)
	async classesCancelError(context: PacketContext, _packet: CommandClassesCancelErrorPacket): Promise<void> {
		await handleClassicError(context, "commands:classes.error.canceledPurchase");
	}

	@packetHandler(CommandClassesChangeSuccessPacket)
	async classesChangeSuccess(context: PacketContext, packet: CommandClassesChangeSuccessPacket): Promise<void> {
		await handleCommandClassesChangeSuccessPacket(packet, context);
	}
}
