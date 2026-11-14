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
import { QuestProgress } from "../../../../Lib/src/types/QuestProgress";
import { QuestConstants } from "../../../../Lib/src/constants/QuestConstants";

const MISSIONS_PAGE_IDS = {
	MISSIONS: "missions",
	KING_CHALLENGE: "kingChallenge",
	QUESTS: "quests",
	COMPLETED_QUESTS: "completedQuests"
} as const;

type MissionsPageId = typeof MISSIONS_PAGE_IDS[keyof typeof MISSIONS_PAGE_IDS];

/**
 * Tabs always shown below the missions command
 */
const MISSIONS_TABS: readonly MissionsPageId[] = [
	MISSIONS_PAGE_IDS.MISSIONS,
	MISSIONS_PAGE_IDS.KING_CHALLENGE,
	MISSIONS_PAGE_IDS.QUESTS
];

/**
 * Pages of the quests tab, the completed quests being only reachable from the quests tab
 */
const QUESTS_PAGES: readonly MissionsPageId[] = [MISSIONS_PAGE_IDS.QUESTS, MISSIONS_PAGE_IDS.COMPLETED_QUESTS];

const MISSIONS_PAGE_EMOTES: Record<MissionsPageId, string> = {
	[MISSIONS_PAGE_IDS.MISSIONS]: CrowniclesIcons.missions.sideMission,
	[MISSIONS_PAGE_IDS.KING_CHALLENGE]: CrowniclesIcons.kingChallenge.icon,
	[MISSIONS_PAGE_IDS.QUESTS]: CrowniclesIcons.quests.icon,
	[MISSIONS_PAGE_IDS.COMPLETED_QUESTS]: CrowniclesIcons.quests.stepDone
};

const MISSIONS_PAGE_BUTTON_PREFIX = "missions_page_";

type MissionsEmbedAuthor = {
	discordUser: User | null;
	pseudo: string;
};

type MissionsPages = Record<MissionsPageId, CrowniclesEmbed>;

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
 * Completed steps of a quest followed by its current step and the hint to complete it, or the completion of the quest
 */
function getQuestStepLines(quest: QuestProgress, lng: Language): string[] {
	const steps: readonly string[] = QuestConstants.STEPS[quest.questId];
	const stepKeyPrefix = `commands:missions.quests.list.${quest.questId}.steps`;
	const currentStep = steps[quest.stepsDone];
	return [
		...steps.slice(0, quest.stepsDone)
			.map(step => i18n.t("commands:missions.quests.stepDone", {
				lng,
				step: i18n.t(`${stepKeyPrefix}.${step}.label`, { lng })
			})),
		i18n.t("commands:missions.quests.stepCurrent", {
			lng,
			step: i18n.t(`${stepKeyPrefix}.${currentStep}.label`, { lng }),
			hint: i18n.t(`${stepKeyPrefix}.${currentStep}.hint`, { lng })
		})
	];
}

function isQuestCompleted(quest: QuestProgress): boolean {
	return quest.stepsDone >= QuestConstants.STEPS[quest.questId].length;
}

function getQuestName(quest: QuestProgress, lng: Language): string {
	return i18n.t(`commands:missions.quests.list.${quest.questId}.name`, { lng });
}

/**
 * Display of an ongoing quest: its name, its progression and its steps
 */
function getQuestDisplay(quest: QuestProgress, lng: Language): string {
	const stepCount = QuestConstants.STEPS[quest.questId].length;
	return StringUtils.joinLines([
		i18n.t("commands:missions.quests.header", {
			lng,
			name: getQuestName(quest, lng),
			current: quest.stepsDone,
			max: stepCount,
			progressionBar: MissionUtils.generateDisplayProgression(quest.stepsDone, stepCount)
		}),
		...getQuestStepLines(quest, lng)
	]);
}

/**
 * Description of the quests sub-page of the missions command, which only shows the ongoing quests
 */
function getQuestsDescription(ongoingQuests: QuestProgress[], lng: Language): string {
	return StringUtils.joinParagraphs([
		i18n.t("commands:missions.quests.description", { lng }),
		...ongoingQuests.length > 0
			? ongoingQuests.map(quest => getQuestDisplay(quest, lng))
			: [i18n.t("commands:missions.quests.noOngoingQuest", { lng })]
	]);
}

/**
 * Description of the completed quests sub-page of the missions command, one line per completed quest
 */
function getCompletedQuestsDescription(completedQuests: QuestProgress[], lng: Language): string {
	return completedQuests.length > 0
		? StringUtils.joinLines(completedQuests.map(quest => i18n.t("commands:missions.quests.completedQuest", {
			lng,
			name: getQuestName(quest, lng)
		})))
		: i18n.t("commands:missions.quests.noCompletedQuest", { lng });
}

/**
 * Build an embed of the missions command with the author of the displayed missions
 */
function buildMissionsCommandEmbed(author: MissionsEmbedAuthor, title: string, description: string): CrowniclesEmbed {
	const embed = new CrowniclesEmbed().setDescription(description);
	return author.discordUser ? embed.formatAuthor(title, author.discordUser) : embed.setTitle(title);
}

type MissionsPagesRowOptions = {
	displayedPage: MissionsPageId | null;
	completedQuestsCount: number;
};

/**
 * The tabs of the missions command, plus the completed quests sub-page while a quests page is displayed.
 * The displayed page is disabled, and every button is disabled once no page is displayed anymore
 */
function buildPagesRow({
	displayedPage, completedQuestsCount
}: MissionsPagesRowOptions, lng: Language): ActionRowBuilder<ButtonBuilder> {
	const pages = displayedPage !== null && QUESTS_PAGES.includes(displayedPage)
		? [...MISSIONS_TABS, MISSIONS_PAGE_IDS.COMPLETED_QUESTS]
		: MISSIONS_TABS;
	return new ActionRowBuilder<ButtonBuilder>().addComponents(pages
		.map(page => new ButtonBuilder()
			.setCustomId(`${MISSIONS_PAGE_BUTTON_PREFIX}${page}`)
			.setLabel(i18n.t(`commands:missions.pages.${page}`, {
				lng,
				count: completedQuestsCount
			}))
			.setEmoji(MISSIONS_PAGE_EMOTES[page])
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(page === displayedPage || displayedPage === null)));
}

function getPageOfButton(customId: string): MissionsPageId | undefined {
	return Object.values(MISSIONS_PAGE_IDS)
		.find(page => `${MISSIONS_PAGE_BUTTON_PREFIX}${page}` === customId);
}

/**
 * Let the player who asked switch between the sub-pages of the missions command
 */
function setupMissionsPagesCollector(message: Message, interaction: CrowniclesInteraction, pages: MissionsPages, completedQuestsCount: number): void {
	const lng = interaction.userLanguage;
	const collector = message.createMessageComponentCollector({
		componentType: ComponentType.Button,
		filter: (buttonInteraction: ButtonInteraction) => {
			if (buttonInteraction.user.id !== interaction.user.id) {
				sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
				return false;
			}
			return getPageOfButton(buttonInteraction.customId) !== undefined;
		},
		time: Constants.MESSAGES.COLLECTOR_TIME
	});

	collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
		const page = getPageOfButton(buttonInteraction.customId);
		if (!page) {
			return;
		}
		await buttonInteraction.update({
			embeds: [pages[page]],
			components: [
				buildPagesRow({
					displayedPage: page,
					completedQuestsCount
				}, lng)
			]
		});
	});

	collector.on("end", async () => {
		await message.edit({
			components: [
				buildPagesRow({
					displayedPage: null,
					completedQuestsCount
				}, lng)
			]
		})
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

	const completedQuests = packet.quests.filter(isQuestCompleted);
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
		}), getKingChallengeDescription(packet.kingChallenge, lng)),
		quests: buildMissionsCommandEmbed(author, i18n.t("commands:missions.quests.title", {
			lng,
			pseudo: author.pseudo
		}), getQuestsDescription(packet.quests.filter(quest => !isQuestCompleted(quest)), lng)),
		completedQuests: buildMissionsCommandEmbed(author, i18n.t("commands:missions.quests.completedTitle", {
			lng,
			pseudo: author.pseudo
		}), getCompletedQuestsDescription(completedQuests, lng))
	};

	const msg = await interaction.replyWithMessage({
		embeds: [pages.missions],
		components: [
			buildPagesRow({
				displayedPage: MISSIONS_PAGE_IDS.MISSIONS,
				completedQuestsCount: completedQuests.length
			}, lng)
		]
	});
	if (msg) {
		setupMissionsPagesCollector(msg, interaction, pages, completedQuests.length);
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
