import {useEffect} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {makeFromClientPacket} from "ws-packets/src/MakePackets";
import {NotificationPreferenceSetReq, NotificationPreferencesReq} from "ws-packets/src/fromClient/NotificationPreferencesReq";
import {NotificationPreferencesRes} from "ws-packets/src/fromServer/settings/NotificationPreferencesRes";
import {NOTIFICATION_TYPES, NotificationType} from "ws-packets/src/objects/NotificationPreferences";
import {GameAnswer, GameClient} from "@/src/networking/GameClient";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {RequestState, useGameQuery} from "@/src/store/useGameQuery";
import {GameMutation, useGameMutation} from "@/src/store/useGameMutation";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";
import {commandRejectionMessage} from "@/src/display/CommandRejection";
import {i18n} from "@/src/translations/i18n";

/** The kinds the app can send today; only these get a setting, the others stay stored for later. */
export const DELIVERED_NOTIFICATION_TYPES: readonly NotificationType[] = [NOTIFICATION_TYPES.REPORT];

export type NotificationPreferenceChange = {type: NotificationType; enabled: boolean};

function requestNotificationPreferences(): Promise<GameAnswer<NotificationPreferencesRes>> {
	return GameClient.request(makeFromClientPacket(NotificationPreferencesReq, {}), NotificationPreferencesRes);
}

/**
 * The app's own notification settings, independent from Discord's.
 * The server pushes them again once it has taken over the Discord ones, the first time only.
 */
export function useNotificationPreferences(): RequestState<NotificationPreferencesRes> {
	const queryClient = useQueryClient();
	useEffect(() => WebSocketClient.getInstance().registerPushedPacketHandler<NotificationPreferencesRes>(NotificationPreferencesRes.wireName, packet => {
		queryClient.setQueryData(gameKey(GAME_ENTITIES.NOTIFICATION_PREFERENCES), (): GameAnswer<NotificationPreferencesRes> => ({kind: "answer", packet}));
	}), [queryClient]);
	return useGameQuery(GAME_ENTITIES.NOTIFICATION_PREFERENCES, requestNotificationPreferences);
}

/** Whether the player wants this kind in the app; unknown until the server answered, so nothing is sent before. */
export function isNotificationEnabled(state: RequestState<NotificationPreferencesRes>, type: NotificationType): boolean {
	return state.status === "ready" && state.data.preferences[type];
}

export function useNotificationPreferenceChange(): GameMutation<NotificationPreferenceChange> {
	const queryClient = useQueryClient();
	return useGameMutation(async (change: NotificationPreferenceChange): Promise<string | null> => {
		const answer = await GameClient.request(makeFromClientPacket<NotificationPreferenceSetReq>(NotificationPreferenceSetReq, change), NotificationPreferencesRes);
		if (answer.kind === "rejected") return commandRejectionMessage(answer.packet.rejection);
		if (answer.kind !== "answer") return i18n.t("app:common.connectionError");
		queryClient.setQueryData(gameKey(GAME_ENTITIES.NOTIFICATION_PREFERENCES), answer);
		return null;
	});
}
