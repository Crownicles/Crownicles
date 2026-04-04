import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandGuildMissionPacketReq,
	CommandGuildMissionPacketRes
} from "../../../../Lib/src/packets/commands/CommandGuildMissionPacket";
import { DiscordCache } from "../../bot/DiscordCache";
import {
	sendErrorMessage, SendManner
} from "../../utils/ErrorUtils";
import i18n from "../../translations/i18n";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";

function getPacket(): CommandGuildMissionPacketReq {
	return makePacket(CommandGuildMissionPacketReq, {});
}

export async function handleGuildMissionView(packet: CommandGuildMissionPacketRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!interaction) {
		return;
	}

	const lng = interaction.userLanguage;
	const missionName = i18n.t(`commands:guildMission.missions.${packet.missionId}`, { lng });
	const progressPercent = Math.floor(packet.numberDone / packet.objective * 100);
	const expiresIn = Math.max(0, Math.floor((packet.expiresAt - Date.now()) / 3_600_000));

	const description = [
		i18n.t("commands:guildMission.missionName", {
			lng, missionName
		}),
		i18n.t("commands:guildMission.progress", {
			lng,
			numberDone: packet.numberDone,
			objective: packet.objective,
			percent: progressPercent
		}),
		i18n.t("commands:guildMission.contribution", {
			lng, contribution: packet.playerContribution
		}),
		packet.completed
			? i18n.t("commands:guildMission.completed", { lng })
			: i18n.t("commands:guildMission.expiresIn", {
				lng, hours: expiresIn
			})
	].join("\n");

	await interaction.reply({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t("commands:guildMission.title", { lng }), interaction.user)
				.setDescription(description)
		]
	});
}

export async function handleGuildMissionNoMission(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);

	if (interaction) {
		await sendErrorMessage(
			interaction.user,
			context,
			interaction,
			i18n.t("commands:guildMission.noMission", { lng: interaction.userLanguage }),
			{ sendManner: SendManner.REPLY }
		);
	}
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("guildMission"),
	getPacket,
	mainGuildCommand: false
};
