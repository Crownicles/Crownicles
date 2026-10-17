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
import { escapeUsername } from "../../utils/StringUtils";
import { Language } from "../../../../Lib/src/Language";
import { dateDisplay } from "../../../../Lib/src/utils/TimeUtils";
import { DisplayUtils } from "../../utils/DisplayUtils";
import { handleClassicError } from "../../utils/ErrorUtils";
import { EloGameResult } from "../../../../Lib/src/types/EloGameResult";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";
import { CrowniclesPaginatedEmbed } from "../../messages/CrowniclesPaginatedEmbed";

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
	let desc = "";

	for (let i = end - 1; i >= start; i--) {
		const fight = history[i];
		const line = "kingGuard" in fight
			? buildKingGuardFightHistoryLine(fight, lng)
			: await buildPlayerFightHistoryLine(fight, lng);
		desc += `${line}\n\n`;
	}

	return desc;
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
		selectedPageIndex: pages.length - 1
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
