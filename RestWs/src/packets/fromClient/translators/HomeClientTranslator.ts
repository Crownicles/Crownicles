import { fromClientTranslator } from "../FromClientTranslator";
import { InvalidClientPacketError } from "../InvalidClientPacketError";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportHomeChestActionReq, CommandReportHomeChestInfoReq, CommandReportPlantTransferReq
} from "../../../../../Lib/src/packets/commands/CommandReportPacket";
import { HomeConstants } from "../../../../../Lib/src/constants/HomeConstants";
import { ItemCategory } from "../../../../../Lib/src/constants/ItemConstants";
import { PlantId } from "../../../../../Lib/src/constants/PlantConstants";
import {
	HomeChestActionReq, HomeChestInfoReq, HomePlantTransferReq
} from "../../../../../WsPackets/src/fromClient/HomeReq";

function validateSlot(slot: number): void {
	if (!Number.isSafeInteger(slot) || slot < 0) {
		throw new InvalidClientPacketError("Invalid home slot");
	}
}

export default class HomeClientTranslator {
	@fromClientTranslator(HomeChestInfoReq)
	public static info(_context: PacketContext, _packet: HomeChestInfoReq): Promise<CommandReportHomeChestInfoReq> {
		return asyncMakePacket(CommandReportHomeChestInfoReq, {});
	}

	@fromClientTranslator(HomeChestActionReq)
	public static chest(_context: PacketContext, packet: HomeChestActionReq): Promise<CommandReportHomeChestActionReq> {
		validateSlot(packet.slot);
		if (!Object.values(HomeConstants.CHEST_ACTIONS).includes(packet.action)) {
			throw new InvalidClientPacketError("Invalid chest action");
		}
		if (![
			ItemCategory.WEAPON,
			ItemCategory.ARMOR,
			ItemCategory.POTION,
			ItemCategory.OBJECT
		].includes(packet.itemCategory)) {
			throw new InvalidClientPacketError("Invalid chest category");
		}
		if (packet.action === HomeConstants.CHEST_ACTIONS.SWAP) {
			validateSlot(packet.chestSlot);
		}
		return asyncMakePacket(CommandReportHomeChestActionReq, {
			action: packet.action,
			slot: packet.slot,
			itemCategory: packet.itemCategory,
			chestSlot: packet.action === HomeConstants.CHEST_ACTIONS.SWAP ? packet.chestSlot : -1
		});
	}

	@fromClientTranslator(HomePlantTransferReq)
	public static plant(_context: PacketContext, packet: HomePlantTransferReq): Promise<CommandReportPlantTransferReq> {
		validateSlot(packet.playerSlot);
		if (!Object.values(HomeConstants.PLANT_TRANSFER_ACTIONS).includes(packet.action)) {
			throw new InvalidClientPacketError("Invalid plant transfer");
		}
		const plantId = packet.action === HomeConstants.PLANT_TRANSFER_ACTIONS.DEPOSIT ? 0 : packet.plantId;
		if (plantId !== 0 && (!Number.isSafeInteger(plantId) || !Object.values(PlantId).includes(plantId))) {
			throw new InvalidClientPacketError("Invalid plant type");
		}
		return asyncMakePacket(CommandReportPlantTransferReq, {
			action: packet.action, plantId, playerSlot: packet.playerSlot
		});
	}
}
