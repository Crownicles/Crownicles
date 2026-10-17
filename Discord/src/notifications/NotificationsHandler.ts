import { NotificationsSerializedPacket } from "../../../Lib/src/packets/notifications/NotificationsSerializedPacket";
import {
	AttachmentBuilder, User
} from "discord.js";
import { sendInGuildChannelFromAnyShard } from "../utils/ShardChannelUtils";
import { CrowniclesEmbed } from "../messages/CrowniclesEmbed";
import i18n from "../translations/i18n";
import { Language } from "../../../Lib/src/Language";
import { NotificationSendTypeEnum } from "./NotificationSendType";
import {
	crowniclesClient, keycloakConfig
} from "../bot/CrowniclesShard";
import { getMention } from "../../../Lib/src/utils/StringUtils";
import {
	NotificationsTypes, NotificationType
} from "./NotificationType";
import NotificationsConfiguration, { NotificationsConfigurations } from "../database/discord/models/NotificationsConfiguration";
import { ReachDestinationNotificationPacket } from "../../../Lib/src/packets/notifications/ReachDestinationNotificationPacket";
import { KeycloakUtils } from "../../../Lib/src/keycloak/KeycloakUtils";
import { DisplayUtils } from "../utils/DisplayUtils";
import { GuildDailyNotificationPacket } from "../../../Lib/src/packets/notifications/GuildDailyNotificationPacket";
import { getCommandGuildDailyRewardPacketString } from "../commands/guild/GuildDailyCommand";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";
import { PlayerFreedFromJailNotificationPacket } from "../../../Lib/src/packets/notifications/PlayerFreedFromJailNotificationPacket";
import { PlayerWasAttackedNotificationPacket } from "../../../Lib/src/packets/notifications/PlayerWasAttackedNotificationPacket";
import { GuildKickNotificationPacket } from "../../../Lib/src/packets/notifications/GuildKickNotificationPacket";
import { GuildStatusChangeNotificationPacket } from "../../../Lib/src/packets/notifications/GuildStatusChangeNotificationPacket";
import { EnergyFullNotificationPacket } from "../../../Lib/src/packets/notifications/EnergyFullNotificationPacket";
import { DailyBonusNotificationPacket } from "../../../Lib/src/packets/notifications/DailyBonusNotificationPacket";
import { ExpeditionFinishedNotificationPacket } from "../../../Lib/src/packets/notifications/ExpeditionFinishedNotificationPacket";
import { GDPRExportCompleteNotificationPacket } from "../../../Lib/src/packets/notifications/GDPRExportCompleteNotificationPacket";
import { SexTypeShort } from "../../../Lib/src/constants/StringConstants";
import { ZipArchive } from "archiver";
import { DiscordConstants } from "../DiscordConstants";
import { TournamentNotificationPacket } from "../../../Lib/src/packets/notifications/TournamentNotificationPacket";
import { TournamentDefenseNotificationPacket } from "../../../Lib/src/packets/notifications/TournamentDefenseNotificationPacket";
import { TournamentChannelAnnouncementPacket } from "../../../Lib/src/packets/notifications/TournamentChannelAnnouncementPacket";
import { NotificationPacket } from "../../../Lib/src/packets/notifications/NotificationPacket";
import { postTournamentChannelAnnouncement } from "../commands/tournament/TournamentAnnouncements";
import {
	getTournamentDefenseNotificationContent, getTournamentNotificationContent
} from "../commands/tournament/TournamentNotificationContents";

/**
 * Create a ZIP buffer from CSV files
 */
async function createGDPRZipBuffer(csvFiles: Record<string, string>): Promise<Buffer> {
	const archive = new ZipArchive({ zlib: { level: DiscordConstants.GDPR_EXPORT.ZIP_COMPRESSION_LEVEL } });
	const chunks: Buffer[] = [];

	archive.on("data", (chunk: Buffer) => chunks.push(chunk));

	const archivePromise = new Promise<Buffer>((resolve, reject) => {
		archive.on("end", () => resolve(Buffer.concat(chunks)));
		archive.on("error", reject);
	});

	for (const [filename, content] of Object.entries(csvFiles)) {
		archive.append(content, { name: filename });
	}

	await archive.finalize();

	const zipBuffer = await archivePromise;
	const fileSizeMB = zipBuffer.length / DiscordConstants.GDPR_EXPORT.BYTES_PER_MB;
	const maxFileSizeMB = DiscordConstants.GDPR_EXPORT.MAX_FILE_SIZE_MB;

	if (fileSizeMB > maxFileSizeMB) {
		throw new Error(`Export too large (${fileSizeMB.toFixed(1)} MB > ${maxFileSizeMB} MB limit)`);
	}

	return zipBuffer;
}

/**
 * Send a GDPR error embed to a user
 */
async function sendGDPRErrorEmbed(user: User, lng: Language, errorMessage: string): Promise<void> {
	const errorEmbed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("notifications:gdprExport.title", { lng }), user)
		.setDescription(i18n.t("notifications:gdprExport.error", {
			lng,
			error: errorMessage
		}));

	await user.send({ embeds: [errorEmbed] }).catch(e => {
		CrowniclesLogger.errorWithObj(`Failed to send GDPR error DM to user ${user.id}`, e);
	});
}

type NotificationRendering = {
	content: string;
	type: NotificationType;
};

type NotificationRenderer = (packet: NotificationPacket, lng: Language) => NotificationRendering | Promise<NotificationRendering>;

function getGuildStatusChangeKey(packet: GuildStatusChangeNotificationPacket): string {
	if (packet.becomeChief) {
		return "becomeChief";
	}
	return packet.becomeElder ? "becomeElder" : "becomeMember";
}

function renderPetExpedition(packet: ExpeditionFinishedNotificationPacket, lng: Language): NotificationRendering {
	const petIcon = DisplayUtils.getPetIcon(packet.petId, packet.petSex as SexTypeShort);
	const petName = DisplayUtils.getPetNicknameOrTypeName(packet.petNickname ?? null, packet.petId, packet.petSex as SexTypeShort, lng);
	return {
		content: i18n.t("bot:notificationPetExpedition", {
			lng,
			petDisplay: `${petIcon} **${petName}**`
		}),
		type: NotificationsTypes.PET_EXPEDITION
	};
}

const NOTIFICATION_RENDERERS: Record<string, NotificationRenderer> = {
	[ReachDestinationNotificationPacket.name]: (packet, lng) => {
		const {
			mapType, mapId
		} = packet as ReachDestinationNotificationPacket;
		return {
			content: i18n.t("bot:notificationReachDestination", {
				lng,
				destination: DisplayUtils.getMapLocationDisplay(mapType, mapId, lng)
			}),
			type: NotificationsTypes.REPORT
		};
	},
	[DailyBonusNotificationPacket.name]: (_packet, lng) => ({
		content: i18n.t("bot:notificationDailyBonus", { lng }),
		type: NotificationsTypes.DAILY_BONUS
	}),
	[EnergyFullNotificationPacket.name]: (_packet, lng) => ({
		content: i18n.t("bot:notificationEnergyFull", { lng }),
		type: NotificationsTypes.ENERGY
	}),
	[GuildDailyNotificationPacket.name]: async (packet, lng) => {
		const {
			keycloakIdOfExecutor, reward
		} = packet as GuildDailyNotificationPacket;
		return {
			content: i18n.t("bot:notificationGuildDaily", {
				lng,
				pseudo: await DisplayUtils.getEscapedUsername(keycloakIdOfExecutor, lng),
				rewards: getCommandGuildDailyRewardPacketString(reward, lng)
			}),
			type: NotificationsTypes.GUILD_DAILY
		};
	},
	[GuildKickNotificationPacket.name]: async (packet, lng) => {
		const {
			keycloakIdOfExecutor, guildName
		} = packet as GuildKickNotificationPacket;
		return {
			content: i18n.t("bot:notificationGuildKick", {
				lng,
				pseudo: await DisplayUtils.getEscapedUsername(keycloakIdOfExecutor, lng),
				guildName
			}),
			type: NotificationsTypes.GUILD_KICK
		};
	},
	[GuildStatusChangeNotificationPacket.name]: (packet, lng) => {
		const statusChange = packet as GuildStatusChangeNotificationPacket;
		return {
			content: i18n.t(`bot:notificationGuildStatusChange.${getGuildStatusChangeKey(statusChange)}`, {
				lng,
				guildName: statusChange.guildName
			}),
			type: NotificationsTypes.GUILD_STATUS_CHANGE
		};
	},
	[PlayerFreedFromJailNotificationPacket.name]: async (packet, lng) => ({
		content: i18n.t("notifications:playerFreedFromJail.description", {
			lng,
			freedByPlayer: await DisplayUtils.getEscapedUsername((packet as PlayerFreedFromJailNotificationPacket).freedByPlayerKeycloakId, lng)
		}),
		type: NotificationsTypes.PLAYER_FREED_FROM_JAIL
	}),
	[PlayerWasAttackedNotificationPacket.name]: async (packet, lng) => ({
		content: i18n.t("notifications:fightChallenge.description", {
			lng,
			attackerPseudo: await DisplayUtils.getEscapedUsername((packet as PlayerWasAttackedNotificationPacket).attackedByPlayerKeycloakId, lng)
		}),
		type: NotificationsTypes.FIGHT_CHALLENGE
	}),
	[ExpeditionFinishedNotificationPacket.name]: (packet, lng) => renderPetExpedition(packet as ExpeditionFinishedNotificationPacket, lng),
	[TournamentNotificationPacket.name]: async (packet, lng) => ({
		content: await getTournamentNotificationContent(packet as TournamentNotificationPacket, lng),
		type: NotificationsTypes.TOURNAMENT
	}),
	[TournamentDefenseNotificationPacket.name]: async (packet, lng) => ({
		content: await getTournamentDefenseNotificationContent(packet as TournamentDefenseNotificationPacket, lng),
		type: NotificationsTypes.TOURNAMENT
	})
};

type NotificationRecipient = {
	discordId: string;
	lng: Language;
};

async function getNotificationRecipient(keycloakId: string): Promise<NotificationRecipient> {
	const getUser = await KeycloakUtils.getUserByKeycloakId(keycloakConfig, keycloakId);
	const missingRecipientError = `Keycloak user with id ${keycloakId} not found or missing discordId`;
	if (getUser.isError) {
		throw missingRecipientError;
	}
	const discordId = getUser.payload.user.attributes.discordId?.[0];
	if (!discordId || discordId === "0") {
		throw missingRecipientError;
	}
	return {
		discordId,
		lng: getUser.payload.user.attributes.language[0] as Language
	};
}

export abstract class NotificationsHandler {
	/**
	 * This function is called to send a batch of notifications
	 * @param notificationSerializedPacket
	 */
	static sendNotifications(notificationSerializedPacket: NotificationsSerializedPacket): void {
		for (const notification of notificationSerializedPacket.notifications) {
			const processing = notification.type === TournamentChannelAnnouncementPacket.name
				? postTournamentChannelAnnouncement(notification.packet as TournamentChannelAnnouncementPacket)
				: this._processSingleNotification({
					type: notification.type,
					packet: notification.packet as NotificationPacket
				});
			processing.catch(error => {
				CrowniclesLogger.error(`Failed to process notification: ${error}`);
			});
		}
	}

	private static async _processSingleNotification(notification: {
		type: string;
		packet: NotificationPacket;
	}): Promise<void> {
		const keycloakId = notification.packet.keycloakId;

		const {
			discordId, lng
		} = await getNotificationRecipient(keycloakId);

		if (notification.type === GDPRExportCompleteNotificationPacket.name) {
			// GDPR export is handled separately - send DM directly with ZIP attachment
			const gdprDiscordUser = await crowniclesClient.users.fetch(discordId);
			await NotificationsHandler.handleGDPRExportComplete(gdprDiscordUser, notification.packet as GDPRExportCompleteNotificationPacket, lng);
			return;
		}

		const renderNotification = NOTIFICATION_RENDERERS[notification.type];
		if (!renderNotification) {
			throw `Unknown notification type: ${notification.type}`;
		}
		const rendering = await renderNotification(notification.packet, lng);

		const discordUser = await crowniclesClient.users.fetch(discordId);
		await NotificationsHandler.sendNotification(
			discordUser,
			await NotificationsConfigurations.getOrRegister(discordId),
			rendering.type,
			i18n.t(rendering.content, { lng }),
			lng
		);
	}

	/**
	 * This function is called to send a notification to a user
	 * @param user
	 * @param notificationConfiguration
	 * @param notificationType
	 * @param content
	 * @param lng
	 */
	static async sendNotification(
		user: User,
		notificationConfiguration: NotificationsConfiguration,
		notificationType: NotificationType,
		content: string,
		lng: Language
	): Promise<void> {
		const notificationTypeValue = notificationType.value(notificationConfiguration);

		if (!notificationTypeValue.enabled) {
			return;
		}

		switch (notificationTypeValue.sendType) {
			case NotificationSendTypeEnum.DM:
				await NotificationsHandler.sendDmNotification(user, content, lng);
				break;
			case NotificationSendTypeEnum.CHANNEL:
				await this.sendChannelNotification(user, notificationConfiguration, notificationType, content, lng);
				break;
			default:
				throw `Unknown sendLocation: ${notificationTypeValue.sendType}`;
		}
	}

	/**
	 * This function is called to get the notification embed
	 * @param user
	 * @param content
	 * @param lng
	 */
	private static getNotificationEmbed(user: User, content: string, lng: Language): CrowniclesEmbed {
		return new CrowniclesEmbed()
			.formatAuthor(i18n.t("bot:notificationTitle", { lng }), user)
			.setDescription(content)
			.setFooter({ text: i18n.t("bot:notificationFooter", { lng }) });
	}

	/**
	 * This function is called to send a DM notification to a user
	 * @param user
	 * @param content
	 * @param lng
	 */
	static async sendDmNotification(user: User, content: string, lng: Language): Promise<void> {
		const embed = NotificationsHandler.getNotificationEmbed(user, content, lng);
		await user.send({ embeds: [embed] })
			.catch(e => {
				if (e.toString()
					.includes("DiscordAPIError[50007]")) {
					CrowniclesLogger.debug(`Failed to send DM notification to user ${user.id}`, e);
				}
				else {
					CrowniclesLogger.errorWithObj(`Failed to send DM notification to user ${user.id}`, e);
				}
			});
	}

	/**
	 * This function is called to verify if the bot has access to a channel
	 * @param user
	 * @param notificationConfiguration
	 * @param notificationType
	 * @param content
	 * @param lng
	 */
	static async sendChannelNotification(user: User, notificationConfiguration: NotificationsConfiguration, notificationType: NotificationType, content: string, lng: Language): Promise<void> {
		const embed = NotificationsHandler.getNotificationEmbed(user, content, lng);

		const notificationTypeValue = notificationType.value(notificationConfiguration);

		const posted = await sendInGuildChannelFromAnyShard(notificationTypeValue.channelId!, {
			content: getMention(user.id),
			embeds: [embed.toJSON()]
		});

		if (!posted) {
			notificationType.changeSendTypeCallback(notificationConfiguration, NotificationSendTypeEnum.DM, "");
			await notificationConfiguration.save();

			await NotificationsHandler.sendDmNotification(user, `${content}\n\n${i18n.t("bot:notificationsNoChannelAccess", { lng })}`, lng);
		}
	}

	/**
	 * Handle GDPR export completion notification
	 * Creates a ZIP file from CSV files and sends it as a DM attachment
	 * @param user The Discord user to send the export to
	 * @param packet The GDPR export completion packet
	 * @param lng The user's language
	 */
	private static async handleGDPRExportComplete(
		user: User,
		packet: GDPRExportCompleteNotificationPacket,
		lng: Language
	): Promise<void> {
		if (packet.error) {
			await sendGDPRErrorEmbed(user, lng, packet.error);
			return;
		}

		try {
			const zipBuffer = await createGDPRZipBuffer(packet.csvFiles);

			const fileName = i18n.t("notifications:gdprExport.fileName", {
				lng,
				anonymizedId: packet.anonymizedPlayerId
			});

			const successEmbed = new CrowniclesEmbed()
				.formatAuthor(i18n.t("notifications:gdprExport.title", { lng }), user)
				.setDescription(i18n.t("notifications:gdprExport.success", {
					lng,
					anonymizedId: packet.anonymizedPlayerId,
					fileCount: Object.keys(packet.csvFiles).length
				}));

			await user.send({
				embeds: [successEmbed],
				files: [new AttachmentBuilder(zipBuffer, { name: fileName })]
			});

			CrowniclesLogger.info(`GDPR export DM sent to user ${user.id} for player ${packet.anonymizedPlayerId}`);
		}
		catch (error) {
			CrowniclesLogger.errorWithObj(`Failed to create or send GDPR export ZIP to user ${user.id}`, error);
			await sendGDPRErrorEmbed(user, lng, error instanceof Error ? error.message : "Failed to create ZIP file");
		}
	}
}
