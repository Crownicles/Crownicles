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
	CommandReportHomeChestActionReq, CommandReportHomeChestActionRes
} from "../../../../../Lib/src/packets/commands/CommandReportPacket";
import { handleChestAction } from "../../report/ReportCityService";

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
}
