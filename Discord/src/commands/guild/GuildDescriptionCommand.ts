import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { SlashCommandBuilder } from "@discordjs/builders";
import {
	CommandGuildDescriptionAcceptPacketRes,
	CommandGuildDescriptionPacketReq,
	CommandGuildDescriptionRefusePacketRes
} from "../../../../Lib/src/packets/commands/CommandGuildDescriptionPacket";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import i18n from "../../translations/i18n";
import { DiscordCollectorUtils } from "../../utils/DiscordCollectorUtils";
import { ReactionCollectorGuildDescriptionPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorGuildDescription";
import { ReactionCollectorReturnTypeOrNull } from "../../packetHandlers/handlers/ReactionCollectorHandlers";
import { escapeUsername } from "../../utils/StringUtils";


export async function createGuildDescriptionCollector(context: PacketContext, packet: ReactionCollectorGuildDescriptionPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	await interaction.deferReply();
	const data = packet.data.data;
	const lng = interaction.userLanguage;
	const embed = new CrowniclesEmbed().formatAuthor(i18n.t("commands:guildDescription.title", {
		lng,
		pseudo: escapeUsername(interaction.user.displayName)
	}), interaction.user)
		.setDescription(
			i18n.t("commands:guildDescription.confirmDesc", {
				lng,
				description: data.description
			})
		);

	return await DiscordCollectorUtils.createAcceptRefuseCollector(interaction, embed, packet, context);
}

export async function handleCommandGuildDescriptionRefusePacketRes(_packet: CommandGuildDescriptionRefusePacketRes, context: PacketContext): Promise<void> {
	const originalInteraction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!originalInteraction) {
		return;
	}
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	const lng = originalInteraction.userLanguage;
	await buttonInteraction?.editReply({
		embeds: [
			new CrowniclesEmbed().formatAuthor(i18n.t("commands:guildDescription.canceledTitle", {
				lng,
				pseudo: escapeUsername(originalInteraction.user.displayName)
			}), originalInteraction.user)
				.setDescription(
					i18n.t("commands:guildDescription.canceledDesc", {
						lng
					})
				)
				.setErrorColor()
		]
	});
}

export async function handleCommandGuildDescriptionAcceptPacketRes(_packet: CommandGuildDescriptionAcceptPacketRes, context: PacketContext): Promise<void> {
	const originalInteraction = DiscordCache.getInteraction(context.discord!.interaction!);
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	if (buttonInteraction && originalInteraction) {
		const lng = originalInteraction.userLanguage;
		await buttonInteraction.editReply({
			embeds: [
				new CrowniclesEmbed().formatAuthor(i18n.t("commands:guildDescription.successDescriptionTitle", {
					lng,
					pseudo: escapeUsername(originalInteraction.user.displayName)
				}), originalInteraction.user)
					.setDescription(
						i18n.t("commands:guildDescription.acceptedDesc", { lng })
					)
			]
		});
	}
}

function getPacket(interaction: CrowniclesInteraction): CommandGuildDescriptionPacketReq {
	const description = <string>interaction.options.get("description", true).value;
	return makePacket(CommandGuildDescriptionPacketReq, { description });
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("guildDescription")
		.addStringOption(option =>
			SlashCommandBuilderGenerator.generateOption("guildDescription", "description", option)
				.setRequired(true)) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: false
};
