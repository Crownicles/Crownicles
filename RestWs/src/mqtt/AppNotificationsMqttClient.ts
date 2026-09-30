import { MqttTopicUtils } from "../../../Lib/src/utils/MqttTopicUtils";
import { AppNotificationsSerializedPacket } from "../../../Lib/src/packets/notifications/AppNotificationsSerializedPacket";
import { makePacket } from "../../../Lib/src/packets/CrowniclesPacket";
import { CommandPushDeviceUnregisterReq } from "../../../Lib/src/packets/commands/CommandPushDevicePacket";
import { KeycloakUtils } from "../../../Lib/src/keycloak/KeycloakUtils";
import {
	Language, LANGUAGE
} from "../../../Lib/src/Language";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";
import { AppNotificationRes } from "../../../WsPackets/src/fromServer/settings/AppNotificationRes";
import {
	keycloakConfig, restWsConfig
} from "../index";
import { WebSocketServer } from "../services/WebSocketServer";
import { ContextConstants } from "../constants/ContextConstants";
import {
	AppNotificationDispatch, dispatchAppNotification
} from "../push/AppNotificationDispatcher";
import { PushServices } from "../push/PushServices";
import { PushResult } from "../push/PushSender";
import { RestWsMqttClient } from "./RestWsMqttClient";
import { MqttManager } from "./MqttManager";

async function playerName(keycloakId: string): Promise<string | undefined> {
	const user = await KeycloakUtils.getUserByKeycloakId(keycloakConfig, keycloakId);
	return user.isError ? undefined : user.payload.user.attributes.gameUsername?.[0];
}

async function playerLanguage(keycloakId: string): Promise<Language> {
	const user = await KeycloakUtils.getUserByKeycloakId(keycloakConfig, keycloakId);
	return user.isError ? LANGUAGE.DEFAULT_LANGUAGE : KeycloakUtils.getUserLanguage(user.payload.user);
}

function showLive(keycloakId: string, packet: AppNotificationRes): void {
	WebSocketServer.dispatchPacketsToClient(keycloakId, [
		{
			name: AppNotificationRes.wireName,
			packet
		}
	]);
}

/** Core forgets the device through the same packet the app sends when logging out. */
function forgetDevice(keycloakId: string, token: string): void {
	MqttManager.globalMqttClient.sendToBackEnd({
		frontEndOrigin: ContextConstants.FRONT_END_ORIGIN,
		frontEndSubOrigin: ContextConstants.FRONT_END_SUB_ORIGIN,
		keycloakId,
		webSocket: {}
	}, makePacket(CommandPushDeviceUnregisterReq, { token }));
}

/**
 * Delivers what Core notifies to the app. The session is persistent and the subscription at least once,
 * so notifications published while RestWs restarts are delivered when it is back.
 */
export class AppNotificationsMqttClient extends RestWsMqttClient {
	private readonly dispatch: AppNotificationDispatch;

	public constructor(host: string, pushServices: PushServices) {
		super(host, {
			clientId: MqttTopicUtils.getAppNotificationsConsumerId(restWsConfig.PREFIX),
			clean: false
		});
		this.dispatch = {
			push: (device, message): Promise<PushResult> => pushServices.send(device, message),
			playerName,
			playerLanguage,
			isConnected: (keycloakId): boolean => WebSocketServer.isConnected(keycloakId),
			showLive,
			forgetDevice
		};
	}

	onConnect(): void {
		this.subscribeTo(this.mqttClient, MqttTopicUtils.getAppNotificationsTopic(restWsConfig.PREFIX), false, 1);
	}

	async onMessage(message: string): Promise<void> {
		const { deliveries } = JSON.parse(message) as AppNotificationsSerializedPacket;
		CrowniclesLogger.debug("Delivering app notifications", { count: deliveries.length });
		await Promise.all(deliveries.map(delivery => dispatchAppNotification(delivery, this.dispatch)
			.catch(error => CrowniclesLogger.errorWithObj(`Could not deliver a ${delivery.notificationType} app notification`, error))));
	}
}
