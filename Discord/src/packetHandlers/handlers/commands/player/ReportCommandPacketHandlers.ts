import { packetHandler } from "../../../PacketHandler";
import {
	CommandReportBigEventResultRes,
	CommandReportChooseDestinationCityRes,
	CommandReportEatInnMealCooldownRes,
	CommandReportEatInnMealRes,
	CommandReportErrorNoMonsterRes,
	CommandReportMonsterRewardRes,
	CommandReportNotEnoughMoneyRes,
	CommandReportRefusePveFightRes,
	CommandReportSleepRoomRes,
	CommandReportStayInCity,
	CommandReportTravelSummaryRes
} from "../../../../../../Lib/src/packets/commands/CommandReportPacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	displayMonsterReward,
	handleChooseDestinationCity,
	handleEatInnMeal,
	handleInnRoom,
	refusePveFight,
	reportResult,
	reportTravelSummary,
	stayInCity
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

	@packetHandler(CommandReportStayInCity)
	async reportStayInCity(context: PacketContext, _packet: CommandReportStayInCity): Promise<void> {
		await stayInCity(context);
	}

	@packetHandler(CommandReportChooseDestinationCityRes)
	async reportChooseDestinationCityRes(context: PacketContext, packet: CommandReportChooseDestinationCityRes): Promise<void> {
		await handleChooseDestinationCity(packet, context);
	}

	@packetHandler(CommandReportEatInnMealRes)
	async reportEatInnMealRes(context: PacketContext, packet: CommandReportEatInnMealRes): Promise<void> {
		await handleEatInnMeal(packet, context);
	}

	@packetHandler(CommandReportEatInnMealCooldownRes)
	async reportEatInnMealCooldownRes(context: PacketContext, _packet: CommandReportEatInnMealCooldownRes): Promise<void> {
		await handleClassicError(context, "commands:report.city.inns.eatMealCooldown");
	}

	@packetHandler(CommandReportSleepRoomRes)
	async reportSleepRoomRes(context: PacketContext, packet: CommandReportSleepRoomRes): Promise<void> {
		await handleInnRoom(packet, context);
	}

	@packetHandler(CommandReportNotEnoughMoneyRes)
	async reportNotEnoughMoneyRes(context: PacketContext, packet: CommandReportNotEnoughMoneyRes): Promise<void> {
		await handleClassicError(context, "error:notEnoughMoney", { money: packet.missingMoney });
	}
}
