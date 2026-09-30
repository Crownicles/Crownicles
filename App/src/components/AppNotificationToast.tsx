import {ReactNode, useEffect} from "react";
import {useRouter} from "expo-router";
import {useQueryClient} from "@tanstack/react-query";
import {AppNotificationRes} from "ws-packets/src/fromServer/settings/AppNotificationRes";
import {NOTIFICATION_TYPES, NotificationType} from "ws-packets/src/objects/NotificationPreferences";
import {AppIcons} from "@/src/AppIcons";
import {useAnnouncementTurn} from "@/src/components/useToastTurn";
import {Toast} from "@/src/design/Sections";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {NOTIFICATION_ROUTES} from "@/src/notifications/NotificationRoutes";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {PushedAnnouncementStore, usePushedAnnouncement} from "@/src/store/PushedAnnouncementStore";
import {GAME_ENTITIES, GameEntity, gameKey} from "@/src/store/GameEntities";
import {useBlessingAnnouncement} from "@/src/store/BlessingAnnouncementStore";

const TOAST_EMBLEM_SIZE = 24;

/** What each kind changed, refreshed as it arrives so the screen it opens is already right. */
const STALE_ENTITIES: Record<NotificationType, readonly GameEntity[]> = {
	[NOTIFICATION_TYPES.REPORT]: [GAME_ENTITIES.REPORT],
	[NOTIFICATION_TYPES.DAILY_BONUS]: [GAME_ENTITIES.INVENTORY],
	[NOTIFICATION_TYPES.ENERGY]: [GAME_ENTITIES.PROFILE],
	[NOTIFICATION_TYPES.GUILD_DAILY]: [GAME_ENTITIES.GUILD, GAME_ENTITIES.PROFILE],
	[NOTIFICATION_TYPES.GUILD_KICK]: [GAME_ENTITIES.GUILD, GAME_ENTITIES.PROFILE],
	[NOTIFICATION_TYPES.GUILD_STATUS_CHANGE]: [GAME_ENTITIES.GUILD],
	[NOTIFICATION_TYPES.PLAYER_FREED_FROM_JAIL]: [GAME_ENTITIES.REPORT, GAME_ENTITIES.PROFILE],
	[NOTIFICATION_TYPES.FIGHT_CHALLENGE]: [GAME_ENTITIES.FIGHT_HISTORY, GAME_ENTITIES.PROFILE],
	[NOTIFICATION_TYPES.PET_EXPEDITION]: [GAME_ENTITIES.PET],
	[NOTIFICATION_TYPES.TOURNAMENT]: [GAME_ENTITIES.PROFILE]
};

/** The adventure screen already tells an arrival with its own toast: announcing it twice would be noise. */
function worthAnnouncing(packet: AppNotificationRes): boolean {
	return packet.notificationType !== NOTIFICATION_TYPES.REPORT;
}

export const appNotificationStore = new PushedAnnouncementStore<AppNotificationRes>(AppNotificationRes.wireName, worthAnnouncing);

/** Keeps the screens in step with every notification received while the app is open, announced or not. */
export function useAppNotificationRefresh(): void {
	const queryClient = useQueryClient();
	useEffect(() => WebSocketClient.getInstance().registerPushedPacketHandler<AppNotificationRes>(AppNotificationRes.wireName, packet => {
		for (const entity of STALE_ENTITIES[packet.notificationType] ?? []) {
			queryClient.invalidateQueries({queryKey: gameKey(entity)}).then();
		}
	}), [queryClient]);
}

/** A notification that reached the player while the app is open: the words of the push, and a tap opens the same screen. It lets a blessing go first. */
export function AppNotificationToast(): ReactNode {
	const router = useRouter();
	const packet = usePushedAnnouncement(appNotificationStore);
	const myTurn = useAnnouncementTurn();
	const blessing = useBlessingAnnouncement();
	const waiting = !myTurn || Boolean(blessing);
	if (waiting) return null;
	if (!packet) return null;
	return <Toast
		emblem={<TwemojiIcon emoji={AppIcons.getIcon(`notifications.types.${packet.notificationType}`)} size={TOAST_EMBLEM_SIZE} />}
		title={packet.title}
		subtitle={packet.body}
		onDismiss={appNotificationStore.announced}
		onPress={(): void => {
			appNotificationStore.announced();
			router.navigate(NOTIFICATION_ROUTES[packet.notificationType]);
		}}
	/>;
}
