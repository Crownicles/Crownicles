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
import {
	ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ComponentType, Message, User
} from "discord.js";
import { KingChallengeProgress } from "../../../../Lib/src/types/KingChallenge";
import { KingChallengeConstants } from "../../../../Lib/src/constants/KingChallengeConstants";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { StringUtils } from "../../utils/StringUtils";
import { sendInteractionNotForYou } from "../../utils/ErrorUtils";
import { Constants } from "../../../../Lib/src/constants/Constants";

const MISSIONS_BUTTON_IDS = {
	KING_CHALLENGE: "missions_king_challenge",
	MISSIONS: "missions_back"
} as const;

type MissionsButtonId = typeof MISSIONS_BUTTON_IDS[keyof typeof MISSIONS_BUTTON_IDS];

type MissionsEmbedAuthor = {
	discordUser: User | null;
	pseudo: string;
};

type MissionsPages = {
	missions: CrowniclesEmbed;
	kingChallenge: CrowniclesEmbed;
};

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
 * Objective of the next tier of the king's challenge, displayed like a mission, or the completion of the challenge
 */
function getKingChallengeObjective(progress: KingChallengeProgress, lng: Language): string {
	const time = finishInTimeDisplay(new Date(progress.nextResetDate));
	if (progress.tier >= progress.thresholds.length) {
		return i18n.t("commands:missions.kingChallenge.completed", {
			lng,
			time
		});
	}
	const objective = progress.thresholds[progress.tier];
	return i18n.t("commands:missions.kingChallenge.nextTier", {
		lng,
		time,
		nextTier: progress.tier + 1,
		progressionBar: MissionUtils.generateDisplayProgression(progress.weeklyScore, objective),
		current: progress.weeklyScore,
		objective
	});
}

/**
 * One line per tier of the king's challenge, with its threshold, its rewards and whether it is already reached
 */
function getKingChallengeTierLines(progress: KingChallengeProgress, lng: Language): string[] {
	return progress.thresholds.map((threshold, index) => {
		const reward = KingChallengeConstants.REWARDS[index];
		return i18n.t("commands:missions.kingChallenge.tier", {
			lng,
			status: index < progress.tier ? "tierReached" : "tierPending",
			tier: index + 1,
			threshold,
			rewards: MissionUtils.formatRewards({
				moneyDisplay: reward.money,
				tokensDisplay: reward.tokens,
				gemsDisplay: reward.gems
			}, lng)
		});
	});
}

/**
 * Description of the king's challenge sub-page of the missions command
 */
function getKingChallengeDescription(progress: KingChallengeProgress, lng: Language): string {
	return StringUtils.joinParagraphs([
		i18n.t("commands:missions.kingChallenge.description", { lng }),
		StringUtils.joinLines([
			i18n.t("commands:missions.kingChallenge.header", {
				lng,
				tier: progress.tier,
				tierCount: progress.thresholds.length
			}),
			getKingChallengeObjective(progress, lng)
		]),
		StringUtils.joinLines(getKingChallengeTierLines(progress, lng))
	]);
}

/**
 * Build an embed of the missions command with the author of the displayed missions
 */
function buildMissionsCommandEmbed(author: MissionsEmbedAuthor, title: string, description: string): CrowniclesEmbed {
	const embed = new CrowniclesEmbed().setDescription(description);
	return author.discordUser ? embed.formatAuthor(title, author.discordUser) : embed.setTitle(title);
}

function buildToggleButton(showKingChallenge: boolean, lng: Language): ButtonBuilder {
	return new ButtonBuilder()
		.setCustomId(showKingChallenge ? MISSIONS_BUTTON_IDS.KING_CHALLENGE : MISSIONS_BUTTON_IDS.MISSIONS)
		.setLabel(i18n.t(showKingChallenge ? "commands:missions.kingChallenge.button" : "commands:missions.kingChallenge.backButton", { lng }))
		.setEmoji(showKingChallenge ? CrowniclesIcons.kingChallenge.icon : CrowniclesIcons.collectors.back)
		.setStyle(ButtonStyle.Secondary);
}

/**
 * Let the player who asked switch between the missions and the king's challenge sub-page
 */
function setupMissionsToggleCollector(message: Message, interaction: CrowniclesInteraction, pages: MissionsPages): void {
	const lng = interaction.userLanguage;
	const collector = message.createMessageComponentCollector({
		componentType: ComponentType.Button,
		filter: (buttonInteraction: ButtonInteraction) => {
			if (buttonInteraction.user.id !== interaction.user.id) {
				sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
				return false;
			}
			return Object.values(MISSIONS_BUTTON_IDS)
				.includes(buttonInteraction.customId as MissionsButtonId);
		},
		time: Constants.MESSAGES.COLLECTOR_TIME
	});

	let lastButton = buildToggleButton(true, lng);
	collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
		const showKingChallenge = buttonInteraction.customId === MISSIONS_BUTTON_IDS.KING_CHALLENGE;
		lastButton = buildToggleButton(!showKingChallenge, lng);
		await buttonInteraction.update({
			embeds: [showKingChallenge ? pages.kingChallenge : pages.missions],
			components: [new ActionRowBuilder<ButtonBuilder>().addComponents(lastButton)]
		});
	});

	collector.on("end", async () => {
		await message.edit({ components: [new ActionRowBuilder<ButtonBuilder>().addComponents(lastButton.setDisabled(true))] })
			.catch(() => undefined);
	});
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
	const author: MissionsEmbedAuthor = {
		discordUser,
		pseudo: escapeUsername(discordUser?.displayName ?? getUser.payload.user.username)
	};

	const pages: MissionsPages = {
		missions: buildMissionsCommandEmbed(author, i18n.t("commands:missions.title", {
			lng,
			pseudo: author.pseudo
		}), StringUtils.joinLines([
			getCampaignMissionPart(packet, lng),
			getDailyMissionPart(packet, lng),
			getSideMissionsPart(packet, lng)
		])),
		kingChallenge: buildMissionsCommandEmbed(author, i18n.t("commands:missions.kingChallenge.title", {
			lng,
			pseudo: author.pseudo
		}), getKingChallengeDescription(packet.kingChallenge, lng))
	};

	const reply = await interaction.reply({
		embeds: [pages.missions],
		components: [new ActionRowBuilder<ButtonBuilder>().addComponents(buildToggleButton(true, lng))],
		withResponse: true
	});
	if (reply?.resource?.message) {
		setupMissionsToggleCollector(reply.resource.message, interaction, pages);
	}
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
