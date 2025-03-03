import {DraftbotInteraction} from "../../messages/DraftbotInteraction";
import {makePacket, PacketContext} from "../../../../Lib/src/packets/DraftBotPacket";
import {ICommand} from "../ICommand";
import {SlashCommandBuilderGenerator} from "../SlashCommandBuilderGenerator";
import {SlashCommandBuilder} from "@discordjs/builders";
import {
	CommandGuildDescriptionAcceptPacketRes,
	CommandGuildDescriptionPacketReq,
	CommandGuildDescriptionRefusePacketRes
} from "../../../../Lib/src/packets/commands/CommandGuildDescriptionPacket";
import {ReactionCollectorCreationPacket} from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {DiscordCache} from "../../bot/DiscordCache";
import {DraftBotEmbed} from "../../messages/DraftBotEmbed";
import i18n from "../../translations/i18n";
import {DiscordCollectorUtils} from "../../utils/DiscordCollectorUtils";
import {ReactionCollectorGuildDescriptionData} from "../../../../Lib/src/packets/interaction/ReactionCollectorGuildDescription";
import {ReactionCollectorReturnType} from "../../packetHandlers/handlers/ReactionCollectorHandlers";


export async function createGuildDescriptionCollector(context: PacketContext, packet: ReactionCollectorCreationPacket): Promise<ReactionCollectorReturnType> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	await interaction.deferReply();
	const data = packet.data.data as ReactionCollectorGuildDescriptionData;
	const embed = new DraftBotEmbed().formatAuthor(i18n.t("commands:guildDescription.title", {
		lng: interaction.userLanguage,
		pseudo: interaction.user.displayName
	}), interaction.user)
		.setDescription(
			i18n.t("commands:guildDescription.confirmDesc", {
				lng: interaction.userLanguage,
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
	await buttonInteraction?.editReply({
		embeds: [
			new DraftBotEmbed().formatAuthor(i18n.t("commands:guildDescription.canceledTitle", {
				lng: originalInteraction.userLanguage,
				pseudo: originalInteraction.user.displayName
			}), originalInteraction.user)
				.setDescription(
					i18n.t("commands:guildDescription.canceledDesc", {
						lng: originalInteraction.userLanguage
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
		await buttonInteraction.editReply({
			embeds: [
				new DraftBotEmbed().formatAuthor(i18n.t("commands:guildDescription.successDescriptionTitle", {
					lng: originalInteraction.userLanguage,
					pseudo: originalInteraction.user.displayName
				}), originalInteraction.user)
					.setDescription(
						i18n.t("commands:guildDescription.acceptedDesc", {lng: originalInteraction.userLanguage})
					)
			]
		});
	}
}

function getPacket(interaction: DraftbotInteraction): CommandGuildDescriptionPacketReq {
	const description = <string>interaction.options.get("description", true).value;
	return makePacket(CommandGuildDescriptionPacketReq, {description});
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("guildDescription")
		.addStringOption(option =>
			SlashCommandBuilderGenerator.generateOption("guildDescription", "description", option)
				.setRequired(true)) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: false
};