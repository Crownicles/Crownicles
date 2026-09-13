import { fromClientTranslator } from "../FromClientTranslator";
import { InvalidClientPacketError } from "../InvalidClientPacketError";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandGardenInfoReq, CommandGardenActionReq
} from "../../../../../Lib/src/packets/commands/CommandGardenPacket";
import {
	GARDEN_OPERATIONS, GardenOperation
} from "../../../../../Lib/src/types/Garden";
import { PlantId } from "../../../../../Lib/src/constants/PlantConstants";
import { GardenConstants } from "../../../../../Lib/src/constants/GardenConstants";
import {
	GardenInfoReq, GardenActionReq
} from "../../../../../WsPackets/src/fromClient/GardenReq";

function validateOperation(operation: GardenOperation): GardenOperation {
	if (!operation) {
		throw new InvalidClientPacketError("Missing garden operation");
	}
	switch (operation.type) {
		case GARDEN_OPERATIONS.HARVEST:
		case GARDEN_OPERATIONS.WATER:
			return { type: operation.type };
		case GARDEN_OPERATIONS.PLANT:
			if (!Number.isSafeInteger(operation.gardenSlot) || operation.gardenSlot < 0) {
				throw new InvalidClientPacketError("Invalid garden slot");
			}
			return {
				type: operation.type, gardenSlot: operation.gardenSlot
			};
		case GARDEN_OPERATIONS.COMPOST:
			if (!Number.isSafeInteger(operation.plantId) || !Object.values(PlantId).includes(operation.plantId)) {
				throw new InvalidClientPacketError("Invalid compost plant");
			}
			if (!GardenConstants.COMPOST_QUANTITIES.some(quantity => quantity === operation.quantity)) {
				throw new InvalidClientPacketError("Invalid compost quantity");
			}
			return {
				type: operation.type, plantId: operation.plantId, quantity: operation.quantity
			};
		default: throw new InvalidClientPacketError("Invalid garden operation");
	}
}

export default class GardenClientTranslator {
	@fromClientTranslator(GardenInfoReq)
	public static info(_context: PacketContext, _packet: GardenInfoReq): Promise<CommandGardenInfoReq> {
		return asyncMakePacket(CommandGardenInfoReq, {});
	}

	@fromClientTranslator(GardenActionReq)
	public static action(_context: PacketContext, packet: GardenActionReq): Promise<CommandGardenActionReq> {
		return asyncMakePacket(CommandGardenActionReq, { operation: validateOperation(packet.operation) });
	}
}
