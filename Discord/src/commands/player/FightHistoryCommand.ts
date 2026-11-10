import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	CommandFightHistoryPacketReq,
	CommandFightHistoryPacketRes,
	FightHistoryItem,
	KingGuardFightHistoryItem,
	PlayerFightHistoryItem
} from "../../../../Lib/src/packets/commands/CommandFightHistoryPacket";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../bot/DiscordCache";
import i18n from "../../translations/i18n";
import {
	escapeUsername, StringUtils
} from "../../utils/StringUtils";
import { Language } from "../../../../Lib/src/Language";
import { dateDisplay } from "../../../../Lib/src/utils/TimeUtils";
import { DisplayUtils } from "../../utils/DisplayUtils";
import { handleClassicError } from "../../utils/ErrorUtils";
import { EloGameResult } from "../../../../Lib/src/types/EloGameResult";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";
import { CrowniclesPaginatedEmbed } from "../../messages/CrowniclesPaginatedEmbed";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import {
	KingGuardChallengerRecord, KingGuardFightStats
} from "../../../../Lib/src/types/KingGuardFightStats";
import { KingGuardUtils } from "../../utils/KingGuardUtils";

/**
 * Get the league change string
 * @param lng
 * @param leagueChange
 */
function getLeagueChange(
	lng: Language,
	leagueChange?: {
		oldLeague: number;
		newLeague: number;
	}
): string {
	if (!leagueChange) {
		return "";
	}

	return i18n.t(leagueChange.oldLeague < leagueChange.newLeague
		? "commands:fightHistory.leagueChanges.up"
		: "commands:fightHistory.leagueChanges.down", {
		lng,
		oldLeagueId: leagueChange.oldLeague,
		newLeagueId: leagueChange.newLeague
	});
}

/**
 * Get the sentence describing the result of a fight
 * @param result
 * @param lng
 */
function getResultSentence(result: EloGameResult, lng: Language): string {
	return i18n.t(result === EloGameResult.LOSS
		? "commands:fightHistory.resultSentence.lost"
		: result === EloGameResult.WIN
			? "commands:fightHistory.resultSentence.won"
			: "commands:fightHistory.resultSentence.draw", {
		lng
	});
}

/**
 * Build the history line of a fight against another player
 * @param fight
 * @param lng
 */
async function buildPlayerFightHistoryLine(fight: PlayerFightHistoryItem, lng: Language): Promise<string> {
	const isViewerInitiator = fight.initiator;
	const attackSentence = i18n.t(isViewerInitiator ? "commands:fightHistory.attackSentence.attacker" : "commands:fightHistory.attackSentence.defender", {
		opponentClassId: fight.classes.opponent,
		opponent: await DisplayUtils.getEscapedUsername(fight.opponentKeycloakId, lng),
		lng
	});
	const leagueChange = isViewerInitiator ? fight.glory.leaguesChanges.me : fight.glory.leaguesChanges.opponent;
	return i18n.t("commands:fightHistory.historyLine", {
		lng,
		date: dateDisplay(new Date(fight.date)),
		attackSentence,
		resultSentence: getResultSentence(fight.result, lng),
		meInitialGlory: fight.glory.initial.me,
		meFinalGlory: fight.glory.initial.me + fight.glory.change.me,
		opponentInitialGlory: fight.glory.initial.opponent,
		opponentFinalGlory: fight.glory.initial.opponent + fight.glory.change.opponent,
		meLeagueChange: getLeagueChange(lng, leagueChange)
	});
}

/**
 * Build the history line of a fight against a king guard
 * @param fight
 * @param lng
 */
function buildKingGuardFightHistoryLine(fight: KingGuardFightHistoryItem, lng: Language): string {
	return i18n.t("commands:fightHistory.kingGuardHistoryLine", {
		lng,
		date: dateDisplay(new Date(fight.date)),

		// The guards generated on the fly before the library had no name
		guard: fight.kingGuard.id === undefined
			? i18n.t("commands:fight.kingGuard.unnamed", { lng })
			: KingGuardUtils.getDisplayName(fight.kingGuard.id, lng),
		guardLevel: fight.kingGuard.level,
		guardClassId: fight.classes.opponent,
		resultSentence: getResultSentence(fight.result, lng)
	});
}

/**
 * Build the fight history description from start to end indexes
 * @param history - The fight history
 * @param start - The start index
 * @param end - The end index
 * @param lng - The language
 */
export async function buildPacketHistoryDescription(history: FightHistoryItem[], start: number, end: number, lng: Language): Promise<string> {
	const lines: string[] = [];

	for (let i = end - 1; i >= start; i--) {
		const fight = history[i];
		lines.push("kingGuard" in fight
			? buildKingGuardFightHistoryLine(fight, lng)
			: await buildPlayerFightHistoryLine(fight, lng));
	}

	return StringUtils.joinParagraphs(lines);
}

/**
 * Get the lines of the best king guard beaten by the player: who it is, how far above the level of the player it is, and the rank of the player
 * @param stats
 * @param lng
 */
function getKingGuardRecordLines(stats: KingGuardFightStats, lng: Language): string[] {
	if (!stats.record) {
		return [i18n.t("commands:fightHistory.kingGuardStats.noRecord", { lng })];
	}
	const guard = stats.record.guard;
	const levelsAbovePlayer = guard.level - stats.playerLevel;
	return [
		i18n.t("commands:fightHistory.kingGuardStats.record", {
			lng,
			guard: KingGuardUtils.getDisplayName(guard.id, lng),
			classId: guard.classId,
			level: guard.level,
			aboveLevel: levelsAbovePlayer > 0
				? i18n.t("commands:fightHistory.kingGuardStats.aboveLevel", {
					lng,
					count: levelsAbovePlayer
				})
				: ""
		}),
		i18n.t("commands:fightHistory.kingGuardStats.recordHint", { lng }),
		i18n.t("commands:fightHistory.kingGuardStats.progress", {
			lng,
			rank: stats.record.rank,
			challengers: stats.record.challengers
		})
	];
}

/**
 * Get the line of a player of the king guards leaderboard
 * @param challenger
 * @param rank
 * @param viewerKeycloakId
 * @param lng
 */
async function getLeaderboardLine(challenger: KingGuardChallengerRecord, rank: number, viewerKeycloakId: string, lng: Language): Promise<string> {
	const isViewer = challenger.keycloakId === viewerKeycloakId;
	return i18n.t("commands:fightHistory.kingGuardStats.leaderboardLine", {
		lng,
		badge: DisplayUtils.getRankMedalBadge(rank) ?? (isViewer ? CrowniclesIcons.top.badges.self : CrowniclesIcons.top.badges.default),
		rank,
		name: isViewer
			? i18n.t("commands:fightHistory.kingGuardStats.you", { lng })
			: await DisplayUtils.getEscapedUsername(challenger.keycloakId, lng),
		guard: KingGuardUtils.getDisplayName(challenger.guard.id, lng),
		level: challenger.guard.level
	});
}

/**
 * Get the leaderboard of the players who beat the best king guards, followed by the viewer if it is not part of it
 * @param stats
 * @param viewerKeycloakId
 * @param lng
 */
async function getKingGuardLeaderboard(stats: KingGuardFightStats, viewerKeycloakId: string, lng: Language): Promise<string | undefined> {
	if (stats.leaderboard.length === 0) {
		return undefined;
	}
	const lines = await Promise.all(stats.leaderboard.map((challenger, index) => getLeaderboardLine(challenger, index + 1, viewerKeycloakId, lng)));

	// The ranking and the leaderboard are read separately: the player is looked for by id, so that it is never listed twice
	if (stats.record && !stats.leaderboard.some(challenger => challenger.keycloakId === viewerKeycloakId)) {
		lines.push(await getLeaderboardLine({
			keycloakId: viewerKeycloakId,
			guard: stats.record.guard
		}, stats.record.rank, viewerKeycloakId, lng));
	}
	return StringUtils.joinLines([i18n.t("commands:fightHistory.kingGuardStats.leaderboardTitle", { lng }), ...lines]);
}

/**
 * Build the page summing up the fights of the player against the king guards
 * @param stats
 * @param viewerKeycloakId
 * @param lng
 */
export async function buildKingGuardStatsDescription(stats: KingGuardFightStats, viewerKeycloakId: string, lng: Language): Promise<string> {
	return StringUtils.joinParagraphs([
		StringUtils.joinLines([
			...getKingGuardRecordLines(stats, lng),
			i18n.t("commands:fightHistory.kingGuardStats.tally", {
				lng,
				won: stats.won,
				lost: stats.lost,
				draw: stats.draw
			})
		]),
		await getKingGuardLeaderboard(stats, viewerKeycloakId, lng)
	]);
}

/**
 * Get the fight history pages
 * @param packet
 * @param lng
 */
async function getFightHistoryPages(packet: CommandFightHistoryPacketRes, lng: Language): Promise<string[]> {
	const pagesCount = Math.ceil(packet.history.length / FightConstants.HISTORY_DISPLAY_LIMIT);

	const descriptions: string[] = [];
	for (let i = 0; i < pagesCount; i++) {
		const start = i * FightConstants.HISTORY_DISPLAY_LIMIT;
		const end = Math.min(start + FightConstants.HISTORY_DISPLAY_LIMIT, packet.history.length);
		const pageDescription = await buildPacketHistoryDescription(packet.history, start, end, lng);
		descriptions.push(pageDescription);
	}
	return descriptions.reverse();
}

/**
 * Handle the fight history response
 * @param packet
 * @param context
 */
export async function handlePacketHistoryRes(packet: CommandFightHistoryPacketRes, context: PacketContext): Promise<void> {
	if (packet.history.length === 0) {
		await handleClassicError(context, i18n.t("commands:fightHistory.noHistory", { lng: context.discord!.language }));
		return;
	}

	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return;
	}

	const lng = interaction.userLanguage;
	const viewerKeycloakId = context.keycloakId;
	if (!viewerKeycloakId) {
		return;
	}

	const pages = await getFightHistoryPages(packet, lng);

	await new CrowniclesPaginatedEmbed({
		lng,
		pages,
		selectedPageIndex: pages.length - 1,
		...packet.kingGuardStats
			? {
				extraPage: {
					title: i18n.t("commands:fightHistory.kingGuardStats.title", { lng }),
					content: await buildKingGuardStatsDescription(packet.kingGuardStats, viewerKeycloakId, lng),
					openButton: {
						label: i18n.t("commands:fightHistory.kingGuardStats.openButton", { lng }),
						emoji: CrowniclesIcons.fightCommand.crossedSwords
					},
					backButton: {
						label: i18n.t("commands:fightHistory.kingGuardStats.backButton", { lng }),
						emoji: CrowniclesIcons.collectors.previousPage
					}
				}
			}
			: {}
	}).formatAuthor(i18n.t("commands:fightHistory.title", {
		lng, pseudo: escapeUsername(interaction.user.displayName)
	}), interaction.user)
		.send(interaction);
}

/**
 * Get the packet for the fight history command
 * @param interaction
 * @param _user
 */
async function getPacket(interaction: CrowniclesInteraction, _user: KeycloakUser): Promise<CommandFightHistoryPacketReq> {
	await interaction.deferReply();
	return makePacket(CommandFightHistoryPacketReq, {});
}

/**
 * Command info
 */
export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("fightHistory"),
	getPacket,
	mainGuildCommand: false
};
