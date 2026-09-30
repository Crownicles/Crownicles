import {Fragment, ReactNode} from "react";
import {useRouter} from "expo-router";
import {NotificationType} from "ws-packets/src/objects/NotificationPreferences";
import {NOTIFICATION_GROUPS, useNotificationPreferenceChange, useNotificationPreferences} from "@/src/store/useNotificationPreferences";
import {NOTIFICATION_PERMISSIONS, useNotificationPermission} from "@/src/notifications/NotificationPermission";
import {Page} from "@/src/design/DetailScreen";
import {SectionHeader} from "@/src/design/Primitives";
import {ActionBanner, ExpandableList, Refusal, Standing, SwitchRow} from "@/src/design/Sections";
import {TwemojiIcon} from "@/src/design/TwemojiIcon";
import {Bell} from "@/src/design/FightIcons";
import {Theme} from "@/src/design/Theme";
import {AppIcons} from "@/src/AppIcons";
import {i18n} from "@/src/translations/i18n";

const ROW_EMBLEM_SIZE = 24;

/** The switches mean nothing while the phone refuses: the way to allow it comes before them. */
function PermissionBanner(): ReactNode {
	const {permission, allow} = useNotificationPermission();
	if (permission === null || permission === NOTIFICATION_PERMISSIONS.GRANTED) return null;
	const blocked = permission === NOTIFICATION_PERMISSIONS.BLOCKED;
	return <ActionBanner
		icon={Bell}
		label={i18n.t(blocked ? "app:settings.notifications.permission.openSettings" : "app:settings.notifications.permission.allow")}
		hint={{reason: i18n.t("app:settings.notifications.permission.off")}}
		onPress={allow}
		testID="notifications-permission"
	/>;
}

function NotificationSwitch({type, value, pending, onChange}: {type: NotificationType; value: boolean | undefined; pending: boolean; onChange: (enabled: boolean) => void}): ReactNode {
	return <SwitchRow
		emblem={<TwemojiIcon emoji={AppIcons.getIcon(`notifications.types.${type}`)} size={ROW_EMBLEM_SIZE} />}
		label={i18n.t(`app:settings.notifications.types.${type}`)}
		caption={i18n.t(`app:settings.notifications.captions.${type}`)}
		value={value}
		disabled={pending}
		onChange={onChange}
		testID={`notification-${type}`}
	/>;
}

/** One switch per kind, gathered by the part of the game it comes from; Discord keeps its own settings. */
export default function NotificationSettings(): ReactNode {
	const router = useRouter();
	const state = useNotificationPreferences();
	const change = useNotificationPreferenceChange();
	return <Page
		onClose={router.back}
		heading={<Standing
			emblem={<TwemojiIcon emoji={AppIcons.getIcon("notifications.bell")} size={Theme.dimensions.headerIcon} />}
			caption={i18n.t("app:settings.title")}
			title={i18n.t("app:settings.notifications.label")}
			subtitle={i18n.t("app:settings.notifications.independent")}
		/>}
	>
		<PermissionBanner />
		{NOTIFICATION_GROUPS.map(group => <Fragment key={group.key}>
			<SectionHeader>{i18n.t(`app:settings.notifications.groups.${group.key}`)}</SectionHeader>
			<ExpandableList>
				{group.types.map(type => <NotificationSwitch
					key={type}
					type={type}
					value={state.status === "ready" ? state.data.preferences[type] : undefined}
					pending={change.pending}
					onChange={(enabled): void => {
						change.submit({type, enabled}).then();
					}}
				/>)}
			</ExpandableList>
		</Fragment>)}
		{change.message ? <Refusal>{change.message}</Refusal> : null}
	</Page>;
}
