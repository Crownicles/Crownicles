import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandMaintenancePacketReq,
	CommandMaintenancePacketRes
} from "../../../../Lib/src/packets/commands/CommandMaintenancePacket";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import i18n from "../../translations/i18n";
import { DiscordCache } from "../../bot/DiscordCache";
import { SlashCommandBuilder } from "@discordjs/builders";

function getPacket(interaction: CrowniclesInteraction): CommandMaintenancePacketReq {
	const enable = interaction.options.getBoolean("enable");
	const save = interaction.options.getBoolean("save");

	return makePacket(CommandMaintenancePacketReq, {
		enable: enable!.valueOf(),
		save: save!.valueOf()
	});
}

export async function handleCommandMaintenancePacketRes(packet: CommandMaintenancePacketRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;
	await interaction.reply({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t("commands:maintenance.title", { lng }), interaction.user)
				.setDescription(i18n.t(packet.enabled ? "commands:maintenance.on" : "commands:maintenance.off", { lng }))
		]
	});
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("maintenance")
		.addBooleanOption(option =>
			SlashCommandBuilderGenerator.generateOption("maintenance", "enable", option)
				.setRequired(true))
		.addBooleanOption(option => SlashCommandBuilderGenerator.generateOption("maintenance", "save", option)
			.setRequired(true)) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: true
};
