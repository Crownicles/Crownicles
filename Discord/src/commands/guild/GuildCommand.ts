import { ICommand } from "../ICommand";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import i18n from "../../translations/i18n";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	CommandGuildPacketReq, CommandGuildPacketRes
} from "../../../../Lib/src/packets/commands/CommandGuildPacket";
import { GuildMember } from "../../../../Lib/src/types/GuildMember";
import { SlashCommandBuilder } from "@discordjs/builders";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesErrorEmbed } from "../../messages/CrowniclesErrorEmbed";
import { GuildConstants } from "../../../../Lib/src/constants/GuildConstants";
import { ColorConstants } from "../../../../Lib/src/constants/ColorConstants";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import { progressBar } from "../../../../Lib/src/utils/StringUtils";
import { PacketUtils } from "../../utils/PacketUtils";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { Language } from "../../../../Lib/src/Language";
import { DisplayUtils } from "../../utils/DisplayUtils";

/**
 * Display all the information about a guild
 */
async function getPacket(interaction: CrowniclesInteraction, keycloakUser: KeycloakUser): Promise<CommandGuildPacketReq | null> {
	const guildNameOption = interaction.options.get("guild");
	const askedGuildName = guildNameOption ? <string>guildNameOption.value : undefined;

	const askedPlayer = await PacketUtils.prepareAskedPlayer(interaction, keycloakUser);
	if (!askedPlayer) {
		return null;
	}

	return makePacket(CommandGuildPacketReq, {
		askedPlayer,
		askedGuildName
	});
}

/**
 * Get the icon depending on what type of member the player is (chief, elder, member)
 * @param member
 * @param packet
 */
function getMemberTypeIcon(member: GuildMember, packet: CommandGuildPacketRes): string {
	return member.id === packet.data!.chiefId
		? CrowniclesIcons.guild.chief
		: member.id === packet.data!.elderId
			? CrowniclesIcons.guild.elder
			: CrowniclesIcons.guild.member;
}

/**
 * Return the icons corresponding to the island status of the member
 * @param member
 * @param lng
 */
function getIslandStatusIcon(member: GuildMember, lng: Language): string {
	return member.islandStatus.isOnPveIsland || member.islandStatus.isOnBoat || member.islandStatus.isPveIslandAlly || member.islandStatus.cannotBeJoinedOnBoat
		? i18n.t("commands:guild.separator", { lng })
		+ (member.islandStatus.isOnPveIsland
			? CrowniclesIcons.guild.isOnPveIsland
			: "")
		+ (member.islandStatus.isOnBoat
			? CrowniclesIcons.guild.isOnBoat
			: "")
		+ (member.islandStatus.isPveIslandAlly
			? CrowniclesIcons.guild.countAsAnAlly
			: "")
		+ (member.islandStatus.cannotBeJoinedOnBoat
			? CrowniclesIcons.guild.cannotBeJoinedOnBoat
			: "")
		: "";
}

export async function handleCommandGuildPacketRes(packet: CommandGuildPacketRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);

	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;

	if (!packet.foundGuild) {
		await interaction.reply({
			embeds: [
				new CrowniclesErrorEmbed(
					interaction.user,
					context,
					interaction,
					i18n.t("error:guildDoesntExist", { lng })
				)
			]
		});
		return;
	}
	let membersInfo = "";
	for (const member of packet.data!.members) {
		membersInfo += i18n.t("commands:guild.memberInfo", {
			lng,
			icon: getMemberTypeIcon(member, packet),
			pseudo: await DisplayUtils.getEscapedUsername(member.keycloakId, lng),
			ranking: member.rank,
			score: member.score,
			islandStatusIcon: getIslandStatusIcon(member, lng)
		});
	}
	const guildCommandEmbed = new CrowniclesEmbed()
		.setThumbnail(GuildConstants.ICON)
		.setTitle(i18n.t("commands:guild.embedTitle", {
			lng,
			guildName: packet.data?.name,
			level: packet.data?.level
		}))
		.addFields({
			name: i18n.t("commands:guild.members", {
				lng,
				memberCount: packet.data!.members.length,
				maxGuildMembers: GuildConstants.MAX_GUILD_MEMBERS
			}),
			value: membersInfo
		});
	if (packet.data!.level >= GuildConstants.GOLDEN_GUILD_LEVEL) {
		guildCommandEmbed.setColor(ColorConstants.GOLD);
	}
	if (packet.data!.description) {
		guildCommandEmbed.setDescription(
			i18n.t("commands:guild.description", {
				lng,
				description: packet.data?.description
			})
		);
	}
	const pveIslandInfo = packet.data!.members.some(
		member => member.keycloakId === context.keycloakId
	)
		? i18n.t("commands:guild.islandInfo", {
			lng,
			membersOnPveIsland: packet.data!.members.filter(member => member.islandStatus.isPveIslandAlly).length
		})
		: "";
	const experienceInfo: string = packet.data!.isMaxLevel
		? i18n.t("commands:guild.xpMax", {
			lng
		})
		: i18n.t("commands:guild.xpNeeded", {
			lng,
			xp: packet.data!.experience.value,
			xpToLevelUp: packet.data!.experience.max
		});
	const rankingInfo = packet.data!.rank.rank > -1
		? i18n.t("commands:guild.ranking", {
			lng,
			rank: packet.data!.rank.rank,
			rankTotal: packet.data!.rank.numberOfGuilds
		})
		: i18n.t("commands:guild.notRanked", {
			lng
		});
	guildCommandEmbed.addFields({
		name: i18n.t("commands:guild.infoTitle", {
			lng,
			memberCount: packet.data!.members.length,
			maxGuildMembers: GuildConstants.MAX_GUILD_MEMBERS
		}),
		value: `${pveIslandInfo}${i18n.t("commands:guild.info", {
			lng,
			experience: experienceInfo,
			guildPoints: packet.data!.rank.score,
			ranking: rankingInfo,
			interpolation: { escapeValue: false }
		})}\n${packet.data!.isMaxLevel ? progressBar(1, 1) : progressBar(packet.data!.experience.value, packet.data!.experience.max)}`
	});
	await interaction.reply({
		embeds: [guildCommandEmbed]
	});
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("guild")
		.addUserOption(option =>
			SlashCommandBuilderGenerator.generateOption("guild", "user", option)
				.setRequired(false))
		.addStringOption(option =>
			SlashCommandBuilderGenerator.generateOption("guild", "guildName", option)
				.setRequired(false))
		.addIntegerOption(option =>
			SlashCommandBuilderGenerator.generateOption("guild", "rank", option)
				.setRequired(false)) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: false
};
