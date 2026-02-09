import { packetHandler } from "../../../PacketHandler";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandPetExpeditionPacketRes,
	CommandPetExpeditionChoicePacketRes,
	CommandPetExpeditionCancelPacketRes,
	CommandPetExpeditionRecallPacketRes,
	CommandPetExpeditionResolvePacketRes,
	CommandPetExpeditionErrorPacket
} from "../../../../../../Lib/src/packets/commands/CommandPetExpeditionPacket";
import {
	handleExpeditionStatusRes,
	handleExpeditionChoiceRes,
	handleExpeditionCancelRes,
	handleExpeditionRecallRes,
	handleExpeditionResolveRes,
	handleExpeditionError
} from "../../../../commands/pet/expedition/PetExpeditionHandler";

export default class PetExpeditionPacketHandlers {
	@packetHandler(CommandPetExpeditionPacketRes)
	async expeditionStatusRes(context: PacketContext, packet: CommandPetExpeditionPacketRes): Promise<void> {
		await handleExpeditionStatusRes(context, packet);
	}

	@packetHandler(CommandPetExpeditionChoicePacketRes)
	async expeditionChoiceRes(context: PacketContext, packet: CommandPetExpeditionChoicePacketRes): Promise<void> {
		await handleExpeditionChoiceRes(context, packet);
	}

	@packetHandler(CommandPetExpeditionCancelPacketRes)
	async expeditionCancelRes(context: PacketContext, packet: CommandPetExpeditionCancelPacketRes): Promise<void> {
		await handleExpeditionCancelRes(context, packet);
	}

	@packetHandler(CommandPetExpeditionRecallPacketRes)
	async expeditionRecallRes(context: PacketContext, packet: CommandPetExpeditionRecallPacketRes): Promise<void> {
		await handleExpeditionRecallRes(context, packet);
	}

	@packetHandler(CommandPetExpeditionResolvePacketRes)
	async expeditionResolveRes(context: PacketContext, packet: CommandPetExpeditionResolvePacketRes): Promise<void> {
		await handleExpeditionResolveRes(context, packet);
	}

	@packetHandler(CommandPetExpeditionErrorPacket)
	async expeditionError(context: PacketContext, packet: CommandPetExpeditionErrorPacket): Promise<void> {
		await handleExpeditionError(context, packet);
	}
}
