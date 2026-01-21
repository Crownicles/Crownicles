import { NotificationsSerializedPacket } from "../../../Lib/src/packets/notifications/NotificationsSerializedPacket";
import {
	AttachmentBuilder,
	BaseGuildTextChannel, TextChannel, User
} from "discord.js";
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

// skipcq: JS-C1003 - archiver does not expose itself as an ES Module.
const archiver = require("archiver") as typeof import("archiver");

export abstract class NotificationsHandler {
	/**
	 * This function is called to send a batch of notifications
	 * @param notificationSerializedPacket
	 */
	static sendNotifications(notificationSerializedPacket: NotificationsSerializedPacket): void {
		for (const notification of notificationSerializedPacket.notifications) {
			this._processSingleNotification(notification)
				.catch(error => {
					CrowniclesLogger.error(`Failed to process notification: ${error}`);
				});
		}
	}

	private static async _processSingleNotification(notification: NotificationsSerializedPacket["notifications"][0]): Promise<void> {
		const keycloakId = notification.packet.keycloakId;

		const getUser = await KeycloakUtils.getUserByKeycloakId(keycloakConfig, keycloakId);

		if (getUser.isError || !getUser.payload.user.attributes.discordId || getUser.payload.user.attributes.discordId[0] === "0") {
			throw `Keycloak user with id ${keycloakId} not found or missing discordId`;
		}
		const discordId = getUser.payload.user.attributes.discordId[0];
		const lng = getUser.payload.user.attributes.language[0] as Language;

		let notificationContent: string;
		let notificationType: NotificationType;

		switch (notification.type) {
			case ReachDestinationNotificationPacket.name: {
				const packet = notification.packet as ReachDestinationNotificationPacket;
				notificationContent = i18n.t("bot:notificationReachDestination", {
					lng,
					destination: DisplayUtils.getMapLocationDisplay(packet.mapType, packet.mapId, lng)
				});
				notificationType = NotificationsTypes.REPORT;
				break;
			}
			case DailyBonusNotificationPacket.name: {
				notificationContent = i18n.t("bot:notificationDailyBonus", {
					lng
				});
				notificationType = NotificationsTypes.DAILY_BONUS;
				break;
			}
			case EnergyFullNotificationPacket.name: {
				notificationContent = i18n.t("bot:notificationEnergyFull", {
					lng
				});
				notificationType = NotificationsTypes.ENERGY;
				break;
			}
			case GuildDailyNotificationPacket.name: {
				const packet = notification.packet as GuildDailyNotificationPacket;
				notificationContent = i18n.t("bot:notificationGuildDaily", {
					lng,
					pseudo: await DisplayUtils.getEscapedUsername(packet.keycloakIdOfExecutor, lng),
					rewards: getCommandGuildDailyRewardPacketString((notification.packet as GuildDailyNotificationPacket).reward, lng)
				});
				notificationType = NotificationsTypes.GUILD_DAILY;
				break;
			}
			case GuildKickNotificationPacket.name: {
				const packet = notification.packet as GuildKickNotificationPacket;
				notificationContent = i18n.t("bot:notificationGuildKick", {
					lng,
					pseudo: await DisplayUtils.getEscapedUsername(packet.keycloakIdOfExecutor, lng),
					guildName: packet.guildName
				});
				notificationType = NotificationsTypes.GUILD_KICK;
				break;
			}
			case GuildStatusChangeNotificationPacket.name: {
				const packet = notification.packet as GuildStatusChangeNotificationPacket;
				const keyNotification = packet.becomeChief ? "becomeChief" : packet.becomeElder ? "becomeElder" : "becomeMember";
				notificationContent = i18n.t(`bot:notificationGuildStatusChange.${keyNotification}`, {
					lng,
					guildName: packet.guildName
				});
				notificationType = NotificationsTypes.GUILD_STATUS_CHANGE;
				break;
			}
			case PlayerFreedFromJailNotificationPacket.name: {
				const packet = notification.packet as PlayerFreedFromJailNotificationPacket;
				notificationContent = i18n.t("notifications:playerFreedFromJail.description", {
					lng,
					freedByPlayer: await DisplayUtils.getEscapedUsername(packet.freedByPlayerKeycloakId, lng)
				});
				notificationType = NotificationsTypes.PLAYER_FREED_FROM_JAIL;
				break;
			}
			case PlayerWasAttackedNotificationPacket.name: {
				const packet = notification.packet as PlayerWasAttackedNotificationPacket;
				notificationContent = i18n.t("notifications:fightChallenge.description", {
					lng,
					attackerPseudo: await DisplayUtils.getEscapedUsername(packet.attackedByPlayerKeycloakId, lng)
				});
				notificationType = NotificationsTypes.FIGHT_CHALLENGE;
				break;
			}
			case ExpeditionFinishedNotificationPacket.name: {
				const packet = notification.packet as ExpeditionFinishedNotificationPacket;
				const petIcon = DisplayUtils.getPetIcon(packet.petId, packet.petSex as SexTypeShort);
				const petName = DisplayUtils.getPetNicknameOrTypeName(packet.petNickname, packet.petId, packet.petSex as SexTypeShort, lng);
				notificationContent = i18n.t("bot:notificationPetExpedition", {
					lng,
					petDisplay: `${petIcon} **${petName}**`
				});
				notificationType = NotificationsTypes.PET_EXPEDITION;
				break;
			}
			case GDPRExportCompleteNotificationPacket.name: {
				// GDPR export is handled separately - send DM directly with ZIP attachment
				const gdprPacket = notification.packet as GDPRExportCompleteNotificationPacket;
				const gdprDiscordUser = await crowniclesClient.users.fetch(discordId);
				await NotificationsHandler.handleGDPRExportComplete(gdprDiscordUser, gdprPacket, lng);
				return; // Don't use standard notification flow
			}
			default:
				throw `Unknown notification type: ${notification.type}`;
		}

		const discordUser = await crowniclesClient.users.fetch(discordId);
		await NotificationsHandler.sendNotification(
			discordUser,
			await NotificationsConfigurations.getOrRegister(discordId),
			notificationType,
			i18n.t(notificationContent, { lng }),
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

		const channelAccess = await crowniclesClient.shard!.broadcastEval((client, context) =>
			client.channels.fetch(context.channel)
				.then(channel => {
					if ((<BaseGuildTextChannel>channel).guild.shardId === client.shard!.ids[0]) {
						(<TextChannel>channel).send(context.embedNotification);
						return true;
					}
					return false;
				})
				.catch(() => false), {
			context: {
				channel: notificationTypeValue.channelId!,
				embedNotification: {
					content: getMention(user.id),
					embeds: [embed]
				}
			}
		});

		if (!channelAccess.includes(true)) {
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
			const errorEmbed = new CrowniclesEmbed()
				.formatAuthor(i18n.t("notifications:gdprExport.title", { lng }), user)
				.setDescription(i18n.t("notifications:gdprExport.error", {
					lng,
					error: packet.error
				}));

			await user.send({ embeds: [errorEmbed] }).catch(e => {
				CrowniclesLogger.errorWithObj(`Failed to send GDPR error DM to user ${user.id}`, e);
			});
			return;
		}

		try {
			// Create ZIP file from CSV files
			const archive = archiver("zip", { zlib: { level: 9 } });
			const chunks: Buffer[] = [];

			archive.on("data", (chunk: Buffer) => chunks.push(chunk));

			const archivePromise = new Promise<Buffer>((resolve, reject) => {
				archive.on("end", () => resolve(Buffer.concat(chunks)));
				archive.on("error", reject);
			});

			// Add each CSV file to the archive
			for (const [filename, content] of Object.entries(packet.csvFiles)) {
				archive.append(content, { name: filename });
			}

			await archive.finalize();

			const zipBuffer = await archivePromise;
			const fileName = i18n.t("notifications:gdprExport.fileName", {
				lng,
				anonymizedId: packet.anonymizedPlayerId
			});

			const attachment = new AttachmentBuilder(zipBuffer, { name: fileName });

			const successEmbed = new CrowniclesEmbed()
				.formatAuthor(i18n.t("notifications:gdprExport.title", { lng }), user)
				.setDescription(i18n.t("notifications:gdprExport.success", {
					lng,
					anonymizedId: packet.anonymizedPlayerId,
					fileCount: Object.keys(packet.csvFiles).length
				}));

			await user.send({
				embeds: [successEmbed],
				files: [attachment]
			});

			CrowniclesLogger.info(`GDPR export DM sent to user ${user.id} for player ${packet.anonymizedPlayerId}`);
		}
		catch (error) {
			CrowniclesLogger.errorWithObj(`Failed to create or send GDPR export ZIP to user ${user.id}`, error);

			// Try to send error message
			const errorEmbed = new CrowniclesEmbed()
				.formatAuthor(i18n.t("notifications:gdprExport.title", { lng }), user)
				.setDescription(i18n.t("notifications:gdprExport.error", {
					lng,
					error: error instanceof Error ? error.message : "Failed to create ZIP file"
				}));

			await user.send({ embeds: [errorEmbed] }).catch(() => {
				// Ignore - already logged above
			});
		}
	}
}
