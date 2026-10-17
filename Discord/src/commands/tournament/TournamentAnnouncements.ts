import {
	TournamentAnnouncementEvents, TournamentChannelAnnouncementPacket
} from "../../../../Lib/src/packets/notifications/TournamentChannelAnnouncementPacket";
import {
	CommandTournamentCreatePacketRes
} from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import { Language } from "../../../../Lib/src/Language";
import { TournamentCancellationReasons } from "../../../../Lib/src/types/Tournament";
import { dateDisplay } from "../../../../Lib/src/utils/TimeUtils";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import { DisplayUtils } from "../../utils/DisplayUtils";
import { sendInGuildChannelFromAnyShard } from "../../utils/ShardChannelUtils";
import i18n from "../../translations/i18n";
import {
	getTournamentCategoryLabel, getTournamentLevelRuleDescription, getTournamentThresholdsSummary
} from "./TournamentDisplayUtils";

function buildAnnouncementEmbed(description: string, lng: Language): CrowniclesEmbed {
	return new CrowniclesEmbed()
		.setTitle(i18n.t("commands:tournament.announcement.title", { lng }))
		.setDescription(description);
}

async function sendInInteractionChannel(interaction: CrowniclesInteraction, embed: CrowniclesEmbed): Promise<void> {
	await interaction.channel.send({ embeds: [embed] })
		.catch((error: unknown) => CrowniclesLogger.errorWithObj("Failed to post a tournament announcement", error));
}

export function announceTournamentCreation(interaction: CrowniclesInteraction, packet: CommandTournamentCreatePacketRes): Promise<void> {
	const lng = interaction.userLanguage;
	const levelSettings = {
		levelLimitMode: packet.levelLimitMode,
		levelCap: packet.levelCap
	};
	return sendInInteractionChannel(interaction, buildAnnouncementEmbed(i18n.t("commands:tournament.announcement.created", {
		lng,
		registrationEndsAt: dateDisplay(new Date(packet.registrationEndsAt)),
		combatEndsAt: dateDisplay(new Date(packet.combatEndsAt)),
		levelRule: getTournamentLevelRuleDescription(levelSettings, lng),
		thresholds: getTournamentThresholdsSummary(levelSettings, lng)
	}), lng));
}

export function announceTournamentResume(interaction: CrowniclesInteraction): Promise<void> {
	const lng = interaction.userLanguage;
	return sendInInteractionChannel(interaction, buildAnnouncementEmbed(i18n.t("commands:tournament.announcement.resumed", { lng }), lng));
}

async function getWinnersDescription(packet: TournamentChannelAnnouncementPacket): Promise<string> {
	const lng = packet.language;
	if (!packet.winners || packet.winners.length === 0) {
		return i18n.t("commands:tournament.announcement.noWinner", { lng });
	}
	const lines = await Promise.all(packet.winners.map(async winner => i18n.t("commands:tournament.announcement.winnerLine", {
		lng,
		category: getTournamentCategoryLabel(winner.category, lng),
		winner: await DisplayUtils.getEscapedUsername(winner.keycloakId, lng)
	})));
	return lines.join("\n");
}

async function getAnnouncementDescription(packet: TournamentChannelAnnouncementPacket): Promise<string> {
	const lng = packet.language;
	switch (packet.event) {
		case TournamentAnnouncementEvents.STARTED:
			return i18n.t("commands:tournament.announcement.started", {
				lng,
				combatEndsAt: dateDisplay(new Date(packet.combatEndsAt))
			});
		case TournamentAnnouncementEvents.COMPLETED:
			return i18n.t("commands:tournament.announcement.completed", {
				lng,
				winners: await getWinnersDescription(packet)
			});
		default:
			return i18n.t(`commands:tournament.announcement.cancelled.${packet.cancellationReason ?? TournamentCancellationReasons.MANUAL}`, { lng });
	}
}

/**
 * Post an announcement from the notifications consumer: the shard owning the tournament guild is the only one able to send it
 * @param packet
 */
export async function postTournamentChannelAnnouncement(packet: TournamentChannelAnnouncementPacket): Promise<void> {
	const embed = buildAnnouncementEmbed(await getAnnouncementDescription(packet), packet.language);
	if (!await sendInGuildChannelFromAnyShard(packet.discordChannelId, { embeds: [embed.toJSON()] })) {
		CrowniclesLogger.warn(`Tournament announcement could not be posted in channel ${packet.discordChannelId}`);
	}
}
