import { NotificationsSerializedPacket } from "../../../Lib/src/packets/notifications/NotificationsSerializedPacket";
import {
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

		if (getUser.isError || !getUser.payload.user.attributes.discordId) {
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
}
