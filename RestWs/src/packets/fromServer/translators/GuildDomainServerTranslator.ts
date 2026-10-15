import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportGuildDomainUpgradeRes, CommandReportGuildDomainUpgradeErrorRes, CommandReportFoodShopBuyRes,
	CommandReportFoodShopBuyErrorRes, CommandReportGuildDomainDepositTreasuryRes, CommandReportGuildDomainDepositTreasuryErrorRes,
	CommandReportGuildDomainPurchaseRes, CommandReportGuildDomainRelocateRes, CommandReportGuildDomainNotEnoughTreasuryRes
} from "../../../../../Lib/src/packets/commands/CommandReportPacket";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import {
	GuildDomainInfoRes, GuildDomainRes
} from "../../../../../WsPackets/src/fromServer/guild/GuildDomainRes";
import { CommandGuildDomainInfoRes } from "../../../../../Lib/src/packets/commands/CommandGuildDomainPacket";

export default class GuildDomainServerTranslator {
	@fromServerTranslator(CommandReportGuildDomainPurchaseRes, GuildDomainRes)
	public static installed(_context: PacketContext, packet: CommandReportGuildDomainPurchaseRes): Promise<GuildDomainRes> {
		return asyncMakeFromServerPacket(GuildDomainRes, { outcome: {
			type: "notary", relocated: false, cost: packet.cost
		} });
	}

	@fromServerTranslator(CommandReportGuildDomainRelocateRes, GuildDomainRes)
	public static relocated(_context: PacketContext, packet: CommandReportGuildDomainRelocateRes): Promise<GuildDomainRes> {
		return asyncMakeFromServerPacket(GuildDomainRes, { outcome: {
			type: "notary", relocated: true, cost: packet.cost
		} });
	}

	@fromServerTranslator(CommandReportGuildDomainNotEnoughTreasuryRes, GuildDomainRes)
	public static notaryFunds(_context: PacketContext, packet: CommandReportGuildDomainNotEnoughTreasuryRes): Promise<GuildDomainRes> {
		return asyncMakeFromServerPacket(GuildDomainRes, { outcome: {
			type: "treasuryMissing", missingTreasury: packet.missingTreasury
		} });
	}

	@fromServerTranslator(CommandGuildDomainInfoRes, GuildDomainInfoRes)
	public static info(_context: PacketContext, packet: CommandGuildDomainInfoRes): Promise<GuildDomainInfoRes> {
		return asyncMakeFromServerPacket(GuildDomainInfoRes, packet.data ? { data: packet.data } : {});
	}

	@fromServerTranslator(CommandReportGuildDomainUpgradeRes, GuildDomainRes)
	public static upgrade(_context: PacketContext, packet: CommandReportGuildDomainUpgradeRes): Promise<GuildDomainRes> {
		return asyncMakeFromServerPacket(GuildDomainRes, { outcome: {
			type: "upgrade", ...packet
		} });
	}

	@fromServerTranslator(CommandReportFoodShopBuyRes, GuildDomainRes)
	public static food(_context: PacketContext, packet: CommandReportFoodShopBuyRes): Promise<GuildDomainRes> {
		return asyncMakeFromServerPacket(GuildDomainRes, { outcome: {
			type: "food", ...packet
		} });
	}

	@fromServerTranslator(CommandReportGuildDomainDepositTreasuryRes, GuildDomainRes)
	public static deposit(_context: PacketContext, packet: CommandReportGuildDomainDepositTreasuryRes): Promise<GuildDomainRes> {
		return asyncMakeFromServerPacket(GuildDomainRes, { outcome: {
			type: "deposit", ...packet
		} });
	}

	@fromServerTranslator(CommandReportGuildDomainUpgradeErrorRes, GuildDomainRes)
	public static upgradeError(_context: PacketContext, packet: CommandReportGuildDomainUpgradeErrorRes): Promise<GuildDomainRes> {
		return asyncMakeFromServerPacket(GuildDomainRes, { outcome: {
			type: "error", error: packet.error
		} });
	}

	@fromServerTranslator(CommandReportFoodShopBuyErrorRes, GuildDomainRes)
	public static foodError(_context: PacketContext, packet: CommandReportFoodShopBuyErrorRes): Promise<GuildDomainRes> {
		return asyncMakeFromServerPacket(GuildDomainRes, { outcome: {
			type: "error", error: packet.error
		} });
	}

	@fromServerTranslator(CommandReportGuildDomainDepositTreasuryErrorRes, GuildDomainRes)
	public static depositError(_context: PacketContext, packet: CommandReportGuildDomainDepositTreasuryErrorRes): Promise<GuildDomainRes> {
		return asyncMakeFromServerPacket(GuildDomainRes, { outcome: {
			type: "error", error: packet.error
		} });
	}
}
