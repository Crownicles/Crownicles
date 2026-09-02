import { SlashCommandBuilder } from "@discordjs/builders";
import { ChannelType } from "discord.js";
import { TournamentConstants } from "../../../../Lib/src/constants/TournamentConstants";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { CommandTournamentCreatePacketReq } from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import { LANGUAGE } from "../../../../Lib/src/Language";
import {
	TournamentLevelLimitModes, type TournamentLevelLimitMode
} from "../../../../Lib/src/types/Tournament";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import i18n from "../../translations/i18n";
import {
	createTournamentContext, hasMinimumGuildSize, hasTournamentChannelPermissions,
	isGuildAdministrator, isTournamentParentChannel, replyTournamentError, sendTournamentPacket
} from "./TournamentCommandUtils";

type LevelModeChoice = {
	name: string;
	name_localizations: {
		fr: string;
	};
	value: TournamentLevelLimitMode;
};

function getLevelModeChoice(mode: TournamentLevelLimitMode): LevelModeChoice {
	return {
		name: i18n.t(`discordBuilder:tournament-create.levelModes.${mode}`, { lng: LANGUAGE.ENGLISH }),

		// Discord naming conventions
		// eslint-disable-next-line camelcase
		name_localizations: {
			fr: i18n.t(`discordBuilder:tournament-create.levelModes.${mode}`, { lng: LANGUAGE.FRENCH })
		},
		value: mode
	};
}

async function getPacket(interaction: CrowniclesInteraction, user: KeycloakUser): Promise<null> {
	if (!interaction.guild) {
		return await replyTournamentError(interaction, "guildOnly");
	}
	if (!isGuildAdministrator(interaction)) {
		return await replyTournamentError(interaction, "administratorOnly");
	}
	if (!hasMinimumGuildSize(interaction)) {
		return await replyTournamentError(interaction, "guildTooSmall");
	}
	if (interaction.channel.type !== ChannelType.GuildText && interaction.channel.type !== ChannelType.GuildAnnouncement) {
		return await replyTournamentError(interaction, "invalidChannel");
	}
	if (!isTournamentParentChannel(interaction) || !hasTournamentChannelPermissions(interaction)) {
		return await replyTournamentError(interaction, "missingChannelPermissions");
	}
	const code = interaction.options.getString("code", true);
	const registrationDays = interaction.options.getInteger("registration-days", true);
	const combatDays = interaction.options.getInteger("combat-days", true);
	const levelLimitMode = interaction.options.getString("level-mode") as TournamentLevelLimitMode | null;
	const levelCap = interaction.options.getInteger("level-cap") ?? undefined;
	await interaction.deferReply();
	sendTournamentPacket(await createTournamentContext(interaction, user), makePacket(CommandTournamentCreatePacketReq, {
		code,
		registrationDays,
		combatDays,
		...levelLimitMode ? { levelLimitMode } : {},
		...levelCap !== undefined ? { levelCap } : {}
	}));
	return null;
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("tournament-create")
		.addStringOption(option => SlashCommandBuilderGenerator.generateOption("tournament-create", "code", option).setRequired(true))
		.addIntegerOption(option => SlashCommandBuilderGenerator.generateOption("tournament-create", "registration-days", option)
			.setMinValue(1)
			.setMaxValue(7)
			.setRequired(true))
		.addIntegerOption(option => SlashCommandBuilderGenerator.generateOption("tournament-create", "combat-days", option)
			.setMinValue(1)
			.setMaxValue(7)
			.setRequired(true))
		.addStringOption(option => SlashCommandBuilderGenerator.generateOption("tournament-create", "level-mode", option)
			.addChoices(
				getLevelModeChoice(TournamentLevelLimitModes.CATEGORY),
				getLevelModeChoice(TournamentLevelLimitModes.UNLIMITED),
				getLevelModeChoice(TournamentLevelLimitModes.CAP),
				getLevelModeChoice(TournamentLevelLimitModes.REJECT)
			))
		.addIntegerOption(option => SlashCommandBuilderGenerator.generateOption("tournament-create", "level-cap", option)
			.setMinValue(TournamentConstants.MINIMUM_PLAYER_LEVEL)
			.setMaxValue(TournamentConstants.MAX_LEVEL_CAP)) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: false
};
