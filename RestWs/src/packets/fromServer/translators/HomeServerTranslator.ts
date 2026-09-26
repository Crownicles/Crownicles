import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportHomeChestActionRes, CommandReportPlantTransferRes
} from "../../../../../Lib/src/packets/commands/CommandReportPacket";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import {
	HomeChestRes, HomePlantTransferRes
} from "../../../../../WsPackets/src/fromServer/home/HomeRes";

export default class HomeServerTranslator {
	@fromServerTranslator(CommandReportHomeChestActionRes, HomeChestRes)
	public static chest(_context: PacketContext, packet: CommandReportHomeChestActionRes): Promise<HomeChestRes> {
		return asyncMakeFromServerPacket(HomeChestRes, {
			success: packet.success,
			...packet.error ? { error: packet.error } : {},
			data: {
				chestItems: packet.chestItems,
				depositableItems: packet.depositableItems,
				slotsPerCategory: packet.slotsPerCategory,
				inventoryCapacity: packet.inventoryCapacity,
				...packet.plantStorage ? { plantStorage: packet.plantStorage } : {},
				...packet.playerPlantSlots ? { playerPlantSlots: packet.playerPlantSlots } : {},
				...packet.plantMaxCapacity === undefined ? {} : { plantMaxCapacity: packet.plantMaxCapacity }
			}
		});
	}

	@fromServerTranslator(CommandReportPlantTransferRes, HomePlantTransferRes)
	public static plants(_context: PacketContext, packet: CommandReportPlantTransferRes): Promise<HomePlantTransferRes> {
		return asyncMakeFromServerPacket(HomePlantTransferRes, {
			success: packet.success,
			...packet.error ? { error: packet.error } : {},
			plantStorage: packet.plantStorage,
			playerPlantSlots: packet.playerPlantSlots
		});
	}
}
