import { packetHandler } from "../../../PacketHandler";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandGuildDomainPacketRes,
	CommandGuildDomainUpgradeGuildLevelTooLowPacket,
	CommandGuildDomainUpgradeMaxLevelPacket,
	CommandGuildDomainUpgradeNotEnoughTreasuryPacket,
	CommandGuildDomainUpgradeSuccessPacket
} from "../../../../../../Lib/src/packets/commands/CommandGuildDomainPacket";
import {
	handleDomainView,
	handleGuildLevelTooLow,
	handleNotEnoughTreasury,
	handleUpgradeMaxLevel,
	handleUpgradeSuccess
} from "../../../../commands/guild/GuildDomainCommand";

export default class GuildDomainCommandPacketHandlers {
	@packetHandler(CommandGuildDomainPacketRes)
	async handleDomainView(context: PacketContext, packet: CommandGuildDomainPacketRes): Promise<void> {
		await handleDomainView(packet, context);
	}

	@packetHandler(CommandGuildDomainUpgradeSuccessPacket)
	async handleUpgradeSuccess(context: PacketContext, packet: CommandGuildDomainUpgradeSuccessPacket): Promise<void> {
		await handleUpgradeSuccess(packet, context);
	}

	@packetHandler(CommandGuildDomainUpgradeMaxLevelPacket)
	async handleUpgradeMaxLevel(context: PacketContext, packet: CommandGuildDomainUpgradeMaxLevelPacket): Promise<void> {
		await handleUpgradeMaxLevel(packet, context);
	}

	@packetHandler(CommandGuildDomainUpgradeNotEnoughTreasuryPacket)
	async handleNotEnoughTreasury(context: PacketContext, packet: CommandGuildDomainUpgradeNotEnoughTreasuryPacket): Promise<void> {
		await handleNotEnoughTreasury(packet, context);
	}

	@packetHandler(CommandGuildDomainUpgradeGuildLevelTooLowPacket)
	async handleGuildLevelTooLow(context: PacketContext, packet: CommandGuildDomainUpgradeGuildLevelTooLowPacket): Promise<void> {
		await handleGuildLevelTooLow(packet, context);
	}
}
