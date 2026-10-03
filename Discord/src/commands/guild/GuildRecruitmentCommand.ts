import { SlashCommandBuilder } from "@discordjs/builders";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandGuildRecruitmentPacketReq, CommandGuildRecruitmentPacketRes
} from "../../../../Lib/src/packets/commands/CommandGuildRecruitmentPacket";
import { GuildRecruitmentConstants } from "../../../../Lib/src/constants/GuildRecruitmentConstants";
import { LANGUAGE } from "../../../../Lib/src/Language";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import i18n from "../../translations/i18n";

const RECRUITMENT_STATUSES = {
	OPEN: "open",
	CLOSED: "closed"
} as const;

function localizedChoice<T extends string | number>(key: string, value: T, replacements: Record<string, unknown> = {}): {
	name: string; name_localizations: { fr: string }; value: T;
} {
	return {
		name: i18n.t(key, {
			lng: LANGUAGE.ENGLISH, ...replacements
		}),

		// Discord naming conventions
		// eslint-disable-next-line camelcase
		name_localizations: {
			fr: i18n.t(key, {
				lng: LANGUAGE.FRENCH, ...replacements
			})
		},
		value
	};
}

function getPacket(interaction: CrowniclesInteraction): CommandGuildRecruitmentPacketReq {
	const status = interaction.options.get("status")?.value;
	const minimum = interaction.options.get("minimum")?.value;
	return makePacket(CommandGuildRecruitmentPacketReq, {
		...typeof status === "string" ? { open: status === RECRUITMENT_STATUSES.OPEN } : {},
		...typeof minimum === "number" ? { minScore: minimum } : {}
	});
}

export async function handleCommandGuildRecruitmentPacketRes(packet: CommandGuildRecruitmentPacketRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;
	const status = i18n.t(packet.settings.open ? "commands:guildRecruitment.statusOpen" : "commands:guildRecruitment.statusClosed", {
		lng,
		minScore: packet.settings.minScore
	});
	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:guildRecruitment.title", { lng }), interaction.user)
		.setDescription(packet.changed
			? `${i18n.t("commands:guildRecruitment.updated", { lng })}\n\n${status}`
			: `${status}\n\n${i18n.t("commands:guildRecruitment.howToChange", { lng })}`);
	await (interaction.deferred ? interaction.editReply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] }));
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("guildRecruitment")
		.addStringOption(option => SlashCommandBuilderGenerator.generateOption("guildRecruitment", "status", option)
			.addChoices(
				localizedChoice("discordBuilder:guildRecruitment.statuses.open", RECRUITMENT_STATUSES.OPEN),
				localizedChoice("discordBuilder:guildRecruitment.statuses.closed", RECRUITMENT_STATUSES.CLOSED)
			))
		.addIntegerOption(option => SlashCommandBuilderGenerator.generateOption("guildRecruitment", "minimum", option)
			.addChoices(...GuildRecruitmentConstants.MIN_SCORE_STEPS.map(step => localizedChoice("discordBuilder:guildRecruitment.minimumChoice", step, { score: step })))) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: false
};
