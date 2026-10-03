import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportCookingMenuRes, CommandReportCookingIgniteRes, CommandReportCookingReviveRes,
	CommandReportCookingWoodConfirmReq, CommandReportCookingNoWoodRes, CommandReportCookingUnavailableRes,
	CommandReportCookingCraftRes, CommandReportCookingPinRes, CommandReportCookingUnpinRes
} from "../../../../../Lib/src/packets/commands/CommandReportPacket";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import { CookingRes } from "../../../../../WsPackets/src/fromServer/home/CookingRes";

export default class CookingServerTranslator {
	@fromServerTranslator(CommandReportCookingMenuRes, CookingRes)
	@fromServerTranslator(CommandReportCookingPinRes, CookingRes)
	@fromServerTranslator(CommandReportCookingUnpinRes, CookingRes)
	public static menu(_context: PacketContext, packet: CommandReportCookingMenuRes): Promise<CookingRes> {
		return asyncMakeFromServerPacket(CookingRes, { outcome: {
			kind: "menu", menu: packet.menu
		} });
	}

	@fromServerTranslator(CommandReportCookingIgniteRes, CookingRes)
	@fromServerTranslator(CommandReportCookingReviveRes, CookingRes)
	public static furnace(_context: PacketContext, packet: CommandReportCookingIgniteRes): Promise<CookingRes> {
		return asyncMakeFromServerPacket(CookingRes, { outcome: {
			kind: "furnace", menu: packet.menu, woodConsumed: packet.woodConsumed, woodMaterialId: packet.woodMaterialId
		} });
	}

	@fromServerTranslator(CommandReportCookingWoodConfirmReq, CookingRes)
	public static wood(_context: PacketContext, packet: CommandReportCookingWoodConfirmReq): Promise<CookingRes> {
		return asyncMakeFromServerPacket(CookingRes, { outcome: {
			kind: "woodConfirmation", woodMaterialId: packet.woodMaterialId, woodRarity: packet.woodRarity
		} });
	}

	@fromServerTranslator(CommandReportCookingNoWoodRes, CookingRes)
	public static noWood(_context: PacketContext, _packet: CommandReportCookingNoWoodRes): Promise<CookingRes> {
		return asyncMakeFromServerPacket(CookingRes, { outcome: { kind: "noWood" } });
	}

	@fromServerTranslator(CommandReportCookingUnavailableRes, CookingRes)
	public static unavailable(_context: PacketContext, _packet: CommandReportCookingUnavailableRes): Promise<CookingRes> {
		return asyncMakeFromServerPacket(CookingRes, { outcome: { kind: "unavailable" } });
	}

	@fromServerTranslator(CommandReportCookingCraftRes, CookingRes)
	public static craft(_context: PacketContext, packet: CommandReportCookingCraftRes): Promise<CookingRes> {
		return asyncMakeFromServerPacket(CookingRes, { outcome: {
			kind: "crafted", result: { ...packet }
		} });
	}
}
