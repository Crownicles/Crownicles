import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportCookingMenuRes, CommandReportCookingIgniteRes, CommandReportCookingReviveRes,
	CommandReportCookingWoodConfirmReq, CommandReportCookingNoWoodRes, CommandReportCookingUnavailableRes,
	CommandReportCookingCraftRes, CommandReportCookingPinRes, CommandReportCookingUnpinRes,
	CommandReportCookingSetSpecialtyRes, CommandReportCookingRemoveSpecialtyRes, CookingMenuSnapshot
} from "../../../../../Lib/src/packets/commands/CommandReportPacket";
import {
	getCookingSpecialtiesLimit, getNextCookingSpecialtyUnlockLevel, SPECIALTY_SLOT_INDEX, TIME_POTION_WEEKLY_LIMIT_DISPLAY_THRESHOLD
} from "../../../../../Lib/src/constants/CookingConstants";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import { CookingRes } from "../../../../../WsPackets/src/fromServer/home/CookingRes";
import { CookingMenu } from "../../../../../WsPackets/src/objects/Cooking";

/** Core's snapshot, with the limits Lib puts on the cook's level: the app explains them without keeping its own copy. */
function toWireCookingMenu(menu: CookingMenuSnapshot): CookingMenu {
	const nextSpecialtyLevel = getNextCookingSpecialtyUnlockLevel(menu.cookingLevel);
	return {
		...menu,
		rules: {
			specialtyStation: SPECIALTY_SLOT_INDEX,
			specialtyLimit: getCookingSpecialtiesLimit(menu.cookingLevel),
			...nextSpecialtyLevel === null ? {} : { nextSpecialtyLevel },
			timePotionsShownFrom: TIME_POTION_WEEKLY_LIMIT_DISPLAY_THRESHOLD
		}
	};
}

export default class CookingServerTranslator {
	@fromServerTranslator(CommandReportCookingMenuRes, CookingRes)
	@fromServerTranslator(CommandReportCookingPinRes, CookingRes)
	@fromServerTranslator(CommandReportCookingUnpinRes, CookingRes)
	public static menu(_context: PacketContext, packet: CommandReportCookingMenuRes): Promise<CookingRes> {
		return asyncMakeFromServerPacket(CookingRes, { outcome: {
			kind: "menu", menu: toWireCookingMenu(packet.menu)
		} });
	}

	@fromServerTranslator(CommandReportCookingIgniteRes, CookingRes)
	@fromServerTranslator(CommandReportCookingReviveRes, CookingRes)
	public static furnace(_context: PacketContext, packet: CommandReportCookingIgniteRes): Promise<CookingRes> {
		return asyncMakeFromServerPacket(CookingRes, { outcome: {
			kind: "furnace", menu: toWireCookingMenu(packet.menu), woodConsumed: packet.woodConsumed, woodMaterialId: packet.woodMaterialId
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
			kind: "crafted",
			result: {
				...packet, menu: toWireCookingMenu(packet.menu)
			}
		} });
	}

	@fromServerTranslator(CommandReportCookingSetSpecialtyRes, CookingRes)
	public static specialtyChosen(_context: PacketContext, packet: CommandReportCookingSetSpecialtyRes): Promise<CookingRes> {
		return asyncMakeFromServerPacket(CookingRes, { outcome: {
			kind: "specialtyChosen",
			menu: toWireCookingMenu(packet.menu),
			...packet.error === undefined ? {} : { error: packet.error }
		} });
	}

	@fromServerTranslator(CommandReportCookingRemoveSpecialtyRes, CookingRes)
	public static specialtyRemoved(_context: PacketContext, packet: CommandReportCookingRemoveSpecialtyRes): Promise<CookingRes> {
		return asyncMakeFromServerPacket(CookingRes, { outcome: {
			kind: "specialtyRemoved", menu: toWireCookingMenu(packet.menu)
		} });
	}
}
