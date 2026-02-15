import { ReactionCollectorReactPacket } from "../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { packetHandler } from "../PacketHandler";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorController } from "../../utils/ReactionsCollector";
import { ChangeBlockingReasonPacket } from "../../../../../Lib/src/packets/utils/ChangeBlockingReasonPacket";
import { BlockingUtils } from "../../utils/BlockingUtils";
import {
	ReactionCollectorResetTimerPacketReq
} from "../../../../../Lib/src/packets/interaction/ReactionCollectorResetTimer";
import {
	CommandReportHomeChestActionReq, CommandReportHomeChestActionRes,
	CommandReportGardenHarvestReq,
	CommandReportGardenPlantReq
} from "../../../../../Lib/src/packets/commands/CommandReportPacket";
import {
	handleChestAction, handleGardenHarvest, handleGardenPlant
} from "../../report/ReportCityService";
import {
	CommandEquipActionReq, CommandEquipActionRes
} from "../../../../../Lib/src/packets/commands/CommandEquipPacket";
import { handleEquipAction } from "../../utils/EquipActionService";

export default class CoreHandlers {
	@packetHandler(ReactionCollectorReactPacket)
	async reactionCollector(response: CrowniclesPacket[], _context: PacketContext, packet: ReactionCollectorReactPacket): Promise<void> {
		await ReactionCollectorController.reactPacket(response, packet);
	}

	@packetHandler(ChangeBlockingReasonPacket)
	changeBlockingReason(_response: CrowniclesPacket[], context: PacketContext, packet: ChangeBlockingReasonPacket): void {
		BlockingUtils.changeBlockingReason(context.keycloakId!, packet);
	}

	@packetHandler(ReactionCollectorResetTimerPacketReq)
	reactionCollectorResetTimer(response: CrowniclesPacket[], _context: PacketContext, packet: ReactionCollectorResetTimerPacketReq): void {
		ReactionCollectorController.resetTimer(response, packet);
	}

	@packetHandler(CommandReportHomeChestActionReq)
	async homeChestAction(response: CrowniclesPacket[], context: PacketContext, packet: CommandReportHomeChestActionReq): Promise<void> {
		const result = await handleChestAction(context.keycloakId!, packet);
		response.push(makePacket(CommandReportHomeChestActionRes, result));
	}

	@packetHandler(CommandEquipActionReq)
	async equipAction(response: CrowniclesPacket[], context: PacketContext, packet: CommandEquipActionReq): Promise<void> {
		const result = await handleEquipAction(context.keycloakId!, packet);
		response.push(makePacket(CommandEquipActionRes, result));
	}

	@packetHandler(CommandReportGardenHarvestReq)
	async gardenHarvest(response: CrowniclesPacket[], context: PacketContext, packet: CommandReportGardenHarvestReq): Promise<void> {
		response.push(await handleGardenHarvest(context.keycloakId!, packet));
	}

	@packetHandler(CommandReportGardenPlantReq)
	async gardenPlant(response: CrowniclesPacket[], context: PacketContext, packet: CommandReportGardenPlantReq): Promise<void> {
		response.push(await handleGardenPlant(context.keycloakId!, packet));
	}
}
