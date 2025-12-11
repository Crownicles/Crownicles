import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../bot/DiscordCache";
import { ReactionCollectorJoinBoatPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorJoinBoat";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import i18n from "../../translations/i18n";
import { DiscordCollectorUtils } from "../../utils/DiscordCollectorUtils";
import { ReactionCollectorReturnTypeOrNull } from "../../packetHandlers/handlers/ReactionCollectorHandlers";
import {
	CommandJoinBoatAcceptPacketRes,
	CommandJoinBoatPacketReq,
	CommandJoinBoatRefusePacketRes
} from "../../../../Lib/src/packets/commands/CommandJoinBoatPacket";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { ICommand } from "../ICommand";
import { escapeUsername } from "../../utils/StringUtils";

export async function createJoinBoatCollector(context: PacketContext, packet: ReactionCollectorJoinBoatPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	await interaction.deferReply();
	const data = packet.data.data;
	const lng = interaction.userLanguage;
	const embed = new CrowniclesEmbed().formatAuthor(i18n.t("commands:joinBoat.confirmationMessage.title.confirmation", {
		lng,
		pseudo: escapeUsername(interaction.user.displayName)
	}), interaction.user)
		.setDescription(
			i18n.t("commands:joinBoat.confirmationMessage.description.confirmation.text", {
				lng,
				currentEnergy: data.energy.current,
				maxEnergy: data.energy.max,
				priceText: i18n.t("commands:joinBoat.confirmationMessage.description.confirmation.priceText", {
					lng,
					count: data.price,
					gemsCost: data.price
				})
			})
		);

	return await DiscordCollectorUtils.createAcceptRefuseCollector(interaction, embed, packet, context);
}

export async function handleCommandJoinBoatAcceptPacketRes(packet: CommandJoinBoatAcceptPacketRes, context: PacketContext): Promise<void> {
	const originalInteraction = DiscordCache.getInteraction(context.discord!.interaction!);
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	if (buttonInteraction && originalInteraction) {
		const lng = originalInteraction.userLanguage;
		await buttonInteraction.editReply({
			embeds: [
				new CrowniclesEmbed().formatAuthor(i18n.t("commands:joinBoat.confirmationMessage.title.confirmed", {
					lng,
					pseudo: escapeUsername(originalInteraction.user.displayName)
				}), originalInteraction.user)
					.setDescription(
						i18n.t("commands:joinBoat.confirmationMessage.description.confirmed", {
							lng,
							gainScore: packet.score <= 0
								? ""
								: i18n.t("commands:joinBoat.confirmationMessage.description.confirmedScore", {
									lng,
									score: packet.score
								})
						})
					)
			]
		});
	}
}

export async function handleCommandJoinBoatRefusePacketRes(_packet: CommandJoinBoatRefusePacketRes, context: PacketContext): Promise<void> {
	const originalInteraction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!originalInteraction) {
		return;
	}
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	const lng = originalInteraction.userLanguage;
	await buttonInteraction?.editReply({
		embeds: [
			new CrowniclesEmbed().formatAuthor(i18n.t("commands:joinBoat.confirmationMessage.title.confirmed", {
				lng,
				pseudo: escapeUsername(originalInteraction.user.displayName)
			}), originalInteraction.user)
				.setDescription(i18n.t("commands:joinBoat.refuse", { lng }))
				.setErrorColor()
		]
	});
}

/**
 * Demote an elder from a guild
 */
function getPacket(): CommandJoinBoatPacketReq {
	return makePacket(CommandJoinBoatPacketReq, {});
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("joinBoat"),
	getPacket,
	mainGuildCommand: false
};

