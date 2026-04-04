import { packetHandler } from "../../../PacketHandler";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandGuildContributeNotEnoughMoneyPacket,
	CommandGuildContributeSuccessPacket,
	CommandGuildContributeTooLowPacket
} from "../../../../../../Lib/src/packets/commands/CommandGuildContributePacket";
import {
	handleContributeSuccess, handleNotEnoughMoney, handleTooLow
} from "../../../../commands/guild/GuildContributeCommand";

export default class GuildContributeCommandPacketHandlers {
	@packetHandler(CommandGuildContributeSuccessPacket)
	async handleSuccess(context: PacketContext, packet: CommandGuildContributeSuccessPacket): Promise<void> {
		await handleContributeSuccess(packet, context);
	}

	@packetHandler(CommandGuildContributeNotEnoughMoneyPacket)
	async handleNotEnoughMoney(context: PacketContext, _packet: CommandGuildContributeNotEnoughMoneyPacket): Promise<void> {
		await handleNotEnoughMoney(context);
	}

	@packetHandler(CommandGuildContributeTooLowPacket)
	async handleTooLow(context: PacketContext, packet: CommandGuildContributeTooLowPacket): Promise<void> {
		await handleTooLow(packet, context);
	}
}
