import { packetHandler } from "../../../PacketHandler";
import {
	CommandMissionShopAlreadyBoughtPointsThisWeek, CommandMissionShopAlreadyHadBadge,
	CommandMissionShopBadge,
	CommandMissionShopKingsFavor,
	CommandMissionShopMarketAnalysis,
	CommandMissionShopMoney, CommandMissionShopNoMissionToSkip, CommandMissionShopNoPet,
	CommandMissionShopPetInformation,
	CommandMissionShopSkipMissionResult
} from "../../../../../../Lib/src/packets/commands/CommandMissionShopPacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { handleClassicError } from "../../../../utils/ErrorUtils";
import {
	handleLovePointsValueShopItem, handleMarketAnalysis, handleMissionShopBadge, handleMissionShopKingsFavor,
	handleMissionShopMoney,
	skipMissionShopResult
} from "../../../../commands/mission/MissionShop";

export default class MissionShopCommandPacketHandlers {
	@packetHandler(CommandMissionShopAlreadyBoughtPointsThisWeek)
	async missionShopAlreadyBoughtPointsThisWeek(context: PacketContext, _packet: CommandMissionShopAlreadyBoughtPointsThisWeek): Promise<void> {
		await handleClassicError(context, "commands:missionsshop.error.alreadyBoughtPointsThisWeek");
	}

	@packetHandler(CommandMissionShopPetInformation)
	async missionShopPetInformation(context: PacketContext, packet: CommandMissionShopPetInformation): Promise<void> {
		await handleLovePointsValueShopItem(packet, context);
	}

	@packetHandler(CommandMissionShopSkipMissionResult)
	async missionShopSkipMissionResult(context: PacketContext, packet: CommandMissionShopSkipMissionResult): Promise<void> {
		await skipMissionShopResult(packet, context);
	}

	@packetHandler(CommandMissionShopMoney)
	async missionShopMoney(context: PacketContext, packet: CommandMissionShopMoney): Promise<void> {
		await handleMissionShopMoney(packet, context);
	}

	@packetHandler(CommandMissionShopKingsFavor)
	async missionShopKingsFavor(context: PacketContext, _packet: CommandMissionShopKingsFavor): Promise<void> {
		await handleMissionShopKingsFavor(context);
	}

	@packetHandler(CommandMissionShopBadge)
	async missionShopBadge(context: PacketContext, _packet: CommandMissionShopBadge): Promise<void> {
		await handleMissionShopBadge(context);
	}

	@packetHandler(CommandMissionShopNoMissionToSkip)
	async missionShopNoMissionToSkip(context: PacketContext, _packet: CommandMissionShopNoMissionToSkip): Promise<void> {
		await handleClassicError(context, "commands:missionsshop.error.noMissionToSkip");
	}

	@packetHandler(CommandMissionShopAlreadyHadBadge)
	async missionShopAlreadyHadBadge(context: PacketContext, _packet: CommandMissionShopAlreadyHadBadge): Promise<void> {
		await handleClassicError(context, "commands:missionsshop.error.alreadyHadBadge");
	}

	@packetHandler(CommandMissionShopNoPet)
	async missionShopNoPet(context: PacketContext, _packet: CommandMissionShopNoPet): Promise<void> {
		await handleClassicError(context, "commands:missionsshop.error.noPet");
	}

	@packetHandler(CommandMissionShopMarketAnalysis)
	async missionShopMarketAnalysis(context: PacketContext, packet: CommandMissionShopMarketAnalysis): Promise<void> {
		await handleMarketAnalysis(packet, context);
	}
}
