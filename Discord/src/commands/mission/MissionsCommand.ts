import { ICommand } from "../ICommand";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import i18n from "../../translations/i18n";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { SlashCommandBuilder } from "@discordjs/builders";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesErrorEmbed } from "../../messages/CrowniclesErrorEmbed";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import { KeycloakUtils } from "../../../../Lib/src/keycloak/KeycloakUtils";
import {
	crowniclesClient, keycloakConfig
} from "../../bot/CrowniclesShard";
import {
	CommandMissionsPacketReq,
	CommandMissionsPacketRes
} from "../../../../Lib/src/packets/commands/CommandMissionsPacket";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { MissionType } from "../../../../Lib/src/types/CompletedMission";
import { MissionUtils } from "../../utils/MissionUtils";
import {
	datesAreOnSameDay, finishInTimeDisplay, getTomorrowMidnight
} from "../../../../Lib/src/utils/TimeUtils";
import { PacketUtils } from "../../utils/PacketUtils";
import { MessageFlags } from "discord-api-types/v10";
import { Language } from "../../../../Lib/src/Language";
import { escapeUsername } from "../../../../Lib/src/utils/StringUtils";

/**
 * Get the packet to send to the server
 * @param interaction
 * @param keycloakUser
 */
async function getPacket(interaction: CrowniclesInteraction, keycloakUser: KeycloakUser): Promise<CommandMissionsPacketReq | null> {
	const askedPlayer = await PacketUtils.prepareAskedPlayer(interaction, keycloakUser);
	if (!askedPlayer) {
		return null;
	}
	return makePacket(CommandMissionsPacketReq, { askedPlayer });
}

/**
 * Handle the case where the player is not found
 * @param context
 */
export async function handleCommandMissionPlayerNotFoundPacket(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	await interaction?.reply({
		embeds: [new CrowniclesErrorEmbed(interaction.user, context, interaction, i18n.t("error:playerDoesntExist", { lng: interaction.userLanguage }))],
		flags: MessageFlags.Ephemeral
	});
}

/**
 * Get the campaign mission part of the missions command's response
 * @param packet
 * @param lng
 */
function getCampaignMissionPart(packet: CommandMissionsPacketRes, lng: Language): string {
	// campaignProgression is at 0 if its completed
	if (!packet.campaignProgression) {
		return i18n.t("commands:missions.subcategories.campaignCompleted", { lng });
	}

	// We are guaranteed to have a campaign mission slot, if not, it's a core problem
	const campaignMission = packet.missions.find(mission => mission.missionType === MissionType.CAMPAIGN)!;

	return `${i18n.t("commands:missions.subcategories.campaignCurrent", {
		lng,
		current: packet.campaignProgression,
		max: packet.maxCampaignNumber
	})}\n${i18n.t("commands:missions.missionDisplay", {
		lng,
		mission: MissionUtils.formatBaseMission(campaignMission, lng),
		progressionBar: MissionUtils.generateDisplayProgression(campaignMission.numberDone, campaignMission.missionObjective),
		current: campaignMission.numberDone,
		objective: campaignMission.missionObjective,
		context: "campaign"
	})}`;
}

/**
 * Get the daily mission part of the missions command's response
 * @param packet
 * @param lng
 */
function getDailyMissionPart(packet: CommandMissionsPacketRes, lng: Language): string {
	const dailyMission = packet.missions.find(mission => mission.missionType === MissionType.DAILY)!;
	const missionDisplayKey = datesAreOnSameDay(
		new Date(), // Current date
		new Date(dailyMission.expiresAt ?? 0) // Date of the daily mission or 0 if it's not set
	)
		? "dailyFinished"
		: "missionDisplay";

	return `${i18n.t("commands:missions.subcategories.daily", {
		lng
	})}\n${i18n.t(`commands:missions.${missionDisplayKey}`, {
		lng,
		time: finishInTimeDisplay(getTomorrowMidnight()),
		mission: MissionUtils.formatBaseMission(dailyMission, lng),
		progressionBar: MissionUtils.generateDisplayProgression(dailyMission.numberDone, dailyMission.missionObjective),
		current: dailyMission.numberDone,
		objective: dailyMission.missionObjective,
		context: "other"
	})}`;
}

/**
 * Get the side missions part of the missions command's response
 * @param packet
 * @param lng
 */
function getSideMissionsPart(packet: CommandMissionsPacketRes, lng: Language): string {
	const sideMissions = packet.missions.filter(mission => mission.missionType === MissionType.NORMAL);
	return `${i18n.t("commands:missions.subcategories.sideMissions", {
		lng,
		current: sideMissions.length,
		max: packet.maxSideMissionSlots
	})}\n${sideMissions.length > 0
		? sideMissions.map(mission => i18n.t("commands:missions.missionDisplay", {
			lng,
			mission: MissionUtils.formatBaseMission(mission, lng),
			progressionBar: MissionUtils.generateDisplayProgression(mission.numberDone, mission.missionObjective),
			current: mission.numberDone,
			objective: mission.missionObjective,
			time: finishInTimeDisplay(new Date(mission.expiresAt!)),
			context: "other"
		}))
			.join("\n\n")
		: i18n.t("commands:missions.noCurrentMissions", {
			lng
		})}`;
}

/**
 * Handle the response of the missions command
 * @param packet
 * @param context
 */
export async function handleCommandMissionsPacketRes(packet: CommandMissionsPacketRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;
	const getUser = await KeycloakUtils.getUserByKeycloakId(keycloakConfig, packet.keycloakId!);
	if (getUser.isError) {
		return;
	}
	const discordUser = getUser.payload.user.attributes.discordId
		? crowniclesClient.users.cache.get(getUser.payload.user.attributes.discordId[0]) ?? await crowniclesClient.users.fetch(getUser.payload.user.attributes.discordId[0])
		: null;
	const missionCommandEmbed = new CrowniclesEmbed();

	if (discordUser) {
		missionCommandEmbed.formatAuthor(i18n.t("commands:missions.title", {
			lng,
			pseudo: escapeUsername(discordUser.displayName)
		}), discordUser);
	}
	else {
		missionCommandEmbed.setTitle(i18n.t("commands:missions.title", {
			lng,
			pseudo: escapeUsername(getUser.payload.user.username)
		}));
	}

	missionCommandEmbed.setDescription([
		getCampaignMissionPart(packet, lng),
		getDailyMissionPart(packet, lng),
		getSideMissionsPart(packet, lng)
	].join("\n"));
	await interaction.reply({
		embeds: [missionCommandEmbed]
	});
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("missions")
		.addUserOption(option =>
			SlashCommandBuilderGenerator.generateOption("missions", "user", option)
				.setRequired(false))
		.addIntegerOption(option =>
			SlashCommandBuilderGenerator.generateOption("missions", "rank", option)
				.setRequired(false)) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: false
};
