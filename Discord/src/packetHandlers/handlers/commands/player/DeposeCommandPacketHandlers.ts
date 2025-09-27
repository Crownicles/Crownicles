import { packetHandler } from "../../../PacketHandler";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { handleClassicError } from "../../../../utils/ErrorUtils";
import {
	CommandDepositCancelPacket, CommandDepositCannotDepositPacket,
	CommandDepositNoItemPacket, CommandDepositSuccessPacket
} from "../../../../../../Lib/src/packets/commands/CommandDepositPacket";
import { handleItemDeposit } from "../../../../commands/player/DepositCommand";

export default class DeposeCommandPacketHandlers {
	@packetHandler(CommandDepositSuccessPacket)
	async deposeSuccess(context: PacketContext, packet: CommandDepositSuccessPacket): Promise<void> {
		await handleItemDeposit(packet, context);
	}

	@packetHandler(CommandDepositCancelPacket)
	async deposeCancelled(context: PacketContext, _packet: CommandDepositCancelPacket): Promise<void> {
		await handleClassicError(context, "commands:deposit.cancelled");
	}

	@packetHandler(CommandDepositNoItemPacket)
	async deposeErrorNoItemToDepose(context: PacketContext, _packet: CommandDepositNoItemPacket): Promise<void> {
		await handleClassicError(context, "commands:deposit.noItemToDeposit");
	}

	@packetHandler(CommandDepositCannotDepositPacket)
	async deposeErrorCannotDeposit(context: PacketContext, _packet: CommandDepositCannotDepositPacket): Promise<void> {
		await handleClassicError(context, "commands:deposit.cannotDeposit");
	}
}
