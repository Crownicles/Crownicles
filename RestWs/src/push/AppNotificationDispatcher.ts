import { AppNotificationDelivery } from "../../../Lib/src/packets/notifications/AppNotificationsSerializedPacket";
import { Language } from "../../../Lib/src/Language";
import { PushDevice } from "../../../Lib/src/types/PushDevices";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";
import { AppNotificationRes } from "../../../WsPackets/src/fromServer/settings/AppNotificationRes";
import { makeFromServerPacket } from "../../../WsPackets/src/MakePackets";
import {
	PlayerNameResolver, PushText, pushTextOf
} from "./PushTexts";
import {
	PUSH_RESULTS, PushMessage, PushResult
} from "./PushSender";

/** Everything the dispatch reaches outside of itself, so it can be exercised without a network. */
export type AppNotificationDispatch = {
	push: (device: PushDevice, message: PushMessage) => Promise<PushResult>;
	playerName: PlayerNameResolver;
	playerLanguage: (keycloakId: string) => Promise<Language>;
	isConnected: (keycloakId: string) => boolean;
	showLive: (keycloakId: string, packet: AppNotificationRes) => void;
	forgetDevice: (keycloakId: string, token: string) => void;
};

/**
 * Delivers one notification: shown at once in the app if it is open, and pushed to every device of the
 * player, each in its own language. The app hides the push while in the foreground, so both never show.
 */
export async function dispatchAppNotification(delivery: AppNotificationDelivery, dispatch: AppNotificationDispatch): Promise<void> {
	const keycloakId = delivery.notification.packet.keycloakId;
	const texts = new Map<Language, Promise<PushText>>();
	const textIn = (lng: Language): Promise<PushText> => {
		const text = texts.get(lng) ?? pushTextOf(delivery.notificationType, delivery.notification.packet, lng, dispatch.playerName);
		texts.set(lng, text);
		return text;
	};

	if (dispatch.isConnected(keycloakId)) {
		const lng = delivery.devices[0]?.language ?? await dispatch.playerLanguage(keycloakId);
		dispatch.showLive(keycloakId, makeFromServerPacket(AppNotificationRes, {
			notificationType: delivery.notificationType,
			...await textIn(lng)
		}));
	}

	await Promise.all(delivery.devices.map(async device => {
		const result = await dispatch.push(device, {
			notificationType: delivery.notificationType,
			...await textIn(device.language)
		});
		if (result === PUSH_RESULTS.INVALID_TOKEN) {
			CrowniclesLogger.info("Forgetting a device its push service no longer knows", { platform: device.platform });
			dispatch.forgetDevice(keycloakId, device.token);
		}
	}));
}
