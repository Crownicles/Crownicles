import { packetHandler } from "../../../PacketHandler";
import {
	CommandReportBigEventResultRes,
	CommandReportBuyHealAcceptPacketRes,
	CommandReportBuyHealCannotHealOccupiedPacketRes,
	CommandReportBuyHealNoAlterationPacketRes,
	CommandReportBuyHealRefusePacketRes,
	CommandReportErrorNoMonsterRes,
	CommandReportMonsterRewardRes,
	CommandReportRefusePveFightRes,
	CommandReportTravelSummaryRes,
	CommandReportUseTokensAcceptPacketRes,
	CommandReportUseTokensRefusePacketRes
} from "../../../../../../Lib/src/packets/commands/CommandReportPacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	displayMonsterReward,
	handleBuyHealAccept,
	handleBuyHealCannotHealOccupied,
	handleBuyHealNoAlteration,
	handleBuyHealRefuse,
	handleUseTokensAccept,
	handleUseTokensRefuse,
	refusePveFight,
	reportResult,
	reportTravelSummary
} from "../../../../commands/player/ReportCommand";
import { handleClassicError } from "../../../../utils/ErrorUtils";

export default class ReportCommandPacketHandlers {
	@packetHandler(CommandReportBigEventResultRes)
	async reportResultRes(context: PacketContext, packet: CommandReportBigEventResultRes): Promise<void> {
		await reportResult(packet, context);
	}

	@packetHandler(CommandReportTravelSummaryRes)
	async reportTravelSummaryRes(context: PacketContext, packet: CommandReportTravelSummaryRes): Promise<void> {
		await reportTravelSummary(packet, context);
	}

	@packetHandler(CommandReportMonsterRewardRes)
	async reportMonsterRewardRes(context: PacketContext, packet: CommandReportMonsterRewardRes): Promise<void> {
		await displayMonsterReward(packet, context);
	}

	@packetHandler(CommandReportErrorNoMonsterRes)
	async reportErrorNoMonsterRes(context: PacketContext, _packet: CommandReportErrorNoMonsterRes): Promise<void> {
		await handleClassicError(context, "commands:fight.monsterNotFound");
	}

	@packetHandler(CommandReportRefusePveFightRes)
	async reportRefusePveFightRes(context: PacketContext, packet: CommandReportRefusePveFightRes): Promise<void> {
		await refusePveFight(packet, context);
	}

	@packetHandler(CommandReportUseTokensAcceptPacketRes)
	async reportUseTokensAcceptRes(context: PacketContext, packet: CommandReportUseTokensAcceptPacketRes): Promise<void> {
		await handleUseTokensAccept(packet, context);
	}

	@packetHandler(CommandReportUseTokensRefusePacketRes)
	async reportUseTokensRefuseRes(context: PacketContext, _packet: CommandReportUseTokensRefusePacketRes): Promise<void> {
		await handleUseTokensRefuse(context);
	}

	@packetHandler(CommandReportBuyHealAcceptPacketRes)
	async reportBuyHealAcceptRes(context: PacketContext, packet: CommandReportBuyHealAcceptPacketRes): Promise<void> {
		await handleBuyHealAccept(packet, context);
	}

	@packetHandler(CommandReportBuyHealRefusePacketRes)
	async reportBuyHealRefuseRes(context: PacketContext, _packet: CommandReportBuyHealRefusePacketRes): Promise<void> {
		await handleBuyHealRefuse(context);
	}

	@packetHandler(CommandReportBuyHealNoAlterationPacketRes)
	async reportBuyHealNoAlterationRes(context: PacketContext, _packet: CommandReportBuyHealNoAlterationPacketRes): Promise<void> {
		await handleBuyHealNoAlteration(context);
	}

	@packetHandler(CommandReportBuyHealCannotHealOccupiedPacketRes)
	async reportBuyHealCannotHealOccupiedRes(context: PacketContext, _packet: CommandReportBuyHealCannotHealOccupiedPacketRes): Promise<void> {
		await handleBuyHealCannotHealOccupied(context);
	}
}
