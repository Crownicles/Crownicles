import { packetHandler } from "../../../PacketHandler";
import {
	CommandJoinBoatAcceptPacketRes,
	CommandJoinBoatNoGuildPacketRes,
	CommandJoinBoatNoMemberOnBoatPacketRes,
	CommandJoinBoatNotEnoughEnergyPacketRes,
	CommandJoinBoatNotEnoughGemsPacketRes,
	CommandJoinBoatRefusePacketRes,
	CommandJoinBoatTooManyRunsPacketRes
} from "../../../../../../Lib/src/packets/commands/CommandJoinBoatPacket";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	handleClassicError, replyEphemeralErrorMessage
} from "../../../../utils/ErrorUtils";
import { DiscordCache } from "../../../../bot/DiscordCache";
import i18n from "../../../../translations/i18n";
import {
	handleCommandJoinBoatAcceptPacketRes,
	handleCommandJoinBoatRefusePacketRes
} from "../../../../commands/player/JoinBoatCommand";

export default class JoinBoatCommandPacketHandlers {
	@packetHandler(CommandJoinBoatNoGuildPacketRes)
	async joinBoatNoGuild(context: PacketContext, _packet: CommandJoinBoatNoGuildPacketRes): Promise<void> {
		await handleClassicError(context, "commands:joinBoat.errorMessage.noGuild");
	}

	@packetHandler(CommandJoinBoatTooManyRunsPacketRes)
	async joinBoatTooManyRuns(context: PacketContext, _packet: CommandJoinBoatTooManyRunsPacketRes): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
		await replyEphemeralErrorMessage(context, interaction, i18n.t("commands:joinBoat.errorMessage.tooManyBoatThisWeek", { lng: interaction.userLanguage }));
	}

	@packetHandler(CommandJoinBoatNoMemberOnBoatPacketRes)
	async joinBoatNoMemberOnBoat(context: PacketContext, _packet: CommandJoinBoatNoMemberOnBoatPacketRes): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
		await replyEphemeralErrorMessage(context, interaction, i18n.t("commands:joinBoat.errorMessage.noMemberOnBoat", { lng: interaction.userLanguage }));
	}

	@packetHandler(CommandJoinBoatNotEnoughEnergyPacketRes)
	async joinBoatNotEnoughEnergy(context: PacketContext, _packet: CommandJoinBoatNotEnoughEnergyPacketRes): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
		await replyEphemeralErrorMessage(context, interaction, i18n.t("commands:joinBoat.errorMessage.notEnoughEnergy", { lng: interaction.userLanguage }));
	}

	@packetHandler(CommandJoinBoatNotEnoughGemsPacketRes)
	async joinBoatNotEnoughGems(context: PacketContext, _packet: CommandJoinBoatNotEnoughGemsPacketRes): Promise<void> {
		await handleClassicError(context, "commands:joinBoat.errorMessage.notEnoughGems");
	}

	@packetHandler(CommandJoinBoatAcceptPacketRes)
	async joinBoatAcceptRes(context: PacketContext, packet: CommandJoinBoatAcceptPacketRes): Promise<void> {
		await handleCommandJoinBoatAcceptPacketRes(packet, context);
	}

	@packetHandler(CommandJoinBoatRefusePacketRes)
	async joinBoatRefuseRes(context: PacketContext, packet: CommandJoinBoatRefusePacketRes): Promise<void> {
		await handleCommandJoinBoatRefusePacketRes(packet, context);
	}
}
