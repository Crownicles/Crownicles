import {
	ContainerBuilder, TextDisplayBuilder
} from "discord.js";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import i18n from "../../translations/i18n";
import {
	CommandTournamentCancelPacketRes, CommandTournamentCreatePacketRes,
	CommandTournamentErrorPacketRes, CommandTournamentGenerateCodePacketRes,
	CommandTournamentResumePacketRes,
	CommandTournamentStatusPacketRes, CommandTournamentTopPacketRes
} from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import { CommandTopPacketReq } from "../../../../Lib/src/packets/commands/CommandTopPacket";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { Language } from "../../../../Lib/src/Language";
import {
	dateDisplay, finishInTimeDisplay
} from "../../../../Lib/src/utils/TimeUtils";
import { resolveKeycloakPlayerName } from "../../utils/KeycloakPlayerUtils";
import { DisplayUtils } from "../../utils/DisplayUtils";
import { TournamentFightRewardPacket } from "../../../../Lib/src/packets/fights/TournamentFightRewardPacket";
import {
	escapeUsername, StringUtils
} from "../../utils/StringUtils";
import { DiscordCache } from "../../bot/DiscordCache";
import { DiscordMQTT } from "../../bot/DiscordMQTT";
import { CrowniclesPaginatedEmbed } from "../../messages/CrowniclesPaginatedEmbed";
import type { TournamentLevelLimitMode } from "../../../../Lib/src/types/Tournament";
import { TopDataType } from "../../../../Lib/src/types/TopDataType";
import { TopTiming } from "../../../../Lib/src/types/TopTimings";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";

const COMPONENTS_V2_FLAGS = ["IsComponentsV2"] as const;

function getTournamentLevelRuleDescription(
	levelLimitMode: TournamentLevelLimitMode,
	levelCap: number | null,
	lng: Language
): string {
	return i18n.t(`commands:tournament.levelModes.${levelLimitMode}`, {
		lng,
		levelCap: levelCap ?? 0
	});
}

function getInteraction(context: PacketContext): CrowniclesInteraction | null {
	return context.discord?.interaction ? DiscordCache.getInteraction(context.discord.interaction) : null;
}

type TournamentEmbedBuilder = (interaction: CrowniclesInteraction) => CrowniclesEmbed;

async function editTournamentReply(context: PacketContext, buildEmbed: TournamentEmbedBuilder): Promise<void> {
	const interaction = getInteraction(context);
	if (!interaction) {
		return;
	}
	await interaction.editReply({
		embeds: [buildEmbed(interaction)]
	});
}

async function editTournamentMenuReply(
	context: PacketContext,
	titleKey: string,
	buildDescription: (interaction: CrowniclesInteraction) => string
): Promise<void> {
	const interaction = getInteraction(context);
	if (!interaction) {
		return;
	}
	const title = i18n.t(titleKey, { lng: interaction.userLanguage });
	const description = buildDescription(interaction);
	const container = new ContainerBuilder()
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(StringUtils.formatHeader(title)),
			new TextDisplayBuilder().setContent(description)
		);
	await interaction.editReply({
		embeds: [],
		components: [container],
		flags: COMPONENTS_V2_FLAGS
	});
}

export function handleTournamentGenerateCode(context: PacketContext, packet: CommandTournamentGenerateCodePacketRes): Promise<void> {
	return editTournamentMenuReply(context, "commands:tournament.codeTitle", interaction => i18n.t("commands:tournament.codeCreated", {
		lng: interaction.userLanguage,
		code: packet.code,
		expiresAt: dateDisplay(new Date(packet.expiresAt))
	}));
}

export function handleTournamentCreate(context: PacketContext, packet: CommandTournamentCreatePacketRes): Promise<void> {
	return editTournamentMenuReply(context, "commands:tournament.createTitle", interaction => i18n.t("commands:tournament.created", {
		lng: interaction.userLanguage,
		tournamentId: packet.tournamentId,
		registrationEndsAt: dateDisplay(new Date(packet.registrationEndsAt)),
		combatEndsAt: dateDisplay(new Date(packet.combatEndsAt)),
		channel: `<#${packet.channelId}>`,
		levelRule: getTournamentLevelRuleDescription(packet.levelLimitMode, packet.levelCap, interaction.userLanguage)
	}));
}

function getTournamentRewardDescription(packet: CommandTournamentStatusPacketRes, lng: Language): string {
	if (!packet.reward) {
		return i18n.t("commands:tournament.noReward", { lng });
	}
	return i18n.t(packet.reward.granted
		? "commands:tournament.rewardGranted"
		: "commands:tournament.rewardPending", {
		lng,
		xp: DisplayUtils.formatNumber(packet.reward.xp, lng),
		money: DisplayUtils.formatNumber(packet.reward.money, lng),
		itemCount: packet.reward.itemCount
	});
}

export async function handleTournamentStatus(context: PacketContext, packet: CommandTournamentStatusPacketRes): Promise<void> {
	await editTournamentReply(context, interaction => {
		const lng = interaction.userLanguage;
		return new CrowniclesEmbed()
			.setTitle(i18n.t(packet.newlyRegistered ? "commands:tournament.registerTitle" : "commands:tournament.statusTitle", { lng }))
			.setDescription(i18n.t(packet.newlyRegistered ? "commands:tournament.registered" : "commands:tournament.status", {
				lng,
				category: packet.category
					? i18n.t(`commands:tournament.categories.${packet.category}`, { lng })
					: i18n.t("commands:tournament.notRegistered", { lng }),
				totalGloryPoints: DisplayUtils.formatNumber(packet.totalGloryPoints ?? 0, lng),
				lateRegistration: packet.lateRegistration ? i18n.t("commands:tournament.lateRegistration", { lng }) : "",
				server: interaction.guild?.name ?? packet.discordGuildId,
				channel: `<#${packet.discordChannelId}>`,
				tournamentId: packet.tournamentId,
				status: i18n.t(`commands:tournament.statuses.${packet.status}`, { lng }),
				registrationEndsAt: finishInTimeDisplay(new Date(packet.registrationEndsAt)),
				combatEndsAt: finishInTimeDisplay(new Date(packet.combatEndsAt)),
				levelRule: getTournamentLevelRuleDescription(packet.levelLimitMode, packet.levelCap, lng),
				participantCount: packet.participantCount,
				level50Count: packet.categoryCounts.level50,
				level100Count: packet.categoryCounts.level100,
				rank: packet.rank ?? i18n.t("commands:tournament.unranked", { lng }),
				reward: getTournamentRewardDescription(packet, lng)
			}));
	});
}

export function handleTournamentResume(context: PacketContext, packet: CommandTournamentResumePacketRes): Promise<void> {
	return editTournamentMenuReply(context, "commands:tournament.resumeTitle", interaction => i18n.t("commands:tournament.resumed", {
		lng: interaction.userLanguage,
		tournamentId: packet.tournamentId,
		channel: `<#${packet.channelId}>`
	}));
}

export function handleTournamentCancel(context: PacketContext, packet: CommandTournamentCancelPacketRes): Promise<void> {
	return editTournamentMenuReply(context, "commands:tournament.cancelTitle", interaction => i18n.t("commands:tournament.cancelled", {
		lng: interaction.userLanguage,
		tournamentId: packet.tournamentId
	}));
}

export async function handleTournamentTop(context: PacketContext, packet: CommandTournamentTopPacketRes): Promise<void> {
	const interaction = getInteraction(context);
	if (!interaction) {
		return;
	}
	const lng: Language = interaction.userLanguage;
	const pageCache = new Map<number, CommandTournamentTopPacketRes["categories"]>();
	pageCache.set(packet.pageNumber - 1, packet.categories);
	const buildPageDescription = async (categories: CommandTournamentTopPacketRes["categories"]): Promise<string> => {
		const categoryDescriptions = await Promise.all(categories.map(async category => {
			const entries = await Promise.all(category.elements.map(async element => ({
				...element,
				username: await resolveKeycloakPlayerName(element.playerKeycloakId, lng)
			})));
			const lines = entries.map(element => i18n.t("commands:tournament.topEntry", {
				lng,
				rank: element.rank,
				pseudo: escapeUsername(element.username),
				totalGloryPoints: DisplayUtils.formatNumber(element.totalGloryPoints, lng),
				effectiveLevel: element.effectiveLevel
			}));
			return i18n.t("commands:tournament.topCategory", {
				lng,
				category: i18n.t(`commands:tournament.categories.${category.category}`, { lng }),
				totalParticipants: category.totalParticipants,
				yourRank: category.yourRank ?? i18n.t("commands:tournament.unranked", { lng }),
				entries: lines.join("\n") || i18n.t("commands:tournament.emptyCategory", { lng })
			});
		}));
		return StringUtils.joinParagraphs(categoryDescriptions);
	};
	const requestPage = async (page: number): Promise<CommandTournamentTopPacketRes["categories"]> => {
		const cachedPage = pageCache.get(page);
		if (cachedPage) {
			return cachedPage;
		}
		return await new Promise(resolve => {
			DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
				context,
				makePacket(CommandTopPacketReq, {
					dataType: TopDataType.GLORY,
					timing: TopTiming.ALL_TIME,
					page: page + 1
				}),
				(_responseContext, packetName, responsePacket) => {
					const categories = packetName === CommandTournamentTopPacketRes.name
						? (responsePacket as CommandTournamentTopPacketRes).categories
						: [];
					pageCache.set(page, categories);
					resolve(categories);
				}
			).catch((error: unknown) => {
				CrowniclesLogger.errorWithObj("Failed to request a tournament top page", error);
				resolve([]);
			});
		});
	};
	await new CrowniclesPaginatedEmbed({
		lng,
		pagesCount: packet.totalPages,
		selectedPageIndex: packet.pageNumber - 1,
		titleBuilder: (pageIndex: number): string => i18n.t("commands:tournament.topTitle", {
			lng,
			pageNumber: pageIndex + 1,
			totalPages: packet.totalPages
		}),
		pageBuilder: async (pageIndex: number): Promise<string> => buildPageDescription(await requestPage(pageIndex))
	}).send(interaction);
}

export function handleTournamentError(context: PacketContext, packet: CommandTournamentErrorPacketRes): Promise<void> {
	const interaction = getInteraction(context);
	if (!interaction) {
		return Promise.resolve();
	}
	const buildErrorContent = (): {
		title: string;
		description: string;
	} => ({
		title: i18n.t("commands:tournament.errorTitle", { lng: interaction.userLanguage }),
		description: i18n.t(`commands:tournament.errors.${packet.errorCode}`, { lng: interaction.userLanguage })
	});
	if (interaction.isComponentsV2()) {
		return editTournamentMenuReply(context, "commands:tournament.errorTitle", () => buildErrorContent().description);
	}
	const errorContent = buildErrorContent();
	return editTournamentReply(context, _currentInteraction => new CrowniclesEmbed()
		.setErrorColor()
		.setTitle(errorContent.title)
		.setDescription(errorContent.description));
}

export async function handleTournamentFightReward(context: PacketContext, packet: TournamentFightRewardPacket): Promise<void> {
	const interaction = getInteraction(context);
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;
	const player1 = await resolveKeycloakPlayerName(packet.player1.keycloakId, lng);
	const player2 = await resolveKeycloakPlayerName(packet.player2.keycloakId, lng);
	const getChange = (oldValue: number, newValue: number): number => newValue - oldValue;
	await interaction.channel?.send({
		embeds: [
			new CrowniclesEmbed()
				.setTitle(i18n.t("commands:tournament.fightReward.title", { lng }))
				.setDescription(i18n.t(packet.draw
					? "commands:tournament.fightReward.draw"
					: "commands:tournament.fightReward.result", {
					lng,
					player1: escapeUsername(player1),
					player2: escapeUsername(player2),
					winner: packet.winnerKeycloakId === packet.player1.keycloakId ? escapeUsername(player1) : escapeUsername(player2),
					player1GloryChange: getChange(packet.player1.oldTotalGloryPoints, packet.player1.newTotalGloryPoints),
					player2GloryChange: getChange(packet.player2.oldTotalGloryPoints, packet.player2.newTotalGloryPoints)
				}))
		]
	});
}
