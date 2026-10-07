import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandGardenInfoRes, CommandGardenNoAccessRes, CommandGardenClosedRes
} from "../../../../../Lib/src/packets/commands/CommandGardenPacket";
import {
	CommandReportGardenHarvestRes, CommandReportGardenPlantRes, CommandReportGardenWaterRes,
	CommandReportGardenErrorRes, CommandReportGardenCompostRes, CommandReportGardenCompostNotEnoughPlantsRes
} from "../../../../../Lib/src/packets/commands/CommandReportPacket";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import { GardenRes } from "../../../../../WsPackets/src/fromServer/home/GardenRes";

export default class GardenServerTranslator {
	@fromServerTranslator(CommandGardenInfoRes, GardenRes)
	public static info(_context: PacketContext, packet: CommandGardenInfoRes): Promise<GardenRes> {
		return asyncMakeFromServerPacket(GardenRes, { outcome: {
			kind: "snapshot", garden: packet.garden, compostOffers: packet.compostOffers
		} });
	}

	@fromServerTranslator(CommandGardenNoAccessRes, GardenRes)
	public static noAccess(_context: PacketContext, packet: CommandGardenNoAccessRes): Promise<GardenRes> {
		return asyncMakeFromServerPacket(GardenRes, { outcome: {
			kind: "noAccess", reason: packet.reason
		} });
	}

	@fromServerTranslator(CommandReportGardenHarvestRes, GardenRes)
	public static harvest(_context: PacketContext, packet: CommandReportGardenHarvestRes): Promise<GardenRes> {
		return asyncMakeFromServerPacket(GardenRes, { outcome: {
			kind: "harvest", ...packet
		} });
	}

	@fromServerTranslator(CommandReportGardenPlantRes, GardenRes)
	public static plant(_context: PacketContext, packet: CommandReportGardenPlantRes): Promise<GardenRes> {
		return asyncMakeFromServerPacket(GardenRes, { outcome: {
			kind: "plant", plantId: packet.plantId, gardenSlot: packet.gardenSlot
		} });
	}

	@fromServerTranslator(CommandReportGardenWaterRes, GardenRes)
	public static water(_context: PacketContext, packet: CommandReportGardenWaterRes): Promise<GardenRes> {
		return asyncMakeFromServerPacket(GardenRes, { outcome: {
			kind: "water", ...packet
		} });
	}

	@fromServerTranslator(CommandReportGardenErrorRes, GardenRes)
	public static error(_context: PacketContext, packet: CommandReportGardenErrorRes): Promise<GardenRes> {
		return asyncMakeFromServerPacket(GardenRes, { outcome: {
			kind: "error", error: packet.error, ...packet.availableAt === undefined ? {} : { availableAt: packet.availableAt }
		} });
	}

	@fromServerTranslator(CommandReportGardenCompostRes, GardenRes)
	public static compost(_context: PacketContext, packet: CommandReportGardenCompostRes): Promise<GardenRes> {
		return asyncMakeFromServerPacket(GardenRes, { outcome: {
			kind: "compost", plantId: packet.plantId, quantity: packet.quantity, materials: packet.materials
		} });
	}

	@fromServerTranslator(CommandReportGardenCompostNotEnoughPlantsRes, GardenRes)
	public static insufficient(_context: PacketContext, packet: CommandReportGardenCompostNotEnoughPlantsRes): Promise<GardenRes> {
		return asyncMakeFromServerPacket(GardenRes, { outcome: {
			kind: "notEnoughPlants", plantId: packet.plantId, quantity: packet.quantity
		} });
	}

	@fromServerTranslator(CommandGardenClosedRes, GardenRes)
	public static closed(_context: PacketContext, _packet: CommandGardenClosedRes): Promise<GardenRes> {
		return asyncMakeFromServerPacket(GardenRes, { outcome: { kind: "closed" } });
	}
}
