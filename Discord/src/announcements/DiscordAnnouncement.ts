import {
	crowniclesClient, discordConfig, keycloakConfig
} from "../bot/CrowniclesShard";
import { TextChannel } from "discord.js";
import i18n from "../translations/i18n";
import { TopWeekAnnouncementPacket } from "../../../Lib/src/packets/announcements/TopWeekAnnouncementPacket";
import { LANGUAGE } from "../../../Lib/src/Language";
import { KeycloakUtils } from "../../../Lib/src/keycloak/KeycloakUtils";
import { TopWeekFightAnnouncementPacket } from "../../../Lib/src/packets/announcements/TopWeekFightAnnouncementPacket";
import { ChristmasBonusAnnouncementPacket } from "../../../Lib/src/packets/announcements/ChristmasBonusAnnouncementPacket";
import { ReleaseGiftAnnouncementPacket } from "../../../Lib/src/packets/announcements/ReleaseGiftAnnouncementPacket";
import { ReleaseGiftConstants } from "../../../Lib/src/constants/ReleaseGiftConstants";
import { BlessingAnnouncementPacket } from "../../../Lib/src/packets/announcements/BlessingAnnouncementPacket";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";
import { escapeUsername } from "../utils/StringUtils";
import { resolveKeycloakPlayerName } from "../utils/KeycloakPlayerUtils";

/**
 * A message ready to be sent in both the French and English announcement channels
 */
type BilingualMessage = {
	fr: string;
	en: string;
};

/**
 * Describes how to announce the winner (or absence of winner) of a competition
 */
type WinnerAnnouncement = {
	winnerKeycloakId?: string;
	winnerTranslationKey: string;
	noWinnerTranslationKey: string;
	errorLogContext: string;
};

export abstract class DiscordAnnouncement {
	/**
	 * Build the same translation key in both announcement languages
	 */
	private static buildBilingualMessage(translationKey: string, params: Record<string, unknown> = {}): BilingualMessage {
		return {
			fr: i18n.t(translationKey, {
				lng: LANGUAGE.FRENCH,
				...params
			}),
			en: i18n.t(translationKey, {
				lng: LANGUAGE.ENGLISH,
				...params
			})
		};
	}

	private static async sendBilingualMessage(message: BilingualMessage, reactEmoji?: string): Promise<void> {
		try {
			const frenchChannel = await crowniclesClient!.channels.fetch(discordConfig.FRENCH_ANNOUNCEMENT_CHANNEL_ID);
			const frenchMsg = await (frenchChannel as TextChannel).send({ content: message.fr });
			if (reactEmoji) {
				await frenchMsg.react(reactEmoji);
			}
		}
		catch (e) {
			CrowniclesLogger.errorWithObj("Error while sending announcement in french channel", e);
		}
		try {
			const englishChannel = await crowniclesClient!.channels.fetch(discordConfig.ENGLISH_ANNOUNCEMENT_CHANNEL_ID);
			const englishMsg = await (englishChannel as TextChannel).send({ content: message.en });
			if (reactEmoji) {
				await englishMsg.react(reactEmoji);
			}
		}
		catch (e) {
			CrowniclesLogger.errorWithObj("Error while sending announcement in english channel", e);
		}
	}

	/**
	 * Resolve a winner keycloak ID into a mention/name and announce with a trophy reaction
	 */
	private static async resolveWinnerAndAnnounce(announcement: WinnerAnnouncement): Promise<void> {
		if (announcement.winnerKeycloakId) {
			const winner = await KeycloakUtils.getUserByKeycloakId(keycloakConfig, announcement.winnerKeycloakId);
			if (!winner.isError) {
				const mention = winner.payload.user.attributes.discordId ? `<@${winner.payload.user.attributes.discordId[0]}>` : escapeUsername(winner.payload.user.attributes.gameUsername[0]);
				await this.sendBilingualMessage(this.buildBilingualMessage(announcement.winnerTranslationKey, { mention }), CrowniclesIcons.announcements.trophy);
				return;
			}
			CrowniclesLogger.error(`Failed to announce ${announcement.errorLogContext}: winner with keycloak id ${announcement.winnerKeycloakId} not found`);
		}
		await this.sendBilingualMessage(this.buildBilingualMessage(announcement.noWinnerTranslationKey), CrowniclesIcons.announcements.trophy);
	}

	static async canAnnounce(): Promise<boolean> {
		const guild = await crowniclesClient!.guilds.fetch(discordConfig.MAIN_SERVER_ID);
		return Boolean(guild.shard);
	}

	static async announceTopWeek(topWeekAnnouncementPacket: TopWeekAnnouncementPacket): Promise<void> {
		CrowniclesLogger.info("Announcing top week...");
		await this.resolveWinnerAndAnnounce({
			winnerKeycloakId: topWeekAnnouncementPacket.winnerKeycloakId,
			winnerTranslationKey: "bot:topWeekAnnouncement",
			noWinnerTranslationKey: "bot:topWeekAnnouncementNoWinner",
			errorLogContext: "top week"
		});
	}

	static async announceTopWeekFight(topWeekFightAnnouncementPacket: TopWeekFightAnnouncementPacket): Promise<void> {
		CrowniclesLogger.info("Announcing fight top week...");
		await this.resolveWinnerAndAnnounce({
			winnerKeycloakId: topWeekFightAnnouncementPacket.winnerKeycloakId,
			winnerTranslationKey: "bot:seasonEndAnnouncement",
			noWinnerTranslationKey: "bot:seasonEndAnnouncementNoWinner",
			errorLogContext: "top week fight"
		});
	}

	static async announceChristmasBonus(packet: ChristmasBonusAnnouncementPacket): Promise<void> {
		CrowniclesLogger.info(`Announcing Christmas bonus (preAnnouncement: ${packet.isPreAnnouncement})...`);
		const translationKey = packet.isPreAnnouncement ? "bot:christmasBonusPreAnnouncement" : "bot:christmasBonusApplied";
		await this.sendBilingualMessage(this.buildBilingualMessage(translationKey));
	}

	static async announceReleaseGift(_packet: ReleaseGiftAnnouncementPacket): Promise<void> {
		CrowniclesLogger.info("Announcing the 6.0.0 release gift...");
		await this.sendBilingualMessage(this.buildBilingualMessage("bot:releaseGiftApplied", { money: ReleaseGiftConstants.MONEY }));
	}

	static async announceBlessing(packet: BlessingAnnouncementPacket): Promise<void> {
		CrowniclesLogger.info(`Announcing blessing type ${packet.blessingType}...`);

		const playerName = await resolveKeycloakPlayerName(packet.triggeredByKeycloakId, LANGUAGE.FRENCH);

		// Resolve top contributor name
		let topContributorName = "";
		if (packet.topContributorKeycloakId && packet.topContributorKeycloakId !== packet.triggeredByKeycloakId) {
			topContributorName = await resolveKeycloakPlayerName(packet.topContributorKeycloakId, LANGUAGE.FRENCH);
		}
		else if (packet.topContributorKeycloakId) {
			topContributorName = playerName;
		}

		const messageFr = i18n.t("bot:blessingAnnouncement", {
			lng: LANGUAGE.FRENCH,
			playerName,
			blessingName: i18n.t(`bot:blessingNames.${packet.blessingType}`, { lng: LANGUAGE.FRENCH }),
			blessingEffect: i18n.t(`bot:blessingEffects.${packet.blessingType}`, { lng: LANGUAGE.FRENCH }),
			durationHours: packet.durationHours,
			topContributorName,
			topContributorAmount: packet.topContributorAmount,
			totalContributors: packet.totalContributors,
			count: packet.totalContributors
		});
		const messageEn = i18n.t("bot:blessingAnnouncement", {
			lng: LANGUAGE.ENGLISH,
			playerName,
			blessingName: i18n.t(`bot:blessingNames.${packet.blessingType}`, { lng: LANGUAGE.ENGLISH }),
			blessingEffect: i18n.t(`bot:blessingEffects.${packet.blessingType}`, { lng: LANGUAGE.ENGLISH }),
			durationHours: packet.durationHours,
			topContributorName,
			topContributorAmount: packet.topContributorAmount,
			totalContributors: packet.totalContributors,
			count: packet.totalContributors
		});
		await this.sendBilingualMessage({
			fr: messageFr,
			en: messageEn
		}, CrowniclesIcons.announcements.blessing);
	}
}
