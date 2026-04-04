import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandGuildContributePacketReq,
	CommandGuildContributeSuccessPacket,
	CommandGuildContributeTooLowPacket
} from "../../../../Lib/src/packets/commands/CommandGuildContributePacket";
import { DiscordCache } from "../../bot/DiscordCache";
import {
	sendErrorMessage, SendManner
} from "../../utils/ErrorUtils";
import i18n from "../../translations/i18n";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import { SlashCommandBuilder } from "@discordjs/builders";

function getPacket(interaction: CrowniclesInteraction): CommandGuildContributePacketReq {
	const amount = interaction.options.getInteger("amount", true);
	return makePacket(CommandGuildContributePacketReq, { amount });
}

export async function handleContributeSuccess(packet: CommandGuildContributeSuccessPacket, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;
	await interaction.reply({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t("commands:guildContribute.title", { lng }), interaction.user)
				.setDescription(i18n.t("commands:guildContribute.success", {
					lng,
					amount: packet.amount,
					newTreasury: packet.newTreasury
				}))
		]
	});
}

export async function handleNotEnoughMoney(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!interaction) {
		return;
	}
	await sendErrorMessage(interaction.user, context, interaction,
		i18n.t("commands:guildContribute.notEnoughMoney", { lng: interaction.userLanguage }),
		{ sendManner: SendManner.REPLY });
}

export async function handleTooLow(packet: CommandGuildContributeTooLowPacket, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!interaction) {
		return;
	}
	await sendErrorMessage(interaction.user, context, interaction,
		i18n.t("commands:guildContribute.tooLow", {
			lng: interaction.userLanguage,
			minAmount: packet.minAmount
		}),
		{ sendManner: SendManner.REPLY });
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("guildContribute")
		.addIntegerOption(option =>
			SlashCommandBuilderGenerator.generateOption("guildContribute", "amount", option)
				.setRequired(true)
				.setMinValue(1)) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: false
};
