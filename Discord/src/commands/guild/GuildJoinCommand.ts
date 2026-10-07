import {
	ActionRowBuilder, Message, StringSelectMenuBuilder, StringSelectMenuInteraction, StringSelectMenuOptionBuilder
} from "discord.js";
import { SlashCommandBuilder } from "@discordjs/builders";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandGuildJoinPacketReq, CommandGuildJoinPacketRes, CommandGuildRecruitmentListPacketReq, CommandGuildRecruitmentListPacketRes
} from "../../../../Lib/src/packets/commands/CommandGuildRecruitmentPacket";
import { RecruitingGuild } from "../../../../Lib/src/types/GuildRecruitment";
import { GuildConstants } from "../../../../Lib/src/constants/GuildConstants";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { Language } from "../../../../Lib/src/Language";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import i18n from "../../translations/i18n";
import { PacketUtils } from "../../utils/PacketUtils";
import { sendInteractionNotForYou } from "../../utils/ErrorUtils";

const JOIN_MENU_ID = "guildJoinMenu";

function getPacket(interaction: CrowniclesInteraction): CommandGuildRecruitmentListPacketReq {
	const search = interaction.options.get("name")?.value;
	return makePacket(CommandGuildRecruitmentListPacketReq, typeof search === "string" ? { search } : {});
}

function guildLine(guild: RecruitingGuild, lng: Language): string {
	const line = i18n.t("commands:guildJoin.guildLine", {
		lng,
		name: guild.name,
		level: guild.level,
		members: guild.memberCount,
		maxMembers: GuildConstants.MAX_GUILD_MEMBERS,
		minScore: guild.minScore
	});
	return guild.blocker ? `${line}\n${i18n.t(`commands:guildJoin.blockers.${guild.blocker}`, { lng })}` : line;
}

function listDescription(packet: CommandGuildRecruitmentListPacketRes, lng: Language): string {
	if (packet.guilds.length === 0) {
		return i18n.t(packet.search ? "commands:guildJoin.noMatch" : "commands:guildJoin.noSuggestion", {
			lng, search: packet.search
		});
	}
	const intro = i18n.t(packet.search ? "commands:guildJoin.searchIntro" : "commands:guildJoin.suggestionIntro", {
		lng, search: packet.search, score: packet.playerScore
	});
	return `${intro}\n\n${packet.guilds.map(guild => guildLine(guild, lng)).join("\n\n")}`;
}

function joinMenu(guilds: RecruitingGuild[], lng: Language): ActionRowBuilder<StringSelectMenuBuilder> | null {
	const joinable = guilds.filter(guild => !guild.blocker);
	if (joinable.length === 0) {
		return null;
	}
	return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder()
		.setCustomId(JOIN_MENU_ID)
		.setPlaceholder(i18n.t("commands:guildJoin.placeholder", { lng }))
		.addOptions(joinable.map(guild => new StringSelectMenuOptionBuilder()
			.setLabel(guild.name)
			.setDescription(i18n.t("commands:guildJoin.optionDescription", {
				lng, level: guild.level, members: guild.memberCount, maxMembers: GuildConstants.MAX_GUILD_MEMBERS
			}))
			.setValue(String(guild.id)))));
}

/** The chosen guild is joined through Core, which checks again that it still accepts the player. */
function collectJoinChoice(message: Message, row: ActionRowBuilder<StringSelectMenuBuilder>, interaction: CrowniclesInteraction, context: PacketContext): void {
	const lng = interaction.userLanguage;
	const collector = message.createMessageComponentCollector({
		filter: menuInteraction => menuInteraction.customId === JOIN_MENU_ID,
		time: Constants.MESSAGES.COLLECTOR_TIME,
		max: 1
	});
	collector.on("collect", async (menuInteraction: StringSelectMenuInteraction) => {
		if (menuInteraction.user.id !== interaction.user.id) {
			await sendInteractionNotForYou(menuInteraction.user, menuInteraction, lng);
			return;
		}
		await menuInteraction.deferUpdate();
		PacketUtils.sendPacketToBackend(context, makePacket(CommandGuildJoinPacketReq, { guildId: Number(menuInteraction.values[0]) }));
	});
	collector.on("end", async () => {
		row.components.forEach(component => component.setDisabled(true));
		await message.edit({ components: [row] });
	});
}

export async function handleCommandGuildRecruitmentListPacketRes(packet: CommandGuildRecruitmentListPacketRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;
	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:guildJoin.title", { lng }), interaction.user)
		.setDescription(listDescription(packet, lng));
	const row = joinMenu(packet.guilds, lng);
	const content = {
		embeds: [embed],
		components: row ? [row] : []
	};
	const message = interaction.deferred
		? await interaction.editReply(content)
		: (await interaction.reply({
			...content, withResponse: true
		}))?.resource?.message;
	if (row && message) {
		collectJoinChoice(message, row, interaction, context);
	}
}

export async function handleCommandGuildJoinPacketRes(packet: CommandGuildJoinPacketRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;
	await interaction.followUp({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t("commands:guildJoin.joinedTitle", { lng }), interaction.user)
				.setDescription(i18n.t("commands:guildJoin.joined", {
					lng, guildName: packet.guildName
				}))
		]
	});
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("guildJoin")
		.addStringOption(option => SlashCommandBuilderGenerator.generateOption("guildJoin", "name", option)
			.setMaxLength(GuildConstants.GUILD_NAME_LENGTH_RANGE.MAX)
			.setRequired(false)) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: false
};
