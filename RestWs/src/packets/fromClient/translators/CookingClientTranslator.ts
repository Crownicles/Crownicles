import { fromClientTranslator } from "../FromClientTranslator";
import { InvalidClientPacketError } from "../InvalidClientPacketError";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportCookingMenuReq, CommandReportCookingIgniteReq, CommandReportCookingReviveReq,
	CommandReportCookingWoodConfirmRes, CommandReportCookingCraftReq, CommandReportCookingPinReq, CommandReportCookingUnpinReq
} from "../../../../../Lib/src/packets/commands/CommandReportPacket";
import {
	CookingMenuReq, CookingIgniteReq, CookingReviveReq, CookingWoodConfirmReq, CookingCraftReq, CookingPinReq, CookingUnpinReq
} from "../../../../../WsPackets/src/fromClient/CookingReq";

function validateRecipeId(recipeId: string): void {
	if (typeof recipeId !== "string" || !recipeId.trim()) {
		throw new InvalidClientPacketError("Invalid cooking recipe");
	}
}
function validateBoolean(value: boolean): void {
	if (typeof value !== "boolean") {
		throw new InvalidClientPacketError("Invalid cooking confirmation");
	}
}

export default class CookingClientTranslator {
	@fromClientTranslator(CookingMenuReq)
	public static menu(_context: PacketContext, _packet: CookingMenuReq): Promise<CommandReportCookingMenuReq> {
		return asyncMakePacket(CommandReportCookingMenuReq, {});
	}

	@fromClientTranslator(CookingIgniteReq)
	public static ignite(_context: PacketContext, _packet: CookingIgniteReq): Promise<CommandReportCookingIgniteReq> {
		return asyncMakePacket(CommandReportCookingIgniteReq, {});
	}

	@fromClientTranslator(CookingReviveReq)
	public static revive(_context: PacketContext, _packet: CookingReviveReq): Promise<CommandReportCookingReviveReq> {
		return asyncMakePacket(CommandReportCookingReviveReq, {});
	}

	@fromClientTranslator(CookingWoodConfirmReq)
	public static wood(_context: PacketContext, packet: CookingWoodConfirmReq): Promise<CommandReportCookingWoodConfirmRes> {
		validateBoolean(packet.accepted);
		return asyncMakePacket(CommandReportCookingWoodConfirmRes, { accepted: packet.accepted });
	}

	@fromClientTranslator(CookingCraftReq)
	public static craft(_context: PacketContext, packet: CookingCraftReq): Promise<CommandReportCookingCraftReq> {
		validateRecipeId(packet.recipeId);
		if (!Number.isSafeInteger(packet.slotIndex) || packet.slotIndex < 0) {
			throw new InvalidClientPacketError("Invalid cooking slot");
		}
		return asyncMakePacket(CommandReportCookingCraftReq, {
			slotIndex: packet.slotIndex, recipeId: packet.recipeId
		});
	}

	@fromClientTranslator(CookingPinReq)
	public static pin(_context: PacketContext, packet: CookingPinReq): Promise<CommandReportCookingPinReq> {
		validateRecipeId(packet.recipeId);
		validateBoolean(packet.fromIgnitedView);
		return asyncMakePacket(CommandReportCookingPinReq, {
			recipeId: packet.recipeId, fromIgnitedView: packet.fromIgnitedView
		});
	}

	@fromClientTranslator(CookingUnpinReq)
	public static unpin(_context: PacketContext, packet: CookingUnpinReq): Promise<CommandReportCookingUnpinReq> {
		validateBoolean(packet.fromIgnitedView);
		return asyncMakePacket(CommandReportCookingUnpinReq, { fromIgnitedView: packet.fromIgnitedView });
	}
}
