import { fromClientTranslator } from "../FromClientTranslator";
import { InvalidClientPacketError } from "../InvalidClientPacketError";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportGuildDomainUpgradeReq, CommandReportFoodShopBuyReq, CommandReportGuildDomainDepositTreasuryReq
} from "../../../../../Lib/src/packets/commands/CommandReportPacket";
import { GuildBuilding } from "../../../../../Lib/src/constants/GuildDomainConstants";
import { PetConstants } from "../../../../../Lib/src/constants/PetConstants";
import {
	GuildDomainInfoReq, GuildDomainUpgradeReq, GuildDomainFoodReq, GuildDomainDepositReq
} from "../../../../../WsPackets/src/fromClient/GuildDomainReq";
import { CommandGuildDomainInfoReq } from "../../../../../Lib/src/packets/commands/CommandGuildDomainPacket";

function validateAmount(amount: number): void {
	if (!Number.isSafeInteger(amount) || amount <= 0) {
		throw new InvalidClientPacketError("Invalid guild domain amount");
	}
}

export default class GuildDomainClientTranslator {
	@fromClientTranslator(GuildDomainInfoReq)
	public static info(_context: PacketContext, _packet: GuildDomainInfoReq): Promise<CommandGuildDomainInfoReq> {
		return asyncMakePacket(CommandGuildDomainInfoReq, {});
	}

	@fromClientTranslator(GuildDomainUpgradeReq)
	public static upgrade(_context: PacketContext, packet: GuildDomainUpgradeReq): Promise<CommandReportGuildDomainUpgradeReq> {
		const building = Object.values(GuildBuilding).find(value => value === packet.building);
		if (!building) {
			throw new InvalidClientPacketError("Invalid guild building");
		}
		if (!Number.isSafeInteger(packet.expectedLevel) || packet.expectedLevel < 0) {
			throw new InvalidClientPacketError("Invalid guild building level");
		}
		return asyncMakePacket(CommandReportGuildDomainUpgradeReq, {
			building, expectedLevel: packet.expectedLevel
		});
	}

	@fromClientTranslator(GuildDomainFoodReq)
	public static food(_context: PacketContext, packet: GuildDomainFoodReq): Promise<CommandReportFoodShopBuyReq> {
		validateAmount(packet.amount);
		if (!PetConstants.PET_FOOD_BY_ID.includes(packet.foodType)) {
			throw new InvalidClientPacketError("Invalid guild food");
		}
		return asyncMakePacket(CommandReportFoodShopBuyReq, {
			foodType: packet.foodType, amount: packet.amount
		});
	}

	@fromClientTranslator(GuildDomainDepositReq)
	public static deposit(_context: PacketContext, packet: GuildDomainDepositReq): Promise<CommandReportGuildDomainDepositTreasuryReq> {
		validateAmount(packet.amount);
		return asyncMakePacket(CommandReportGuildDomainDepositTreasuryReq, { amount: packet.amount });
	}
}
